import pytest

from tests.conftest import event_payload


@pytest.mark.parametrize("country,cluster_id,geography_id",[
    ("IN","11000000-0000-4000-8000-000000000001","IN-RJ-JPR-W42"),
    ("BR","22000000-0000-4000-8000-000000000001","BR-SP-SAO-GRA"),
    ("ZA","33000000-0000-4000-8000-000000000001","ZA-GP-JHB-SOW"),
])
def test_complete_cross_country_flow_is_idempotent(app,country,cluster_id,geography_id):
    payload=event_payload(country)
    first=app.state.consumer.handle_payload(payload)
    assert first["processing_status"] == "completed"
    assert first["cluster_assignment"] == {"cluster_id":cluster_id,"action":"existing_cluster"}
    assert first["duplicate_candidates"][0]["suggested_action"] == "auto_attach"
    hotspot=app.state.repository.get_hotspot(first["hotspot_id"])
    assert hotspot["geography_id"] == geography_id
    assert 0 <= hotspot["need_score"] <= 100 and 0 <= hotspot["action_score"] <= 100
    assert app.state.repository.get_evidence(first["hotspot_id"])["bundle_hash"].startswith("sha256:")
    assert app.state.publisher.events[-1]["trace_id"] == payload["trace_id"]
    second=app.state.consumer.handle_payload(payload)
    assert second["idempotent_replay"] is True
    assert app.state.repository.get_hotspot(first["hotspot_id"])["unique_request_count"] == 2
