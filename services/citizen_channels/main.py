import os
import sys
import uuid
import datetime
import hmac
import json
import subprocess
import tempfile
import wave
from io import BytesIO
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, status, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Add workspace root to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.append(project_root)

from packages.contracts.envelope import EventEnvelope, StandardErrorResponse, ErrorDetail
from packages.contracts.citizen import (
    CreateRequestPayload,
    LocationApproximate,
    CitizenCorrectionPayload,
    CitizenStatusResponse,
    ContentRetrievalResponse,
    RequestCreatedData,
    RequestConfirmedData
)
from packages.event_bus.bus import event_bus as local_event_bus
from packages.cloud_runtime import PubSubEventBus
from packages.pubsub_push import decode_push_event, verify_push_request
from services.citizen_channels.storage import citizen_storage

event_bus = (
    PubSubEventBus(
        os.getenv("CITIZEN_PUBSUB_PROJECT", ""),
        {
            "request.created.v1": os.getenv("CITIZEN_REQUEST_CREATED_TOPIC", "request-created-v1"),
            "request.confirmed.v1": os.getenv("CITIZEN_REQUEST_CONFIRMED_TOPIC", "request-confirmed-v1"),
        },
    )
    if os.getenv("CITIZEN_EVENT_BUS", "memory") == "pubsub"
    else local_event_bus
)

# Allowed file extensions and maximum size (10 MB)
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
MAX_AUDIO_DURATION_SECONDS = 60


def _verify_internal(token: Optional[str]):
    expected = os.getenv("CITIZEN_INTERNAL_TOKEN", "")
    if expected and not hmac.compare_digest(token or "", expected):
        raise HTTPException(status_code=403, detail="Internal service authentication required")
    if not expected and os.getenv("ENVIRONMENT", "development").lower() == "production":
        raise HTTPException(status_code=503, detail="Internal service token is not configured")


def _validate_media(extension: str, content: bytes):
    if not content or len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=422, detail="Media must be nonempty and at most 10 MB")
    if extension in {".jpg", ".jpeg"} and not content.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=422, detail="Invalid JPEG content")
    if extension == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=422, detail="Invalid PNG content")
    if extension == ".wav":
        try:
            with wave.open(BytesIO(content), "rb") as audio:
                duration = audio.getnframes() / audio.getframerate()
                if duration <= 0 or duration > MAX_AUDIO_DURATION_SECONDS or audio.getnchannels() > 2:
                    raise ValueError("Unsupported recording duration or channel count")
        except (wave.Error, ValueError, ZeroDivisionError, EOFError) as error:
            raise HTTPException(status_code=422, detail="Invalid or overlong WAV recording") from error
    if extension in {".mp3", ".m4a", ".ogg", ".webm"}:
        signatures = {".mp3": (b"ID3", b"\xff"), ".m4a": (b"ftyp",), ".ogg": (b"OggS",), ".webm": (b"\x1a\x45\xdf\xa3",)}
        if not any(signature in content[:12] for signature in signatures[extension]):
            raise HTTPException(status_code=422, detail="Audio content does not match its extension")
        with tempfile.NamedTemporaryFile(suffix=extension) as temporary:
            temporary.write(content); temporary.flush()
            try:
                probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", temporary.name], capture_output=True, text=True, timeout=10, check=True)
                duration = float(json.loads(probe.stdout)["format"]["duration"])
            except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
                raise HTTPException(status_code=422, detail="Audio duration could not be verified") from error
        if duration <= 0 or duration > MAX_AUDIO_DURATION_SECONDS:
            raise HTTPException(status_code=422, detail="Audio exceeds the 60-second limit")

# --- Downstream Event Listeners ---

async def handle_request_normalized(event: EventEnvelope):
    data = event.data
    req_id = data.get("request_id")
    if req_id:
        citizen_storage.update_stage_from_event(
            req_id,
            stage="matching",
            category=data.get("category"),
            public_summary=data.get("summary"),
            normalized_summary=data.get("summary"),
            processing_mode=data.get("processing_mode"),
        )

