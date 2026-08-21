from __future__ import annotations

import hashlib
import json
import re
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.domain.errors import DomainError


EMAIL = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
PHONE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")


def anonymize_summary(value: str) -> str:
    return PHONE.sub("[redacted phone]", EMAIL.sub("[redacted email]", value))[:500]


def build_evidence_bundle(
    *, hotspot: dict[str, Any], geography: dict[str, Any], members: list[dict[str, Any]],
    components: list[dict[str, Any]], enrichment: dict[str, Any], bundle_version: int,
    created_at: str, warnings: list[str],
) -> tuple[str, str, dict[str, Any]]:
    # Deliberately omit exact coordinates, raw statements, media, and contact data.
    body = {
        "hotspot_id": hotspot["hotspot_id"],
        "hotspot_snapshot": {k: hotspot[k] for k in [
            "hotspot_id","country_code","geography_id","spatial_cell","category","request_count",
            "unique_request_count","corroboration_count","affected_population","trend_30d",
            "need_score","action_score","evidence_confidence","score_version","calculated_at",
        ]},
        "geography": {k: geography[k] for k in [
            "geography_id","country_code","admin1","admin2","locality","spatial_cell",
            "confidence","boundary_source","boundary_version",
        ]},
        "score_explanation": components,
        "representative_anonymized_request_summaries": [anonymize_summary(x["summary"]) for x in members[-5:]],
        "request_and_cluster_evidence_ids": [x["request_id"] for x in members],
        "demographic_features": [enrichment["demographic"]] if enrichment.get("demographic") else [],
        "infrastructure_gap_records": [enrichment["infrastructure"]] if enrichment.get("infrastructure") else [],
        "existing_facility_records": ([{
            "feature_id": enrichment["infrastructure"]["feature_id"],
            "existing_facility_coverage": enrichment["infrastructure"].get("existing_facility_coverage"),
            "source_id": enrichment["infrastructure"]["source_id"],
        }] if enrichment.get("infrastructure") else []),
        "investment_plan_records": enrichment.get("projects", []),
        "data_sources": enrichment.get("sources", []),
        "missing_information": [w.split(" was missing",1)[0] for w in warnings if " was missing" in w],
        "known_limitations": [
            "Demo source records marked synthetic are realistic fixtures, not official public statistics.",
            "Spatial cells and administrative centroids are approximate and unsuitable for household-level decisions.",
            *warnings,
        ],
        "bundle_version": bundle_version,
        "created_at": created_at,
    }
    for section in ("demographic_features", "infrastructure_gap_records", "investment_plan_records"):
        for record in body[section]:
            if record and not record.get("source_id"):
                raise DomainError("EVIDENCE_BUNDLE_INVALID", "An evidence value is missing source provenance.")
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    bundle_id = "evb_" + uuid5(NAMESPACE_URL, f"{hotspot['hotspot_id']}:{bundle_version}:{digest}").hex[:20]
    bundle = {"evidence_bundle_id": bundle_id, **body, "bundle_hash": f"sha256:{digest}"}
    return bundle_id, digest, bundle
