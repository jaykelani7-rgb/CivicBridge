from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger("civicbridge.data_intelligence")

SCORE_COMPONENTS = {
    "demand_rate", "infrastructure_gap", "severity", "equity_vulnerability",
    "affected_population", "recent_trend", "evidence_confidence",
    "strategic_alignment", "delivery_readiness", "data_confidence",
    "existing_coverage_penalty",
}
SOURCE_CLASSIFICATIONS = {
    "official_public", "public_nonofficial", "citizen_aggregate", "ai_normalized",
    "derived", "estimated", "synthetic_demo", "unclassified",
}
EVIDENCE_TYPES = {"text", "voice", "image", "messaging", "repeat_report", "document", "unknown"}
EVIDENCE_TYPE_ALIASES = {"photo": "image", "service_outage": "unknown"}


class PriorityBandRule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    band: Literal["critical", "high", "medium", "low"]
    minimum_action_score: float = Field(ge=0, le=100)
    reason_code: str = Field(pattern=r"^[A-Z0-9_]+$")


class DecisionMetadataConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: str
    ranking_methodology_version: str
    readiness_ruleset_version: str
    priority_bands: list[PriorityBandRule]
    minimum_evidence_confidence: float = Field(ge=0, le=1)
    essential_components: list[str]
    caution_fallback_count: int = Field(ge=1)
    stale_source_days: int = Field(ge=1)
    public_priority_enabled: bool = True

    @field_validator("essential_components")
    @classmethod
    def validate_components(cls, value: list[str]) -> list[str]:
        unknown = sorted(set(value) - SCORE_COMPONENTS)
        if unknown:
            raise ValueError(f"unknown essential score components: {', '.join(unknown)}")
        return value

    @model_validator(mode="after")
    def validate_bands(self) -> "DecisionMetadataConfig":
        if not self.priority_bands:
            raise ValueError("at least one priority band is required")
        thresholds = [rule.minimum_action_score for rule in self.priority_bands]
        if thresholds != sorted(thresholds, reverse=True) or len(set(thresholds)) != len(thresholds):
            raise ValueError("priority band thresholds must be unique and strictly descending")
        if self.priority_bands[-1].minimum_action_score != 0:
            raise ValueError("the lowest priority band must start at zero")
        return self


def load_decision_metadata_config(path: Path) -> DecisionMetadataConfig:
    return DecisionMetadataConfig.model_validate_json(path.read_text(encoding="utf-8"))


