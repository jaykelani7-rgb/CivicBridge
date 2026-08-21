from uuid import uuid4

from tests.conftest import event_payload


def _process(client,country="IN",payload=None):
    payload = payload or event_payload(country)
    return client.post(f"/internal/v1/intelligence/requests/{payload['data']['request_id']}/process",json=payload)


def test_health_and_openapi(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["dataset_fixture_status"]["counts"]["admin_units"] == 6
    assert client.get("/openapi.json").status_code == 200


def test_process_list_detail_score_and_evidence(client):
    response = _process(client)
    assert response.status_code == 200, response.text
    result = response.json()
    hotspot_id = result["hotspot_id"]
    listing = client.get("/v1/hotspots",params={"country_code":"IN","category":"drainage","min_need_score":0,"page_size":1})
    assert listing.status_code == 200
    assert listing.json()["pagination"]["total"] == 1
    assert client.get(f"/v1/hotspots/{hotspot_id}").json()["hotspot"]["hotspot_id"] == hotspot_id
    score = client.get(f"/v1/hotspots/{hotspot_id}/score").json()
    assert score["components"] and all("weighted_contribution" in x for x in score["components"])
    evidence = client.get(f"/v1/hotspots/{hotspot_id}/evidence").json()
    assert evidence["bundle_hash"].startswith("sha256:")
    assert evidence["evidence_bundle_id"] == result["evidence_bundle_id"]


def test_duplicate_delivery_is_idempotent(client,app):
    payload = event_payload("IN")
    first = _process(client,payload=payload)
    second = _process(client,payload=payload)
    assert first.status_code == second.status_code == 200
    assert second.json()["idempotent_replay"] is True
    hotspot = app.state.repository.get_hotspot(first.json()["hotspot_id"])
    assert hotspot["unique_request_count"] == 2
    assert len(app.state.publisher.events) == 1


def test_recalculation_versions_and_idempotency(client,app):
    hotspot_id = _process(client).json()["hotspot_id"]
    trace_id,key = str(uuid4()),"recalc-key-0001"
    body={"reason":"Approved fixture refresh","requested_score_version":"priority-1.0.0","trace_id":trace_id}
    first = client.post(f"/internal/v1/hotspots/{hotspot_id}/recalculate",json=body,headers={"Idempotency-Key":key})
    second = client.post(f"/internal/v1/hotspots/{hotspot_id}/recalculate",json=body,headers={"Idempotency-Key":key})
    assert first.status_code == second.status_code == 200
    assert first.json()["hotspot_version"] == 2
    assert second.json()["idempotent_replay"] is True
    versions = app.state.repository.connection.execute("SELECT COUNT(*) FROM hotspot_versions WHERE hotspot_id=?",(hotspot_id,)).fetchone()[0]
    assert versions == 2


def test_pending_review_does_not_create_hotspot(client,app):
    payload=event_payload("IN")
    payload["data"]["needs_human_review"] = True
    payload["data"]["review_reason"] = "Location needs analyst confirmation"
    response = _process(client,payload=payload)
    assert response.status_code == 200
    assert response.json()["processing_status"] == "pending_review"
    assert response.json()["hotspot_id"] is None
    assert app.state.repository.connection.execute("SELECT COUNT(*) FROM hotspots_daily").fetchone()[0] == 0


def test_standard_error_envelope(client):
    payload=event_payload("IN")
    response=client.post("/internal/v1/intelligence/requests/not-the-body-id/process",json=payload)
    assert response.status_code == 400
    error=response.json()["error"]
    assert error["code"] == "NORMALIZED_REQUEST_INVALID"
    assert set(error) == {"code","message","retryable","details","trace_id"}


def test_failed_event_status_and_code_are_preserved(client,app,monkeypatch):
    payload=event_payload("IN")
    monkeypatch.setattr(app.state.pipeline.public_data_repository,"get_enrichment",
                        lambda geography_id,category:{"demographic":None,"infrastructure":None,"projects":[],"sources":[]})
    response=_process(client,payload=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PUBLIC_DATA_NOT_AVAILABLE"
    stored=app.state.repository.get_processed_event(payload["event_id"])
    assert stored["status"] == "failed"
    assert stored["error_code"] == "PUBLIC_DATA_NOT_AVAILABLE"


def test_health_reports_dependency_state(client,app):
    app.state.publisher.available=False
    health=client.get("/health").json()
    assert health["status"] == "degraded"
    assert health["event_bus_connectivity"] is False


def test_pipeline_continues_and_identifies_lexical_fallback(client, app):
    from app.adapters.similarity.lexical import LexicalSimilarityProvider
    from app.domain.errors import TransientSimilarityProviderError
    from app.domain.models import ProviderMetadata
    from app.services.similarity import CachedSimilarityService

    class FailingVertex:
        metadata = ProviderMetadata("vertex", "gemini-embedding-001", 768, "v1")
        def embed_many(self, documents):
            raise TransientSimilarityProviderError("temporary")
        def similarity(self, left, right):
            raise AssertionError("not reached")

    app.state.pipeline.duplicate_detector.similarity_service = CachedSimilarityService(
        app.state.repository, FailingVertex(), LexicalSimilarityProvider(768), 0.88, 0.78
    )
    response = _process(client)
    assert response.status_code == 200
    result = response.json()
    assert result["processing_status"] == "completed"
    assert result["similarity_processing"]["provider"] == "lexical"
    assert result["similarity_processing"]["degraded"] is True
    assert result["duplicate_candidates"][0]["degraded_similarity"] is True