async def handle_request_needs_review(event: EventEnvelope):
    data = event.data
    req_id = data.get("request_id")
    if req_id:
        processing_failed = data.get("speech_status") == "failed" or data.get("translation_status") == "failed" or data.get("extraction_status") == "failed_fallback"
        citizen_storage.update_stage_from_event(
            req_id,
            stage="processing_failed" if processing_failed else "under_review",
            public_summary="Automated processing could not finish. An analyst can review this report or retry processing." if processing_failed else "This report needs an analyst review before it can be grouped with others.",
            normalized_summary=data.get("summary") if not processing_failed else None,
            processing_mode=data.get("processing_mode"),
        )

async def handle_hotspot_updated(event: EventEnvelope):
    data = event.data
    if citizen_storage.event_seen(event.event_id): return
    citizen_storage.update_for_hotspot(str(data.get("hotspot_id")), [str(item) for item in data.get("request_ids", [])], data.get("action_score"))
    citizen_storage.mark_event(event.event_id)

async def handle_recommendation_created(event: EventEnvelope):
    data = event.data
    if citizen_storage.event_seen(event.event_id): return
    for request_id in citizen_storage.requests_for_hotspot(str(data.get("hotspot_id"))):
        citizen_storage.update_stage_from_event(request_id, "recommended", recommendation_id=data.get("recommendation_id"), public_summary="A proposed response is awaiting human review.")
    citizen_storage.mark_event(event.event_id)

async def handle_policy_decision(event: EventEnvelope):
    data = event.data
    if citizen_storage.event_seen(event.event_id): return
    approved = data.get("action") == "approve_for_assessment"
    for request_id in citizen_storage.requests_for_recommendation(str(data.get("recommendation_id"))):
        citizen_storage.update_stage_from_event(request_id, "policy_approved" if approved else "under_review", public_summary="Approved for project assessment; delivery is not yet verified." if approved else "A human reviewer requested more work on the proposal.")
    citizen_storage.mark_event(event.event_id)


async def handle_project_status(event: EventEnvelope):
    data = event.data
    if citizen_storage.event_seen(event.event_id): return
    project_status = str(data.get("status") or "candidate")
    stage = "project_completed" if project_status == "completed" else "project_cancelled" if project_status == "cancelled" else "project_active"
    summary = "Project delivery is marked complete; measured outcomes remain separate." if project_status == "completed" else "The project candidate was cancelled." if project_status == "cancelled" else "A project candidate is being assessed; no outcome is claimed."
    for request_id in citizen_storage.requests_for_recommendation(str(data.get("recommendation_id"))):
        citizen_storage.update_stage_from_event(request_id, stage, project_id=data.get("project_id"), project_title="Linked project", project_status=project_status, public_summary=summary)
    citizen_storage.mark_event(event.event_id)

async def handle_impact_metric(event: EventEnvelope):
    data = event.data
    if citizen_storage.event_seen(event.event_id): return
    source_type = str(data.get("source_type") or "manual")
    label = "An independently verified" if source_type == "independently_verified" else "A manually entered"
    for request_id in citizen_storage.requests_for_project(str(data.get("project_id"))):
        citizen_storage.update_stage_from_event(
            request_id, "outcome_tracking", outcome_status=data.get("outcome_status"),
            measurement_source_type=source_type,
            public_summary=f"{label} measurement was recorded for the linked project. A change does not establish that the project caused it.",
        )
    citizen_storage.mark_event(event.event_id)

# Register event bus subscribers
event_bus.subscribe("request.normalized.v1", handle_request_normalized)
event_bus.subscribe("request.needs_review.v1", handle_request_needs_review)
event_bus.subscribe("hotspot.updated.v1", handle_hotspot_updated)
event_bus.subscribe("recommendation.created.v1", handle_recommendation_created)
event_bus.subscribe("policy.decision.recorded.v1", handle_policy_decision)
event_bus.subscribe("project.status.updated.v1", handle_project_status)
event_bus.subscribe("impact.metric.updated.v1", handle_impact_metric)

PUSH_HANDLERS = {
    "request.normalized.v1": handle_request_normalized,
    "request.needs_review.v1": handle_request_needs_review,
    "hotspot.updated.v1": handle_hotspot_updated,
    "recommendation.created.v1": handle_recommendation_created,
    "policy.decision.recorded.v1": handle_policy_decision,
    "project.status.updated.v1": handle_project_status,
    "impact.metric.updated.v1": handle_impact_metric,
}

