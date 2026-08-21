import json

from tests.conftest import event_payload


def test_fixture_loader_is_rerunnable(app):
    from app.adapters.local.fixtures import load_fixtures
    before=app.state.repository.dataset_counts()
    load_fixtures(app.state.repository,app.state.settings.resolved_fixture_dir(),app.state.settings.country_packs)
    assert app.state.repository.dataset_counts() == before


def test_worker_accepts_bytes_and_publishes_after_storage(app):
    result=app.state.consumer.handle_payload(json.dumps(event_payload("BR")).encode())
    assert result["processing_status"] == "completed"
    event=app.state.publisher.events[-1]
    assert app.state.repository.get_evidence(result["hotspot_id"])
    assert event["event_type"] == "hotspot.updated.v1"


def test_provenance_is_joined(app):
    result=app.state.consumer.handle_payload(event_payload("ZA"))
    bundle=app.state.repository.get_evidence(result["hotspot_id"])
    assert bundle["data_sources"]
    assert all(source["publisher"] and source["retrieved_at"] for source in bundle["data_sources"])
    assert all(record["source_id"] for record in bundle["demographic_features"]+bundle["infrastructure_gap_records"])