def _iso(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _safe_public_url(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        return None
    if parsed.netloc.endswith("storage.googleapis.com") or "storage.cloud.google.com" in parsed.netloc:
        return None
    return value


def _evidence_types(values: Any, *, log_context: dict[str, Any]) -> list[str]:
    result: set[str] = set()
    for raw in values if isinstance(values, list) else []:
        value = EVIDENCE_TYPE_ALIASES.get(str(raw), str(raw))
        if value not in EVIDENCE_TYPES:
            logger.warning("evidence_type_unrecognized", extra={**log_context, "invalid_enum": "evidence_type"})
            value = "unknown"
        result.add(value)
    return sorted(result or {"unknown"})


class DecisionMetadataService:
    """Deterministic, presentation-support metadata; never changes the Action Score."""

    def __init__(self, config: DecisionMetadataConfig) -> None:
        self.config = config

    def priority(self, hotspot: dict[str, Any], ranked: list[dict[str, Any]], *, category_scope: Optional[str] = None) -> dict[str, Any]:
        ordered = sorted(
            ranked,
            key=lambda item: (
                -float(item["action_score"]), -float(item["evidence_confidence"]),
                -int(item["request_count"]), -datetime.fromisoformat(str(item["calculated_at"]).replace("Z", "+00:00")).timestamp(),
                str(item["hotspot_id"]),
            ),
        )
        rank = next((index for index, item in enumerate(ordered, 1) if item["hotspot_id"] == hotspot["hotspot_id"]), None)
        ranked_at = max((_iso(str(item["calculated_at"])) for item in ordered), default=_iso(str(hotspot["calculated_at"])))
        missing_essential = self._missing_essential(hotspot.get("score_components", []))
        if float(hotspot["evidence_confidence"]) < self.config.minimum_evidence_confidence or missing_essential:
            band, reason = "insufficient_evidence", "EVIDENCE_REQUIREMENTS_NOT_MET"
        else:
            rule = next(rule for rule in self.config.priority_bands if float(hotspot["action_score"]) >= rule.minimum_action_score)
            band, reason = rule.band, rule.reason_code
        result = {
            "rank": rank, "total_ranked": len(ordered), "band": band, "band_reason_code": reason,
            "ranking_scope": {"country_code": hotspot["country_code"], "category": category_scope},
            "ranked_at": ranked_at, "methodology_version": self.config.ranking_methodology_version,
        }
        logger.info("priority_rank_calculated", extra={"hotspot_id": hotspot["hotspot_id"], "rank": rank,
                    "total_ranked": len(ordered), "methodology_version": self.config.ranking_methodology_version})
        return result

    def evidence_groups(self, cluster_id: str, members: list[dict[str, Any]], *, hotspot_id: str) -> list[dict[str, Any]]:
        unique = {str(member["request_id"]): member for member in members}
        ordered = sorted(unique.values(), key=lambda item: (str(item["occurred_at"]), str(item["request_id"])))
        if not ordered:
            return []
        has_duplicate = any(item.get("group_relationship") == "probable_duplicate" for item in ordered)
        partitions = [ordered] if has_duplicate else [[item] for item in ordered]
        groups: list[dict[str, Any]] = []
        for index, partition in enumerate(partitions):
            # Prefer the richest privacy-safe normalized metadata, then use the
            # same stable time/ID ordering. Fixture-only legacy members remain valid.
            representative = sorted(partition, key=lambda item: (
                -int(bool(item.get("anonymized_original_summary"))),
                -int(bool(item.get("original_language"))),
                str(item["occurred_at"]), str(item["request_id"]),
            ))[0]
            relationship = "probable_duplicate" if len(partition) > 1 and has_duplicate else "distinct_theme"
            stable_key = f"{cluster_id}:{relationship}:{index if relationship == 'distinct_theme' else 'cluster'}"
            language = representative.get("original_language") or None
            translation_performed = bool(representative.get("translation_performed"))
            groups.append({
                "group_id": "eg_" + hashlib.sha256(stable_key.encode()).hexdigest()[:20],
                "representative_summary": str(representative["summary"])[:500],
                "representative_original_summary": representative.get("anonymized_original_summary") or None,
                "original_language": language,
                "working_language": representative.get("working_language") or "en",
                "report_count": len(partition), "relationship": relationship,
                "evidence_types": _evidence_types(representative.get("evidence_types"), log_context={"hotspot_id": hotspot_id}),
                "first_reported_at": _iso(str(partition[0]["occurred_at"])),
                "last_reported_at": _iso(str(partition[-1]["occurred_at"])),
                "translation_performed": translation_performed,
                "translation": ({"performed": translation_performed,
                                 "provider": representative.get("translation_provider"), "confidence": None}
                                if language else None),
            })
        logger.info("evidence_groups_generated", extra={"hotspot_id": hotspot_id, "group_count": len(groups)})
        return groups

    def sources(self, enrichment: dict[str, Any], components: list[dict[str, Any]], *, hotspot_id: str) -> list[dict[str, Any]]:
        support: dict[str, set[str]] = {}
        for component in components:
            for source_id in component.get("source_ids", []):
                support.setdefault(str(source_id), set()).add(str(component["name"]))
        result: list[dict[str, Any]] = []
        seen: set[str] = set()
        for source in enrichment.get("sources", []):
            source_id = str(source["source_id"])
            classification = source.get("classification") or ("synthetic_demo" if bool(source.get("synthetic")) else "unclassified")
            if classification not in SOURCE_CLASSIFICATIONS:
                classification = "unclassified"
            if classification == "unclassified":
                logger.warning("source_unclassified", extra={"hotspot_id": hotspot_id, "source_id": source_id})
            result.append({
                "source_id": source_id, "classification": classification,
                "dataset_name": source.get("dataset_title"), "publisher": source.get("publisher"),
                "version": source.get("dataset_version"), "country_codes": [source["country_code"]] if source.get("country_code") else [],
                "observation_period": source.get("time_coverage"), "retrieved_at": source.get("retrieved_at"),
                "public_url": _safe_public_url(source.get("public_url") or source.get("source_url")),
                "supports_components": sorted(support.get(source_id, set())),
                "upstream_source_ids": sorted(set(source.get("upstream_source_ids") or [])),
                "geographic_coverage": source.get("geographic_coverage"), "license": source.get("license"),
                "known_limitations": [source["transformation_notes"]] if source.get("transformation_notes") else [],
                "confidence": source.get("confidence"), "freshness_status": source.get("freshness_status"),
            })
            seen.add(source_id)
        virtual = [
            ("civicbridge_validated_requests", "citizen_aggregate", "CivicBridge validated request aggregates"),
        ]
        for source_id, classification, name in virtual:
            if source_id in support and source_id not in seen:
                result.append({"source_id": source_id, "classification": classification, "dataset_name": name,
                    "publisher": "CivicBridge", "version": None, "country_codes": [], "observation_period": None,
                    "retrieved_at": None, "public_url": None, "supports_components": sorted(support[source_id]),
                    "upstream_source_ids": [], "geographic_coverage": None, "license": None,
                    "known_limitations": [], "confidence": None, "freshness_status": None})
        return sorted(result, key=lambda item: item["source_id"])

    def limitations(self, *, components: list[dict[str, Any]], sources: list[dict[str, Any]],
                    geography: dict[str, Any], warnings: list[str], created_at: str) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for component in components:
            if not component.get("missing"):
                continue
            name = str(component["name"])
            code = "RECENT_TREND_FALLBACK" if name == "recent_trend" else "COMPONENT_FALLBACK"
            records.append(self._limitation(code, affected=[name]))
        if any(source["classification"] == "synthetic_demo" for source in sources):
            records.append(self._limitation("SYNTHETIC_SOURCE"))
        if any(source["classification"] == "unclassified" for source in sources):
            affected = sorted({component for source in sources if source["classification"] == "unclassified" for component in source["supports_components"]})
            records.append(self._limitation("SOURCE_UNCLASSIFIED", affected=affected))
        if geography.get("confidence", 1) < 1 or "centroid" in str(geography.get("boundary_source", "")).lower():
            records.append(self._limitation("APPROXIMATE_GEOGRAPHY"))
        essential_missing = [name for name in self.config.essential_components if any(c["name"] == name and c.get("missing") for c in components)]
        if essential_missing:
            records.append(self._limitation("INCOMPLETE_EVIDENCE", affected=essential_missing))
        now = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        stale_components: set[str] = set()
        for source in sources:
            retrieved = source.get("retrieved_at")
            if not retrieved:
                continue
            try:
                parsed = datetime.fromisoformat(str(retrieved).replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                if (now - parsed).days > self.config.stale_source_days:
                    stale_components.update(source["supports_components"])
            except ValueError:
                continue
        if stale_components:
            records.append(self._limitation("STALE_DATASET", affected=sorted(stale_components)))
        deduped: dict[tuple[str, tuple[str, ...]], dict[str, Any]] = {}
        for record in records:
            deduped[(record["code"], tuple(record["affected_components"]))] = record
        order = {"blocking": 0, "warning": 1, "information": 2}
        result = sorted(deduped.values(), key=lambda item: (order[item["severity"]], item["code"], item["affected_components"]))
        logger.info("structured_limitations_generated", extra={"reason_codes": [item["code"] for item in result]})
        return result

    def readiness(self, limitations: list[dict[str, Any]], *, assessed_at: str) -> dict[str, Any]:
        blocking = [item["code"] for item in limitations if item["severity"] == "blocking"]
        warning_codes = [item["code"] for item in limitations if item["severity"] == "warning"]
        fallback_codes = [code for code in warning_codes if code in {"RECENT_TREND_FALLBACK", "COMPONENT_FALLBACK"}]
        caution = [code for code in warning_codes if code not in {"RECENT_TREND_FALLBACK", "COMPONENT_FALLBACK"}]
        if len(fallback_codes) >= self.config.caution_fallback_count:
            caution.extend(fallback_codes)
        if blocking:
            state, reasons = "insufficient_evidence", blocking
        elif caution:
            state, reasons = "review_with_caution", caution
        else:
            state, reasons = "ready_for_human_review", []
        result = {"state": state, "reason_codes": sorted(set(reasons)), "assessed_at": _iso(assessed_at),
                  "ruleset_version": self.config.readiness_ruleset_version}
        logger.info("evidence_readiness_assessed", extra={"readiness_state": state, "reason_codes": result["reason_codes"]})
        return result

    def _missing_essential(self, components: list[dict[str, Any]]) -> bool:
        if not components:
            return False
        return any(any(item.get("name") == name and item.get("missing") for item in components)
                   for name in self.config.essential_components)

    @staticmethod
    def _limitation(code: str, *, affected: Optional[list[str]] = None) -> dict[str, Any]:
        registry = {
            "RECENT_TREND_FALLBACK": ("estimated_value", "warning", "Recent-trend data was unavailable and a configured fallback was used.", "VERIFY_RECENT_TREND_DATA", "Verify recent administrative trend data before approval.", True),
            "COMPONENT_FALLBACK": ("estimated_value", "warning", "A configured fallback was used because an expected source value was unavailable.", "VERIFY_SOURCE_VALUE", "Verify the affected source value before approval.", True),
            "SYNTHETIC_SOURCE": ("synthetic_source", "warning", "Demonstration data influenced this result and is not official statistics.", "VERIFY_WITH_OFFICIAL_DATA", "Replace or corroborate demonstration data with an appropriate source before approval.", True),
            "APPROXIMATE_GEOGRAPHY": ("geographic_precision", "information", "Geography is limited to a privacy-safe administrative area or approximate centroid.", "VERIFY_ADMINISTRATIVE_AREA", "Confirm the administrative area is suitable for this review.", True),
            "SOURCE_UNCLASSIFIED": ("source_classification", "warning", "An important source has no verified classification.", "VERIFY_SOURCE_CLASSIFICATION", "Verify the source classification and provenance before approval.", False),
            "INCOMPLETE_EVIDENCE": ("evidence_completeness", "blocking", "One or more essential score inputs are unavailable.", "OBTAIN_ESSENTIAL_EVIDENCE", "Obtain the missing essential evidence before relying on this score.", False),
            "STALE_DATASET": ("data_recency", "warning", "A supporting dataset is older than the configured recency threshold.", "VERIFY_DATA_RECENCY", "Verify a current source value before approval.", True),
            "FORMULA_COMPONENT_MISMATCH": ("methodology", "blocking", "Score components do not reconcile with the authoritative Action Score within tolerance.", "REVIEW_SCORE_CALCULATION", "Review the scoring calculation and formula version.", False),
        }
        category, severity, message, action_code, action, public_safe = registry[code]
        affected = sorted(set(affected or []))
        unknown = set(affected) - SCORE_COMPONENTS
        if unknown:
            raise ValueError(f"unknown affected score components: {', '.join(sorted(unknown))}")
        return {"code": code, "category": category, "severity": severity, "message": message,
                "affected_components": affected, "reviewer_action_code": action_code,
                "reviewer_action": action, "public_safe": public_safe}