@asynccontextmanager
async def lifespan(_: FastAPI):
    await _replay_unpublished()
    yield


app = FastAPI(
    title="CivicBridge Citizen Channels Service",
    description="Citizen intake, validation, secure media storage, and public status tracking. Owned by Sujal.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from services.citizen_channels.telegram import router as telegram_router
app.include_router(telegram_router)


@app.post("/internal/v1/events/pubsub", status_code=204)
async def receive_status_event_push(request: Request, payload: dict):
    verify_push_request(request)
    event = decode_push_event(payload)
    handler = PUSH_HANDLERS.get(event.event_type)
    if not handler:
        raise HTTPException(400, "Unsupported status event")
    if not citizen_storage.event_seen(event.event_id):
        await handler(event)
        citizen_storage.mark_event(event.event_id)
    return Response(status_code=204)

# --- Endpoints ---

@app.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": "citizen-channels",
        "owner": "Sujal",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


@app.get("/v1/summary")
def get_public_summary():
    """Return aggregate workflow counts only; never citizen content or location."""
    stages: Dict[str, int] = {}
    records = citizen_storage.list_requests()
    for record in records:
        stage = str(record.get("processing_stage", "submitted"))
        stages[stage] = stages.get(stage, 0) + 1
    return {
        "reports_received": len(records),
        "stages": stages,
        "provenance": "live",
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

async def _publish_created(request_id: str, trace_id: str):
    record = citizen_storage.get_request(request_id)
    if not record or record.get("event_published"):
        return
    event_id = record.get("created_event_id")
    if not event_id:
        event_id = str(uuid.uuid4())
        record["created_event_id"] = event_id
        citizen_storage._save(record)
    event = EventEnvelope(
        event_id=event_id, event_type="request.created.v1", producer="citizen-channels", trace_id=trace_id,
        data=RequestCreatedData(
            request_id=request_id, channel=record["channel"], country_code=record["country_code"],
            language_hint=record["language_hint"], content_ref=record["content_ref"],
            location=LocationApproximate(**record["location"]) if record["location"] else None,
            administrative_area=record.get("administrative_area"), consent=record["consent"],
            submitted_at=record["submitted_at"],
        ).model_dump(),
    )
    await event_bus.publish(event)
    citizen_storage.mark_published(request_id)


async def _replay_unpublished() -> int:
    recovered = 0
    for request_id in citizen_storage.unpublished_requests():
        await _publish_created(request_id, str(uuid.uuid4()))
        recovered += 1
    return recovered


@app.post("/internal/v1/events/replay", status_code=200)
async def replay_unpublished_events(x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token")):
    _verify_internal(x_internal_token)
    return {"replayed": await _replay_unpublished()}


# 1. POST /v1/requests - Create request metadata
@app.post("/v1/requests", status_code=status.HTTP_202_ACCEPTED)
async def create_request(
    payload: CreateRequestPayload,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    trace_id: Optional[str] = Header(None, alias="X-Trace-Id")
):
    current_trace_id = trace_id or str(uuid.uuid4())
    
    # Store request
    req_id = citizen_storage.create_request(payload, idempotency_key=idempotency_key)
    record = citizen_storage.get_request(req_id)
    if not record["channel"].endswith("_voice"):
        await _publish_created(req_id, current_trace_id)

    response.headers["X-Trace-Id"] = current_trace_id
    return {
        "request_id": req_id,
        "status": "awaiting_media" if record["channel"].endswith("_voice") and not record.get("event_published") else "accepted",
        "receipt_id": f"RCT-{req_id[:8].upper()}",
        "message": "Citizen request accepted for asynchronous processing.",
        "submitted_at": record["submitted_at"]
    }

# 2. POST /v1/requests/{request_id}/media - Upload private media
@app.post("/v1/requests/{request_id}/media")
async def upload_media(
    request_id: str,
    file: UploadFile = File(...)
):
    if not citizen_storage.has_request(request_id):
        raise HTTPException(
            status_code=404, 
            detail={"error": {"code": "REQUEST_NOT_FOUND", "message": f"Request {request_id} not found."}}
        )

    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_FILE_TYPE", "message": f"File type {ext} not allowed. Supported: {list(ALLOWED_EXTENSIONS)}"}}
        )

    # Read and validate size
    content = await file.read()
    _validate_media(ext, content)

    media_ref = citizen_storage.attach_media(
        req_id=request_id,
        filename=file.filename,
        content=content,
        media_type={".wav":"audio/wav", ".mp3":"audio/mpeg", ".m4a":"audio/mp4", ".ogg":"audio/ogg", ".webm":"audio/webm", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".png":"image/png"}[ext]
    )
    record = citizen_storage.get_request(request_id)
    if record["channel"].endswith("_voice") and not record.get("event_published") and ext in {".wav", ".mp3", ".m4a", ".ogg", ".webm"}:
        await _publish_created(request_id, str(uuid.uuid4()))

    return {
        "request_id": request_id,
        "media_ref": media_ref,
        "filename": file.filename,
        "size_bytes": len(content),
        "status": "uploaded"
    }

# 3. PATCH /v1/requests/{request_id}/confirmation - Confirm request / location
@app.patch("/v1/requests/{request_id}/confirmation")
async def confirm_request(
    request_id: str,
    location: Optional[LocationApproximate] = None,
    notes: Optional[str] = None,
    trace_id: Optional[str] = Header(None, alias="X-Trace-Id")
):
    if not citizen_storage.has_request(request_id):
        raise HTTPException(status_code=404, detail="Request not found")

    updated = citizen_storage.confirm_request(request_id, location=location, notes=notes)
    current_trace_id = trace_id or str(uuid.uuid4())

    # Publish request.confirmed.v1 event
    event = EventEnvelope(
        event_type="request.confirmed.v1",
        producer="citizen-channels",
        trace_id=current_trace_id,
        data=RequestConfirmedData(
            request_id=request_id,
            confirmed_at=updated["confirmed_at"],
            location_confirmed=LocationApproximate(**updated["location"]) if updated.get("location") else None,
            administrative_area=updated.get("administrative_area"),
            citizen_notes=notes
        ).model_dump()
    )
    await event_bus.publish(event)

    return {
        "request_id": request_id,
        "status": "confirmed",
        "confirmed_at": updated["confirmed_at"]
    }

# 4. GET /v1/requests/{request_id}/status - Public-safe status check
@app.get("/v1/requests/{request_id}/status", response_model=CitizenStatusResponse)
def get_request_status(request_id: str):
    status_resp = citizen_storage.get_public_status(request_id)
    if not status_resp:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "REQUEST_NOT_FOUND", "message": f"Request {request_id} not found."}}
        )
    return status_resp

