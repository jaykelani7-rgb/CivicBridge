"""Validated Pub/Sub push envelopes for independently deployed services."""
import base64
import binascii
import hmac
import json
import os

from fastapi import HTTPException, Request

from packages.contracts.envelope import EventEnvelope


def verify_push_request(request: Request) -> None:
    audience = os.getenv("PUBSUB_PUSH_AUDIENCE", "")
    service_account = os.getenv("PUBSUB_PUSH_SERVICE_ACCOUNT", "")
    token = request.headers.get("Authorization", "")
    if audience and service_account and token.startswith("Bearer "):
        from google.auth.transport.requests import Request as GoogleRequest
        from google.oauth2 import id_token
        try:
            claims = id_token.verify_oauth2_token(token[7:], GoogleRequest(), audience=audience)
            if claims.get("email") == service_account and claims.get("email_verified"):
                return
        except Exception:
            pass
        raise HTTPException(403, "Unverified Pub/Sub push identity")
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise HTTPException(503, "Pub/Sub push identity is not configured")
    expected = os.getenv("CITIZEN_INTERNAL_TOKEN", "")
    if expected and hmac.compare_digest(request.headers.get("X-Internal-Token", ""), expected):
        return
    raise HTTPException(403, "Pub/Sub push authorization required")


def decode_push_event(payload: dict) -> EventEnvelope:
    message = payload.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("data"), str):
        raise HTTPException(400, "Invalid Pub/Sub push envelope")
    try:
        encoded = message["data"]
        if len(encoded) > 2_000_000:
            raise ValueError("Event too large")
        raw = json.loads(base64.b64decode(encoded, validate=True))
        return EventEnvelope.model_validate(raw)
    except (binascii.Error, ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(400, "Invalid Pub/Sub event") from error
