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


def test_cannot_create_project_from_unapproved_recommendation():
    # 1. Create recommendation (status: under_review)
    rec_res = client.post(
        "/v1/recommendations",
        json={
            "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
            "evidence_bundle_id": "evb_01J5R4A3_IN",
        },
    )
    rec_id = rec_res.json()["recommendation_id"]

    # 2. Attempt to create project -> should be blocked by human approval gate
    proj_res = client.post(
        "/v1/projects",
        json={"recommendation_id": rec_id, "title": "Unapproved Project Attempt"},
    )
    assert proj_res.status_code == 400
    assert "has not been approved by a human policymaker" in proj_res.json()["detail"]["error"]["message"]


def test_create_project_milestones_and_impact_metrics_success():
    # 1. Create recommendation
    rec_res = client.post(
        "/v1/recommendations",
        json={
            "hotspot_id": "50f27173-1c2d-42d3-82ee-8ef2bfc7ef46",
            "evidence_bundle_id": "evb_01J5R4A3_IN",
        },
    )
    rec_id = rec_res.json()["recommendation_id"]

    # 2. Approve recommendation
    client.post(
        f"/v1/recommendations/{rec_id}/decisions",
        json={
            "action": "approve_for_assessment",
            "reason": "Evidence threshold met",
            "actor_id": "sharmad-policy",
            "actor_role": "decision_maker",
        },
    )

    # 3. Create project candidate
    proj_res = client.post(
        "/v1/projects",
        json={
            "recommendation_id": rec_id,
            "title": "Ward 42 Drainage System Upgrade",
            "assigned_department": "Public Works Department",
        },
    )
    assert proj_res.status_code == 201
    proj_data = proj_res.json()
    proj_id = proj_data["project_id"]
    assert proj_data["status"] == "candidate"
    assert len(proj_data["milestones"]) == 1

    # 4. Add Milestone
    ms_res = client.post(
        f"/v1/projects/{proj_id}/milestones",
        json={
            "title": "Contractor Onboarding",
            "target_date": "2026-10-01T00:00:00Z",
            "notes": "Public tender process",
        },
    )
    assert ms_res.status_code == 201
    assert ms_res.json()["title"] == "Contractor Onboarding"

    # 5. Add Impact Metric
    metric_res = client.post(
        f"/v1/projects/{proj_id}/metrics",
        json={
            "metric_code": "road_flooding_request_rate",
            "baseline": 18.2,
            "target": 5.0,
            "current": 12.4,
            "unit": "requests_per_10000_people_per_month",
            "source_id": "civicbridge_validated_requests",
            "measured_at": "2026-11-20T00:00:00Z",
            "confidence": 0.84,
        },
    )
    assert metric_res.status_code == 201
    metric_data = metric_res.json()
    assert metric_data["outcome_status"] == "improving"
    assert metric_data["baseline"] == 18.2
    assert metric_data["current"] == 12.4

    # 6. Verify event bus emitted project and metric events
    bus = get_event_bus()
    event_types = [e.event_type for e in bus.published_events]
    assert "project.status.updated.v1" in event_types
    assert "impact.metric.updated.v1" in event_types
