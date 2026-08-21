from copy import deepcopy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.events import EventEnvelope, HotspotUpdatedEvent, NormalizedRequest
from tests.conftest import event_payload


def test_request_normalized_fixture_deserializes():
    event = EventEnvelope[NormalizedRequest].model_validate(event_payload("IN"))
    assert event.event_type == "request.normalized.v1"
    assert event.data.schema_version == "normalized-request-1.0.0"


def test_all_country_pack_normalized_examples_deserialize():
    fixture_root=Path(__file__).resolve().parents[2]/"fixtures"
    paths=[fixture_root/"india"/"normalized_requests.json",fixture_root/"brazil"/"normalized_requests.json",
           fixture_root/"south_africa"/"normalized_requests.json"]
    examples=[item for path in paths for item in json.loads(path.read_text(encoding="utf-8"))]
    parsed=[EventEnvelope[NormalizedRequest].model_validate(item) for item in examples]
    assert len(parsed) == 6
    assert {item.data.country_code for item in parsed} == {"IN","BR","ZA"}


def test_required_field_missing_fails_clearly():
    payload = event_payload()
    del payload["data"]["request_id"]
    with pytest.raises(ValidationError) as exc:
        EventEnvelope[NormalizedRequest].model_validate(payload)
    assert "request_id" in str(exc.value)


@pytest.mark.parametrize("path,value",[("envelope","2.0.0"),("payload","normalized-request-2.0.0")])
def test_unsupported_schema_version_fails(path,value):
    payload = event_payload()
    if path == "envelope": payload["schema_version"] = value
    else: payload["data"]["schema_version"] = value
    with pytest.raises(ValidationError):
        EventEnvelope[NormalizedRequest].model_validate(payload)


def test_produced_event_matches_shared_and_policy_consumer_shape(app):
    result = app.state.consumer.handle_payload(event_payload("IN"))
    produced = app.state.publisher.events[-1]
    event = HotspotUpdatedEvent.model_validate(produced)
    assert str(event.data.hotspot_id) == result["hotspot_id"]
    required_by_policy = {"hotspot_id","country_code","geography_id","category","request_count","unique_request_count",
                          "affected_population","trend_30d","need_score","action_score","evidence_confidence","score_version",
                          "evidence_bundle_id","calculated_at"}
    assert required_by_policy <= event.data.model_dump().keys()
