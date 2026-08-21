import pytest
from fastapi.testclient import TestClient
from packages.event_bus import get_event_bus
from services.policy_impact.app.database import get_repository
from services.policy_impact.app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    repo = get_repository()
    repo.clear()
    bus = get_event_bus()
    bus.clear()
    yield


def test_create_recommendation_success():
    payload = {
        "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
        "evidence_bundle_id": "evb_01J5R4A3_IN",
        "title": "Ward 42 Drainage Assessment",
    }
    response = client.post("/v1/recommendations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Ward 42 Drainage Assessment"
    assert data["status"] == "under_review"
    assert data["ai_draft"] is True
    assert data["human_approved"] is False

    # Check event bus
    bus = get_event_bus()
    assert len(bus.published_events) == 1
    assert bus.published_events[0].event_type == "recommendation.created.v1"


def test_create_recommendation_unsupported_citations_rejected():
    payload = {
        "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
        "evidence_bundle_id": "evb_01J5R4A3_IN",
        "title": "Fake Citation Draft",
        "override_draft": True,
        "manual_fields": {
            "title": "Fake Citation Draft",
            "problem": "Test problem",
            "proposed_intervention": "Test intervention",
            "intended_beneficiaries": 1000,
            "supporting_evidence_ids": ["UNSUPPORTED_FAKE_ID_123"],
            "confidence": 0.9,
        },
    }
    response = client.post("/v1/recommendations", json=payload)
    assert response.status_code == 400
    err = response.json()
    assert "UNSUPPORTED_FAKE_ID_123" in err["detail"]["error"]["message"]


def test_get_recommendation_not_found():
    response = client.get("/v1/recommendations/non-existent-id")
    assert response.status_code == 404