# 5. POST /v1/requests/{request_id}/corrections - Record citizen correction
@app.post("/v1/requests/{request_id}/corrections")
def submit_correction(request_id: str, payload: CitizenCorrectionPayload):
    if not citizen_storage.has_request(request_id):
        raise HTTPException(status_code=404, detail="Request not found")

    citizen_storage.add_correction(request_id, payload)
    return {
        "request_id": request_id,
        "status": "correction_recorded",
        "message": "Citizen correction has been securely attached to the request record."
    }

# 6. GET /internal/v1/requests/{request_id}/content - Authenticated retrieval for AI Normalization (Shreyank)
@app.get("/internal/v1/requests/{request_id}/content", response_model=ContentRetrievalResponse)
def get_internal_content(request_id: str, internal_token: Optional[str] = Header(None, alias="X-Internal-Token")):
    _verify_internal(internal_token)
    content_resp = citizen_storage.get_internal_content(request_id)
    if not content_resp:
        raise HTTPException(status_code=404, detail="Content not found")
    return content_resp


@app.get("/internal/v1/requests/{request_id}/media")
def get_internal_media(request_id: str, media_ref: str, internal_token: Optional[str] = Header(None, alias="X-Internal-Token")):
    _verify_internal(internal_token)
    media = citizen_storage.get_media(request_id, media_ref)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    content, media_type = media
    return Response(content=content, media_type=media_type, headers={"Cache-Control": "private, no-store"})
