from pathlib import Path

import pytest

from app.services.decision_metadata import DecisionMetadataConfig, DecisionMetadataService, load_decision_metadata_config


CONFIG = Path(__file__).resolve().parents[2] / "app/config/decision_metadata/decision-metadata-1.0.0.json"


@pytest.fixture
def service():
    return DecisionMetadataService(load_decision_metadata_config(CONFIG))


def hotspot(identifier: str, score: float, confidence: float = 0.8, count: int = 2, country: str = "IN", calculated: str = "2026-08-23T10:00:00Z"):
    return {"hotspot_id": identifier, "country_code": country, "category": "water", "action_score": score,
            "evidence_confidence": confidence, "request_count": count, "calculated_at": calculated, "score_components": []}


def component(name: str, *, missing: bool = False, sources=None):
    return {"name": name, "missing": missing, "source_ids": sources or [], "fallback_used": 50 if missing else None}


def test_priority_ranking_uses_stable_tie_breakers_and_explicit_scope(service):
    rows = [hotspot("b", 70), hotspot("a", 70), hotspot("higher", 71, 0.7, 1)]
    priority = service.priority(rows[1], rows, category_scope="water")
    assert priority["rank"] == 2
    assert priority["total_ranked"] == 3
    assert priority["ranking_scope"] == {"country_code": "IN", "category": "water"}
    assert priority["band"] == "high"


def test_priority_insufficient_evidence_is_not_based_on_rank(service):
    item = hotspot("only", 99, confidence=0.2)
    priority = service.priority(item, [item])
    assert priority["rank"] == 1
    assert priority["band"] == "insufficient_evidence"
    assert priority["band_reason_code"] == "EVIDENCE_REQUIREMENTS_NOT_MET"


def test_invalid_overlapping_priority_config_fails_startup_validation():
    raw = load_decision_metadata_config(CONFIG).model_dump()
    raw["priority_bands"][1]["minimum_action_score"] = raw["priority_bands"][0]["minimum_action_score"]
    with pytest.raises(ValueError):
        DecisionMetadataConfig.model_validate(raw)


def test_probable_duplicates_form_stable_privacy_safe_group(service):
    members = [
        {"request_id": "private-a", "summary": "Masked safe summary.", "occurred_at": "2026-08-01T10:00:00Z",
         "group_relationship": "distinct_theme", "original_language": "pt-BR", "working_language": "en",
         "anonymized_original_summary": "Resumo seguro.", "translation_performed": True,
         "translation_provider": "google-cloud-translation", "evidence_types": ["text"]},
        {"request_id": "private-b", "summary": "Masked safe summary.", "occurred_at": "2026-08-02T10:00:00Z",
         "group_relationship": "probable_duplicate", "original_language": "pt-BR", "working_language": "en",
         "translation_performed": True, "translation_provider": "google-cloud-translation", "evidence_types": ["photo", "historic"]},
    ]
    first = service.evidence_groups("cluster-a", members, hotspot_id="hotspot-a")
    second = service.evidence_groups("cluster-a", list(reversed(members)), hotspot_id="hotspot-a")
    assert first == second
    assert first[0]["report_count"] == 2
    assert first[0]["relationship"] == "probable_duplicate"
    assert first[0]["representative_original_summary"] == "Resumo seguro."
    assert "private-a" not in str(first)


def test_sources_limitations_and_readiness_are_deterministic(service):
    components = [component("recent_trend", missing=True, sources=["demo"]), component("severity", sources=["civicbridge_validated_requests"])]
    enrichment = {"sources": [{"source_id": "demo", "classification": "synthetic_demo", "dataset_title": "Fixture",
                                "publisher": "CivicBridge", "country_code": "IN", "time_coverage": "2026",
                                "retrieved_at": "2026-08-20", "upstream_source_ids": []}]}
    sources = service.sources(enrichment, components, hotspot_id="hotspot-a")
    assert {source["classification"] for source in sources} == {"synthetic_demo", "citizen_aggregate"}
    limitations = service.limitations(components=components, sources=sources,
        geography={"confidence": 0.9, "boundary_source": "administrative centroid"}, warnings=[], created_at="2026-08-23T10:00:00Z")
    assert {item["code"] for item in limitations} >= {"RECENT_TREND_FALLBACK", "SYNTHETIC_SOURCE", "APPROXIMATE_GEOGRAPHY"}
    readiness = service.readiness(limitations, assessed_at="2026-08-23T10:00:00Z")
    assert readiness["state"] == "review_with_caution"
    assert readiness["ruleset_version"] == "evidence-readiness-1.0.0"


def test_essential_missing_component_is_blocking(service):
    limitations = service.limitations(
        components=[component("infrastructure_gap", missing=True)], sources=[],
        geography={"confidence": 1, "boundary_source": "official boundary"}, warnings=[], created_at="2026-08-23T10:00:00Z",
    )
    assert limitations[0]["code"] == "INCOMPLETE_EVIDENCE"
    assert limitations[0]["severity"] == "blocking"
    assert service.readiness(limitations, assessed_at="2026-08-23T10:00:00Z")["state"] == "insufficient_evidence"
