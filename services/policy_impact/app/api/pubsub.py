import base64
import binascii
import json
import logging

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from packages.contracts import EventEnvelope, RecommendationCreateRequest
from services.policy_impact.app.api.recommendations import service

router = APIRouter()
logger = logging.getLogger("policy-impact.pubsub")


class PubSubMessage(BaseModel):
    data: str
    message_id: str = Field(alias="messageId")


class PubSubEnvelope(BaseModel):
    message: PubSubMessage
    subscription: str


class HotspotUpdatedData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hotspot_id: str
    country_code: str
    geography_id: str
    category: str
    request_count: int = Field(ge=0)
    unique_request_count: int = Field(ge=0)
    affected_population: int = Field(ge=0)
    trend_30d: float
    need_score: float = Field(ge=0, le=100)
    action_score: float = Field(ge=0, le=100)
    evidence_confidence: float = Field(ge=0, le=1)
    score_version: str
    evidence_bundle_id: str
    calculated_at: str


@router.post("/pubsub/hotspot-updated", status_code=204)
def consume_hotspot(payload: dict, request: Request):
    message_id = event_id = event_type = None
    try:
        wrapped = PubSubEnvelope.model_validate(payload)
        message_id = wrapped.message.message_id
        raw = base64.b64decode(wrapped.message.data, validate=True)
        event = EventEnvelope.model_validate(json.loads(raw))
        if event.event_type != "hotspot.updated.v1" or event.schema_version != "1.0.0":
            raise ValueError("unsupported event")
        data = HotspotUpdatedData.model_validate(event.data)
        event_id, event_type = event.event_id, event.event_type
    except (ValidationError, ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError, binascii.Error):
        logger.warning("pubsub_event_rejected", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "permanent_failure"})
        return Response(status_code=400)

    ledger = request.app.state.delivery_ledger
    try:
        claim = ledger.begin(event_id, event_type, data.hotspot_id, event.schema_version) if ledger else "acquired"
        if claim == "duplicate":
            logger.info("pubsub_event_processed", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "success", "duplicate_delivery": True})
            return Response(status_code=204)
        if claim != "acquired":
            return Response(status_code=503)
        service.create_recommendation(RecommendationCreateRequest(
            hotspot_id=data.hotspot_id,
            evidence_bundle_id=data.evidence_bundle_id,
        ))
        if ledger:
            ledger.complete(event_id)
    except Exception as exc:
        if ledger:
            try:
                ledger.fail(event_id, "DEPENDENCY_UNAVAILABLE")
            except Exception:
                pass
        logger.warning("pubsub_event_failed", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "transient_failure", "error_code": type(exc).__name__})
        return Response(status_code=503)

    logger.info("pubsub_event_processed", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "success", "duplicate_delivery": False})
    return Response(status_code=204)
