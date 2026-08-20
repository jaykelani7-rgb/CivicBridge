import os
import sys
import time
from fastapi.testclient import TestClient

# Ensure packages path is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.append(project_root)

from services.api.main import app

def run_integration_test():
    client = TestClient(app)
    
    print("\n=== STEP 1: Verifying Version & Liveness ===")
    res = client.get("/version")
    assert res.status_code == 200
    print(f"Liveness Response: {res.json()}")
    
    print("\n=== STEP 2: Verifying Countries Configuration ===")
    for code in ["IN", "BR", "ZA"]:
        res = client.get(f"/v1/countries/{code}/config")
        assert res.status_code == 200
        print(f"Loaded config for {code} successfully. Categories count: {len(res.json()['taxonomy']['categories'])}")
        
    print("\n=== STEP 3: Submitting Citizen Hindi Request (Simulation) ===")
    payload = {
        "country_code": "IN",
        "channel": "voice",
        "language": "hi",
        "text": "हमारे गाँव में पीने का साफ़ पानी नहीं आ रहा है, कृपया मदद करें।"
    }
    
    res = client.post("/v1/requests", data=payload)
    assert res.status_code == 200
    res_data = res.json()
    req_id = res_data["request_id"]
    print(f"Submitted request. Assigned ID: {req_id}, Initial Status: {res_data['status']}")
    
    # Wait briefly to simulate background task executing
    time.sleep(1)
    
    print("\n=== STEP 4: Checking Citizen Request Processing Status ===")
    res = client.get(f"/v1/requests/{req_id}")
    assert res.status_code == 200
    citizen_view = res.json()
    print(f"Citizen status view: {citizen_view}")
    assert citizen_view["status"] == "completed"
    assert citizen_view["category"] == "water" # Checked by mock logic keying on "water/drinking" translation
    
    print("\n=== STEP 5: Checking Hotspots Map Layer (GeoJSON) ===")
    res = client.get("/v1/hotspots?country=IN")
    assert res.status_code == 200
    geojson = res.json()
    features = geojson["features"]
    print(f"Found {len(features)} active hotspots in India.")
    for feat in features:
        print(f"Hotspot ID: {feat['properties']['hotspot_id']}, Need Score: {feat['properties']['need_score']}, Action Score: {feat['properties']['action_score']}")
        
    # Get the ID of the hotspot that contains our requests
    hotspot_id = features[0]["properties"]["hotspot_id"]
    
    print(f"\n=== STEP 6: Fetching Hotspot Detail & Priority Score Breakdown ({hotspot_id}) ===")
    res = client.get(f"/v1/hotspots/{hotspot_id}")
    assert res.status_code == 200
    detail = res.json()
    print(f"Hotspot detail: {detail['geography_id']} - Sector: {detail['sector']}")
    print(f"Score Breakdown Component Weights: {detail['need_components']}")
    
    print("\n=== STEP 7: Generating Evidence-Backed Project Brief ===")
    res = client.post(f"/v1/hotspots/{hotspot_id}/recommendations")
    assert res.status_code == 200
    rec_data = res.json()
    rec_id = rec_data["recommendation_id"]
    brief = rec_data["brief"]
    print(f"Generated Recommendation ID: {rec_id}")
    print(f"Project Title: {brief['project_title']}")
    print(f"Problem Rationale Claims: {[claim['claim'] for claim in brief['priority_rationale']]}")
    print(f"Target Success Metrics: {brief['success_metrics']}")
    
    print("\n=== STEP 8: Policymaker Decision - Approve Project Recommendation ===")
    decision_payload = {
        "action": "approve",
        "reason": "High demand rate combined with extreme water access gaps in the Old City ward.",
        "actor": "Director of Infrastructure Planning"
    }
    res = client.post(f"/v1/recommendations/{rec_id}/decisions", json=decision_payload)
    assert res.status_code == 200
    dec_res = res.json()
    project_id = dec_res["project_id"]
    print(f"Decision: {dec_res['action']}. Created Project ID: {project_id}")
    
    print("\n=== STEP 9: Tracking Project Impact Loop ===")
    res = client.get(f"/v1/projects/{project_id}/impact")
    assert res.status_code == 200
    impact_data = res.json()
    print(f"Project: {impact_data['title']} (Status: {impact_data['status']})")
    print(f"Initial metrics: {impact_data['metrics']}")
    
    # Update metric
    print("\n=== STEP 10: Updating Project Success Metric ===")
    metric_code = impact_data['metrics'][0]['metric_code']
    update_payload = {
        "metric_code": metric_code,
        "current_value": 75.0,
        "notes": "First milestone reached. Main water supply line repaired."
    }
    res = client.post(f"/v1/projects/{project_id}/impact", json=update_payload)
    assert res.status_code == 200
    
    # Verify update
    res = client.get(f"/v1/projects/{project_id}/impact")
    assert res.status_code == 200
    updated_impact = res.json()
    print(f"Updated metric details: {updated_impact['metrics']}")
    assert updated_impact['metrics'][0]['current'] == 75.0
    
    print("\n==========================================")
    print("  ALL E2E HACKATHON VERIFICATION STEPS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    run_integration_test()
