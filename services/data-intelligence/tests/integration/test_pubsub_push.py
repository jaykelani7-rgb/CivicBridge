import base64
import json
import logging

from app.domain.errors import DependencyError
from tests.conftest import event_payload

ENDPOINT = "/pubsub/request-normalized"


def wrapped(event=None, *, data=None, message_id="pubsub-message-1"):
    if data is None:
        data = base64.b64encode(json.dumps(event or event_payload("IN")).encode("utf-8")).decode("ascii")
    return {
        "message": {
            "data": data,
            "messageId": message_id,
            "publishTime": "2026-08-20T10:31:00Z",
            "attributes": {"event_type": "request.normalized.v1"},
        },
        "subscription": "projects/test/subscriptions/data-intelligence-normalized",
    }


def test_valid_wrapped_message_is_processed_before_204(client, app):
    payload = event_payload("IN")
    response = client.post(ENDPOINT, json=wrapped(payload))
    assert response.status_code == 204
    assert response.content == b""
    processed = app.state.repository.get_processed_event(payload["event_id"])
    assert processed["status"] == "completed"
    assert len(app.state.publisher.events) == 1


def test_invalid_base64_returns_400(client):
    response = client.post(ENDPOINT, json=wrapped(data="not-valid-%%%"))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PUBSUB_DATA_INVALID_BASE64"


def test_invalid_json_returns_400(client):
    data = base64.b64encode(b"not json").decode("ascii")
    response = client.post(ENDPOINT, json=wrapped(data=data))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PUBSUB_DATA_INVALID_JSON"


def test_missing_message_data_returns_400(client):
    payload = wrapped(event_payload("IN"))
    del payload["message"]["data"]
    response = client.post(ENDPOINT, json=payload)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "PUBSUB_ENVELOPE_INVALID"


def test_contract_validation_failure_returns_400(client):
    event = event_payload("IN")
    event["event_type"] = "request.created.v1"
    response = client.post(ENDPOINT, json=wrapped(event))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NORMALIZED_REQUEST_INVALID"


def test_success_delegates_to_existing_consumer(client, app, monkeypatch):
    captured = []
    monkeypatch.setattr(app.state.consumer, "handle_event", lambda event: captured.append(event) or {})
    response = client.post(ENDPOINT, json=wrapped(event_payload("BR")))
    assert response.status_code == 204
    assert captured[0].event_type == "request.normalized.v1"
    assert captured[0].data.country_code == "BR"


def test_transient_processing_failure_returns_503_for_retry(client, app, monkeypatch):
    def unavailable(event):
        raise DependencyError("temporary dependency failure")

    monkeypatch.setattr(app.state.consumer, "handle_event", unavailable)
    response = client.post(ENDPOINT, json=wrapped(event_payload("ZA")))
    assert response.status_code == 503
    assert response.json()["error"]["retryable"] is True


def test_duplicate_delivery_is_idempotent_and_safely_logged(client, app, caplog):
    payload = event_payload("IN")
    with caplog.at_level(logging.INFO, logger="civicbridge.data_intelligence"):
        first = client.post(ENDPOINT, json=wrapped(payload, message_id="delivery-1"))
        embedding_count = app.state.repository.connection.execute(
            "SELECT COUNT(*) FROM request_embeddings"
        ).fetchone()[0]
        second = client.post(ENDPOINT, json=wrapped(payload, message_id="delivery-2"))
    assert first.status_code == second.status_code == 204
    assert app.state.repository.connection.execute("SELECT COUNT(*) FROM processed_events").fetchone()[0] == 1
    assert app.state.repository.connection.execute("SELECT COUNT(*) FROM request_embeddings").fetchone()[0] == embedding_count
    assert app.state.repository.connection.execute("SELECT COUNT(*) FROM hotspots_daily").fetchone()[0] == 1
    assert len(app.state.publisher.events) == 1
    duplicate_records = [record for record in caplog.records if getattr(record,"duplicate_delivery",False)]
    assert duplicate_records
    assert duplicate_records[-1].pubsub_message_id == "delivery-2"
    assert duplicate_records[-1].event_id == payload["event_id"]
    assert duplicate_records[-1].event_version == "1.0.0"
