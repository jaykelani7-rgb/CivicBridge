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


def test_record_policy_decision_approve():
    # 1. Create recommendation
    rec_res = client.post(
        "/v1/recommendations",
        json={
            "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
            "evidence_bundle_id": "evb_01J5R4A3_IN",
        },
    )
    rec_id = rec_res.json()["recommendation_id"]

    # 2. Record human decision
    dec_payload = {
        "action": "approve_for_assessment",
        "reason": "Evidence threshold met. Engineering feasibility study required.",
        "actor_id": "sharmad-policy-reviewer",
        "actor_role": "decision_maker",
    }
    dec_res = client.post(f"/v1/recommendations/{rec_id}/decisions", json=dec_payload)
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["action"] == "approve_for_assessment"
    assert dec_data["actor_id"] == "sharmad-policy-reviewer"

    # 3. Check updated recommendation status
    rec_after = client.get(f"/v1/recommendations/{rec_id}").json()
    assert rec_after["status"] == "approved_for_assessment"
    assert rec_after["human_approved"] is True

    # 4. Check event bus
    bus = get_event_bus()
    events = [e for e in bus.published_events if e.event_type == "policy.decision.recorded.v1"]
    assert len(events) == 1
    assert events[0].data["recommendation_status"] == "approved_for_assessment"


def test_assign_recommendation_department():
    rec_res = client.post(
        "/v1/recommendations",
        json={
            "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
            "evidence_bundle_id": "evb_01J5R4A3_IN",
        },
    )
    rec_id = rec_res.json()["recommendation_id"]

    assign_res = client.post(
        f"/v1/recommendations/{rec_id}/assignments",
        json={"department": "Public Works Department", "reviewer": "Jay Analyst"},
    )
    assert assign_res.status_code == 200
    rec_data = assign_res.json()
    assert rec_data["assigned_department"] == "Public Works Department"
    assert rec_data["assigned_reviewer"] == "Jay Analyst"
    assert rec_data["status"] == "assigned"
