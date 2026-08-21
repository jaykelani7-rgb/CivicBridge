import pytest
from pydantic import ValidationError

from packages.contracts.envelope import EventEnvelope
from packages.contracts.normalization import NormalizedRequestData


def _valid_payload(**overrides):
    payload = dict(
        request_id="84b50f3f-52c9-4ac5-bef0-03cc1ea43168",
        country_code="IN",
        original_language="hi-IN",
        transcript_original="...",
        translation_working="The road floods whenever it rains.",
        category="drainage",
        subcategory="clogged_drain",
        summary="Recurring road flooding is blocking access during rain.",
        problem_description="...",
        requested_outcome="Repair or add drainage beside the road.",
        urgency="high",
        affected_scope="community",
        location_mentions=["Ward 42", "Jaipur"],
        evidence_types=["voice", "repeat_report"],
        confidence=0.91,
        pii_flags=["none"],
        needs_human_review=True,
        review_reason="high_urgency_requires_review",
        model="mock-rule-engine",
        prompt_version="normalize-1.0.0",
        schema_version="normalized-request-1.0.0",
    )
    payload.update(overrides)
    return payload


def test_normalized_request_data_matches_contract_shape():
    """
    Matches the exact example payload in contract.md Section 8.2 ("Normalized request").
    """
    data = NormalizedRequestData(**_valid_payload())
    assert data.request_id == "84b50f3f-52c9-4ac5-bef0-03cc1ea43168"
    assert data.category == "drainage"
    assert data.schema_version == "normalized-request-1.0.0"


def test_normalized_request_data_requires_core_fields():
    payload = _valid_payload()
    del payload["category"]
    with pytest.raises(ValidationError):
        NormalizedRequestData(**payload)


def test_event_envelope_wraps_normalized_request_data():
    result = NormalizedRequestData(**_valid_payload())
    event = EventEnvelope(
        event_type="request.normalized.v1",
        producer="ai-normalization",
        data=result.model_dump(),
    )
    assert event.event_type == "request.normalized.v1"
    assert event.producer == "ai-normalization"
    assert event.data["category"] == "drainage"
    assert event.event_id  # idempotency key must always be populated
    assert event.trace_id


def test_needs_review_event_type_for_flagged_records():
    result = NormalizedRequestData(**_valid_payload(needs_human_review=True, review_reason="low_confidence:0.20<0.60"))
    event = EventEnvelope(
        event_type="request.needs_review.v1",
        producer="ai-normalization",
        data=result.model_dump(),
    )
    assert event.event_type == "request.needs_review.v1"
    assert event.data["needs_human_review"] is True
