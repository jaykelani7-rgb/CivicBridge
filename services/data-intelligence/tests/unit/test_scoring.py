from datetime import datetime, timezone

from app.services.scoring import clamp


def test_scoring_formula_is_exact_and_deterministic(app):
    engine = app.state.pipeline.scoring
    members = app.state.repository.get_cluster_members("11000000-0000-4000-8000-000000000001")
    enrichment = app.state.repository.get_enrichment("IN-RJ-JPR-W42","drainage")
    now = datetime(2026,8,20,tzinfo=timezone.utc)
    first = engine.calculate(members,enrichment,0.88,now)
    second = engine.calculate(members,enrichment,0.88,now)
    assert first == second
    lookup = {c.name:c.normalized_value for c in first.components}
    expected_need = sum(lookup[k]*v for k,v in engine.config["need_weights"].items())
    expected_action = 0.60*expected_need + 0.20*lookup["strategic_alignment"] + 0.10*lookup["delivery_readiness"] + 0.10*lookup["data_confidence"] - lookup["existing_coverage_penalty"]
    assert first.need_score == round(clamp(expected_need),2)
    assert first.action_score == round(clamp(expected_action),2)


def test_missing_data_uses_documented_fallback_and_reduces_confidence(app):
    engine = app.state.pipeline.scoring
    members = app.state.repository.get_cluster_members("11000000-0000-4000-8000-000000000001")
    complete = app.state.repository.get_enrichment("IN-RJ-JPR-W42","drainage")
    missing = {"demographic":None,"infrastructure":None,"projects":[],"sources":[]}
    now = datetime(2026,8,20,tzinfo=timezone.utc)
    good = engine.calculate(members,complete,0.9,now)
    poor = engine.calculate(members,missing,0.9,now)
    assert poor.evidence_confidence < good.evidence_confidence
    assert any(c.missing and c.fallback_used is not None for c in poor.components)
    assert poor.warnings


def test_scores_are_clamped():
    assert clamp(-10) == 0
    assert clamp(110) == 100
