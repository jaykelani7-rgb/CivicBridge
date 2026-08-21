from datetime import datetime, timezone

from app.schemas.events import NormalizedRequest
from app.services.duplicates import text_similarity
from tests.conftest import event_payload


def test_semantic_similarity_components():
    assert text_similarity("road flooding during rain","road flooding during rain") == 1
    assert text_similarity("road flooding during rain","school classroom shortage") < 0.2


def test_high_threshold_and_explainable_components(app):
    payload = event_payload("IN")
    request = NormalizedRequest.model_validate(payload["data"])
    geo = app.state.pipeline.geography_provider.resolve("IN",latitude=None,longitude=None,administrative_id=None,location_mentions=request.location_mentions)
    candidates = app.state.pipeline.duplicate_detector.find(request,geo,datetime(2026,8,20,10,30,tzinfo=timezone.utc))
    candidate = candidates[0]
    assert candidate.suggested_action == "auto_attach"
    assert candidate.final_similarity >= 0.85
    assert 0 <= candidate.semantic_similarity <= 1
    assert 0 <= candidate.spatial_similarity <= 1
    assert candidate.match_reason


def test_below_threshold_is_separate(app):
    payload = event_payload("IN")
    payload["data"]["summary"] = "A completely different classroom maintenance concern"
    payload["data"]["requested_outcome"] = "Build more classrooms"
    request = NormalizedRequest.model_validate(payload["data"])
    geo = app.state.pipeline.geography_provider.resolve("IN",latitude=None,longitude=None,administrative_id=None,location_mentions=request.location_mentions)
    candidates = app.state.pipeline.duplicate_detector.find(request,geo,datetime(2026,8,20,10,30,tzinfo=timezone.utc))
    assert candidates[0].suggested_action == "separate"
