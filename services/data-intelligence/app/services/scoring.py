from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Optional

from app.domain.errors import DomainError
from app.domain.models import Component, ScoreResult


def clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


class ScoringEngine:
    def __init__(self, config_path: Path) -> None:
        try:
            self.config = json.loads(config_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise DomainError("SCORE_CONFIGURATION_INVALID", "The score configuration cannot be loaded.") from exc
        if abs(sum(self.config["need_weights"].values()) - 1) > 1e-9 or abs(sum(self.config["action_weights"].values()) - 1) > 1e-9:
            raise DomainError("SCORE_CONFIGURATION_INVALID", "Score weights must sum to one.")

    def calculate(self, members: list[dict[str, Any]], enrichment: dict[str, Any], location_confidence: float, now: Optional[datetime] = None) -> ScoreResult:
        calculated = (now or datetime.now(timezone.utc)).isoformat().replace("+00:00", "Z")
        demographic = enrichment.get("demographic") or {}
        infrastructure = enrichment.get("infrastructure") or {}
        projects = enrichment.get("projects") or []
        sources = enrichment.get("sources") or []
        source_ids = sorted({s["source_id"] for s in sources})
        population = demographic.get("population")
        request_rate = len(members) / population * 10000 if population else None
        urgency_values = [self.config["severity"].get(m["urgency"], 50) for m in members]
        severity = 0.8 * mean(urgency_values) + 0.2 * max(urgency_values) if urgency_values else None
        oldest = min(datetime.fromisoformat(m["occurred_at"].replace("Z", "+00:00")) for m in members)
        newest = max(datetime.fromisoformat(m["occurred_at"].replace("Z", "+00:00")) for m in members)
        history_days = (newest - oldest).total_seconds() / 86400
        trend = None if history_days < self.config["trend_minimum_history_days"] else min(1.0, len(members) / max(1.0, history_days / 30) - 1.0)
        freshness = mean([1.0 if s["freshness_status"] == "current" else 0.6 for s in sources]) if sources else 0.0
        reliability = mean([s["confidence"] for s in sources]) if sources else 0.0
        completeness_fields = [population, demographic.get("equity_vulnerability"), infrastructure.get("infrastructure_gap")]
        completeness = sum(x is not None for x in completeness_fields) / len(completeness_fields)
        corroboration = min(1.0, len(members) / 3)
        request_confidence = mean([m["request_confidence"] for m in members]) if members else 0.0
        evidence_confidence = clamp(100 * (0.25*request_confidence + 0.20*location_confidence + 0.20*completeness + 0.15*freshness + 0.10*reliability + 0.10*corroboration))
        data_confidence = clamp(100 * (0.45*completeness + 0.30*freshness + 0.25*reliability))
        project = projects[0] if projects else {}
        raw = {
            "demand_rate": request_rate,
            "infrastructure_gap": infrastructure.get("infrastructure_gap"),
            "severity": severity,
            "equity_vulnerability": demographic.get("equity_vulnerability"),
            "affected_population": population,
            "recent_trend": trend,
            "evidence_confidence": evidence_confidence,
            "strategic_alignment": project.get("strategic_alignment"),
            "delivery_readiness": project.get("delivery_readiness"),
            "data_confidence": data_confidence,
            "existing_coverage_penalty": project.get("existing_coverage_penalty"),
        }
        caps = self.config["normalization"]
        normalized = {
            "demand_rate": clamp((request_rate or 0) / caps["demand_rate_per_10000_cap"] * 100) if request_rate is not None else None,
            "infrastructure_gap": raw["infrastructure_gap"], "severity": severity,
            "equity_vulnerability": raw["equity_vulnerability"],
            "affected_population": clamp((population or 0) / caps["affected_population_cap"] * 100) if population is not None else None,
            "recent_trend": clamp((trend or 0) / caps["trend_growth_cap"] * 100) if trend is not None else None,
            "evidence_confidence": evidence_confidence,
            "strategic_alignment": raw["strategic_alignment"], "delivery_readiness": raw["delivery_readiness"],
            "data_confidence": data_confidence, "existing_coverage_penalty": raw["existing_coverage_penalty"],
        }
        warnings: list[str] = []
        missing_count = 0
        components: list[Component] = []
        all_weights = {**self.config["need_weights"], **{k:v for k,v in self.config["action_weights"].items() if k != "need_score"}, "existing_coverage_penalty": -1.0}
        for name, weight in all_weights.items():
            value = normalized.get(name)
            missing = value is None
            fallback = None
            if missing:
                fallback = float(self.config["fallbacks"][name])
                value = fallback
                missing_count += 1
                warnings.append(f"{name} was missing; fallback {fallback:g} applied and confidence reduced.")
            component_sources = source_ids if name not in {"severity","demand_rate","recent_trend","evidence_confidence"} else ["civicbridge_validated_requests"]
            components.append(Component(name=name, raw_value=raw.get(name), normalized_value=round(float(value),4), weight=weight,
                weighted_contribution=round(float(value)*weight,4), source_ids=component_sources, missing=missing,
                fallback_used=fallback, confidence=round(max(0.0, data_confidence/100 - (0.1 if missing else 0)),4),
                formula_version=self.config["version"], calculated_at=calculated))
        lookup = {c.name:c.normalized_value for c in components}
        need = sum(lookup[name]*weight for name,weight in self.config["need_weights"].items())
        action = (0.60*need + 0.20*lookup["strategic_alignment"] + 0.10*lookup["delivery_readiness"] +
                  0.10*lookup["data_confidence"] - lookup["existing_coverage_penalty"])
        confidence_penalty = missing_count * self.config["missing_confidence_penalty"]
        return ScoreResult(need_score=round(clamp(need),2), action_score=round(clamp(action),2),
            evidence_confidence=round(max(0.0,evidence_confidence/100-confidence_penalty),4),
            data_confidence=round(max(0.0,data_confidence/100-confidence_penalty),4), components=components,
            warnings=warnings, version=self.config["version"], calculated_at=calculated)
