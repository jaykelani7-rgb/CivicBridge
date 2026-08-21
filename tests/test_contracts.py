from packages.contracts import (
    EventEnvelope,
    ImpactMetric,
    PolicyAction,
    PolicyDecision,
    Project,
    ProjectStatus,
    Recommendation,
    RecommendationStatus,
    StandardErrorResponse,
)


def test_event_envelope_contract():
    event = EventEnvelope(
        event_type="recommendation.created.v1",
        producer="policy-impact",
        data={"test": "payload"},
    )
    assert event.event_type == "recommendation.created.v1"
    assert event.producer == "policy-impact"
    assert event.event_id is not None
    assert event.trace_id is not None


def test_standard_error_contract():
    err = StandardErrorResponse(
        error={
            "code": "TEST_ERROR",
            "message": "Sample error message",
            "retryable": True,
            "details": [],
            "trace_id": "tr-12345",
        }
    )
    assert err.error.code == "TEST_ERROR"
    assert err.error.retryable is True


def test_recommendation_contract():
    rec = Recommendation(
        recommendation_id="rec-001",
        hotspot_id="hs-001",
        evidence_bundle_id="evb-001",
        title="Sample Recommendation",
        problem="Problem statement",
        proposed_intervention="Intervention detail",
        intended_beneficiaries=5000,
        supporting_evidence_ids=["src-1", "src-2"],
        confidence=0.9,
        created_at="2026-08-20T10:00:00Z",
        updated_at="2026-08-20T10:00:00Z",
    )
    assert rec.status == RecommendationStatus.UNDER_REVIEW
    assert rec.human_approved is False
    assert len(rec.supporting_evidence_ids) == 2


def test_policy_decision_contract():
    dec = PolicyDecision(
        decision_id="dec-001",
        recommendation_id="rec-001",
        action=PolicyAction.APPROVE_FOR_ASSESSMENT,
        reason="Approved for engineering assessment",
        actor_id="usr-pol-01",
        actor_role="decision_maker",
        decided_at="2026-08-20T10:05:00Z",
    )
    assert dec.action == PolicyAction.APPROVE_FOR_ASSESSMENT
    assert dec.actor_role == "decision_maker"
