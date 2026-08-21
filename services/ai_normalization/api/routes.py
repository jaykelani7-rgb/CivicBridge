import base64
import binascii
import json
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, Request, Response, status
from pydantic import BaseModel, Field, ValidationError

from packages.contracts.citizen import RequestConfirmedData, RequestCreatedData
from packages.contracts.envelope import EventEnvelope
from packages.cloud_runtime import cloud_run_headers
from packages.contracts.normalization import NormalizedRequestData

from services.ai_normalization.api.errors import NormalizationAPIError
from services.ai_normalization.pipeline.normalization_service import (
    NormalizationNeverRunError,
    RequestNotFoundError,
)

router = APIRouter()
logger = logging.getLogger("ai-normalization.pubsub")


class PubSubMessage(BaseModel):
    data: str
    message_id: str = Field(alias="messageId")


class PubSubEnvelope(BaseModel):
    message: PubSubMessage
    subscription: str


class NormalizeRequestBody(BaseModel):
    request_id: str = Field(..., description="Citizen request ID assigned by Citizen Channels")
    force: bool = Field(False, description="Re-run the pipeline even if a result is already cached")


class NormalizationResponse(BaseModel):
    request_id: str
    status: str = Field(..., description="normalized | needs_review")
    attempts: int
    updated_at: str
    result: NormalizedRequestData


class PolicyBriefDraftRequest(BaseModel):
    hotspot_id: str
    evidence_bundle_id: str
    evidence_bundle: Dict[str, Any]


def _error(code: str, message: str, http_status: int, trace_id: str, retryable: bool = False, details: Optional[list] = None):
    raise NormalizationAPIError(code, message, http_status, trace_id, retryable=retryable, details=details)


def _record_to_response(request_id: str, record) -> NormalizationResponse:
    return NormalizationResponse(
        request_id=request_id,
        status=record.status,
        attempts=record.attempts,
        updated_at=record.updated_at,
        result=record.result,
    )


@router.get("/health")
def health(request: Request):
    settings = request.app.state.settings
    dependency_ok = None
    try:
        import httpx

        resp = httpx.get(
            f"{settings.CITIZEN_CHANNELS_URL}/health",
            headers=cloud_run_headers(settings.CITIZEN_CHANNELS_URL, settings.AUTHENTICATE_CLOUD_RUN),
            timeout=1.5,
        )
        dependency_ok = resp.status_code == 200
    except Exception:
        dependency_ok = False

    return {
        "status": "healthy",
        "service": "ai-normalization",
        "owner": settings.SERVICE_OWNER,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
        "use_mock_services": settings.USE_MOCK_SERVICES,
        "model_config": {
            "gemini_model": settings.GEMINI_MODEL_NAME,
            "gcp_project_configured": bool(settings.GCP_PROJECT_ID),
            "confidence_review_threshold": settings.CONFIDENCE_REVIEW_THRESHOLD,
            "schema_version": settings.SCHEMA_VERSION,
            "prompt_version": settings.PROMPT_VERSION,
        },
        "dependencies": {
            "citizen_channels_reachable": dependency_ok,
            "citizen_channels_url": settings.CITIZEN_CHANNELS_URL,
        },
    }


@router.post("/pubsub/citizen-events", status_code=204)
def consume_citizen_event(payload: dict, request: Request):
    message_id = event_id = request_id = event_type = None
    try:
        wrapped = PubSubEnvelope.model_validate(payload)
        message_id = wrapped.message.message_id
        raw = base64.b64decode(wrapped.message.data, validate=True)
        event = EventEnvelope.model_validate(json.loads(raw))
        if event.schema_version != "1.0.0" or event.event_type not in {"request.created.v1", "request.confirmed.v1"}:
            raise ValueError("unsupported event")
        model = RequestCreatedData if event.event_type == "request.created.v1" else RequestConfirmedData
        validated_data = model.model_validate(event.data)
        event_id, event_type = event.event_id, event.event_type
        request_id = validated_data.request_id
    except (ValidationError, ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError, binascii.Error):
        logger.warning("pubsub_event_rejected", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "permanent_failure"})
        return Response(status_code=400)

    ledger = request.app.state.delivery_ledger
    try:
        claim = ledger.begin(event_id, event_type, request_id, event.schema_version) if ledger else "acquired"
        if claim == "duplicate":
            logger.info("pubsub_event_processed", extra={"pubsub_message_id": message_id, "event_id": event_id, "event_type": event_type, "result": "success", "duplicate_delivery": True})
            return Response(status_code=204)
        if claim != "acquired":
            return Response(status_code=503)
        location_hint = (
            validated_data.location.admin_hint
            if event.event_type == "request.created.v1"
            else validated_data.location_confirmed.admin_hint
        )
        request.app.state.service.normalize_request(
            request_id,
            force=False,
            trace_id=event.trace_id,
            location_hints=[location_hint] if location_hint else None,
        )
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


@router.post("/internal/v1/normalizations", response_model=NormalizationResponse)
def create_normalization(
    body: NormalizeRequestBody,
    request: Request,
    response: Response,
    trace_id: Optional[str] = Header(None, alias="X-Trace-Id"),
):
    current_trace_id = trace_id or str(uuid.uuid4())
    service = request.app.state.service
    try:
        record, was_new = service.normalize_request(body.request_id, force=body.force, trace_id=current_trace_id)
    except RequestNotFoundError:
        _error(
            "NORMALIZATION_SOURCE_NOT_FOUND",
            f"Citizen request {body.request_id} could not be retrieved from Citizen Channels.",
            status.HTTP_404_NOT_FOUND,
            current_trace_id,
        )
    response.headers["X-Trace-Id"] = current_trace_id
    response.status_code = status.HTTP_201_CREATED if was_new else status.HTTP_200_OK
    return _record_to_response(body.request_id, record)


@router.get("/internal/v1/normalizations/{request_id}", response_model=NormalizationResponse)
def get_normalization(request_id: str, request: Request):
    service = request.app.state.service
    record = service.get(request_id)
    if not record:
        _error(
            "NORMALIZATION_NOT_FOUND",
            f"No normalization result exists yet for request {request_id}.",
            status.HTTP_404_NOT_FOUND,
            str(uuid.uuid4()),
        )
    return _record_to_response(request_id, record)


@router.post("/internal/v1/normalizations/{request_id}/retry", response_model=NormalizationResponse)
def retry_normalization(
    request_id: str,
    request: Request,
    trace_id: Optional[str] = Header(None, alias="X-Trace-Id"),
):
    current_trace_id = trace_id or str(uuid.uuid4())
    service = request.app.state.service
    try:
        record = service.retry(request_id)
    except NormalizationNeverRunError:
        _error(
            "NORMALIZATION_NOT_FOUND",
            f"Request {request_id} has never been normalized; call POST /internal/v1/normalizations first.",
            status.HTTP_404_NOT_FOUND,
            current_trace_id,
        )
    except RequestNotFoundError:
        _error(
            "NORMALIZATION_SOURCE_NOT_FOUND",
            f"Citizen request {request_id} could not be retrieved from Citizen Channels on retry.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
            current_trace_id,
            retryable=True,
        )
    return _record_to_response(request_id, record)


@router.post("/internal/v1/policy-briefs/draft")
def generate_policy_brief_draft(body: PolicyBriefDraftRequest, request: Request):
    drafter = request.app.state.policy_brief_drafter
    return drafter.generate_draft(body.hotspot_id, body.evidence_bundle_id, body.evidence_bundle)
