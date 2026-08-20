import os
import sys
import pytest
import io
import asyncio
from fastapi.testclient import TestClient

# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.append(project_root)

from services.citizen_channels.main import app
from packages.contracts.envelope import EventEnvelope
from packages.event_bus.bus import event_bus

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "citizen-channels"
    assert data["owner"] == "Sujal"

def test_create_request_success():
    payload = {
        "channel": "web_text",
        "country_code": "IN",
        "language_hint": "hi-IN",
        "location": {
            "precision": "approximate",
            "latitude": 26.9124,
            "longitude": 75.7873,
            "admin_hint": "Jaipur"
        },
        "consent": {
            "accepted": True,
            "version": "2026-08-01"
        },
        "text": "हमारे गाँव में पीने का साफ़ पानी नहीं आ रहा है, कृपया मदद करें।"
    }
    
    response = client.post("/v1/requests", json=payload, headers={"Idempotency-Key": "test-key-001"})
    assert response.status_code == 202
    data = response.json()
    assert "request_id" in data
    assert data["status"] == "accepted"
    assert "receipt_id" in data

    # Test Idempotency: same key should return the same request_id
    idempotent_resp = client.post("/v1/requests", json=payload, headers={"Idempotency-Key": "test-key-001"})
    assert idempotent_resp.status_code == 202
    assert idempotent_resp.json()["request_id"] == data["request_id"]

def test_create_request_consent_required():
    payload = {
        "channel": "web_text",
        "country_code": "IN",
        "language_hint": "hi-IN",
        "location": {
            "precision": "approximate",
            "latitude": 26.9124,
            "longitude": 75.7873
        },
        "consent": {
            "accepted": False,
            "version": "2026-08-01"
        },
        "text": "Need street repair"
    }
    
    response = client.post("/v1/requests", json=payload)
    assert response.status_code == 422 # Validation error

def test_media_upload_and_internal_retrieval():
    # 1. Create a request
    payload = {
        "channel": "web_voice",
        "country_code": "BR",
        "language_hint": "pt-BR",
        "location": {
            "precision": "approximate",
            "latitude": -22.982,
            "longitude": -43.251
        },
        "consent": {
            "accepted": True,
            "version": "2026-08-01"
        }
    }
    create_resp = client.post("/v1/requests", json=payload)
    req_id = create_resp.json()["request_id"]

    # 2. Upload audio file
    fake_audio_content = b"RIFF....WAVEfmt ....data...."
    file_tuple = ("voice_note.wav", io.BytesIO(fake_audio_content), "audio/wav")
    
    upload_resp = client.post(
        f"/v1/requests/{req_id}/media",
        files={"file": file_tuple}
    )
    assert upload_resp.status_code == 200
    upload_data = upload_resp.json()
    assert upload_data["status"] == "uploaded"
    assert "private://citizen-media/" in upload_data["media_ref"]

    # 3. Shreyank's AI Normalization layer fetches content via internal endpoint
    internal_resp = client.get(f"/internal/v1/requests/{req_id}/content")
    assert internal_resp.status_code == 200
    content_data = internal_resp.json()
    assert content_data["request_id"] == req_id
    assert content_data["media_ref"] == upload_data["media_ref"]

def test_media_upload_invalid_type_rejected():
    payload = {
        "channel": "web_voice",
        "country_code": "ZA",
        "language_hint": "en-ZA",
        "location": {"latitude": -33.92, "longitude": 18.42},
        "consent": {"accepted": True, "version": "2026-08-01"}
    }
    req_id = client.post("/v1/requests", json=payload).json()["request_id"]

    # Attempt uploading .exe file
    file_tuple = ("malicious.exe", io.BytesIO(b"binary"), "application/octet-stream")
    upload_resp = client.post(f"/v1/requests/{req_id}/media", files={"file": file_tuple})
    assert upload_resp.status_code == 422

def test_public_status_and_downstream_event_updates():
    # 1. Create request
    payload = {
        "channel": "web_text",
        "country_code": "IN",
        "language_hint": "en-IN",
        "location": {"latitude": 26.91, "longitude": 75.78},
        "consent": {"accepted": True, "version": "2026-08-01"},
        "text": "Street drain broken"
    }
    req_id = client.post("/v1/requests", json=payload).json()["request_id"]

    # 2. Check initial public status
    status_resp = client.get(f"/v1/requests/{req_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["processing_stage"] == "submitted"
    assert status_resp.json()["pii_masked"] is True

    # 3. Simulate Shreyank's AI Normalization publishing request.normalized.v1 event
    async def simulate_event():
        event = EventEnvelope(
            event_type="request.normalized.v1",
            producer="ai-normalization",
            data={
                "request_id": req_id,
                "category": "drainage",
                "summary": "Reported broken street drainage requiring repair."
            }
        )
        await event_bus.publish(event)

    asyncio.run(simulate_event())

    # 4. Verify public status was updated reactively
    updated_status = client.get(f"/v1/requests/{req_id}/status")
    assert updated_status.status_code == 200
    data = updated_status.json()
    assert data["processing_stage"] == "normalizing"
    assert data["category"] == "drainage"
    assert data["public_summary"] == "Reported broken street drainage requiring repair."

def test_citizen_correction():
    payload = {
        "channel": "web_text",
        "country_code": "IN",
        "language_hint": "hi-IN",
        "location": {"latitude": 26.91, "longitude": 75.78},
        "consent": {"accepted": True, "version": "2026-08-01"},
        "text": "Report"
    }
    req_id = client.post("/v1/requests", json=payload).json()["request_id"]

    correction_payload = {
        "reason": "AI tagged category as roads but it is actually water leakage",
        "suggested_category": "water"
    }
    corr_resp = client.post(f"/v1/requests/{req_id}/corrections", json=correction_payload)
    assert corr_resp.status_code == 200
    assert corr_resp.json()["status"] == "correction_recorded"

if __name__ == "__main__":
    pytest.main(["-v", __file__])
