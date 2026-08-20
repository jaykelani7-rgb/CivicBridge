import os
import sys
import uuid
import datetime
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, status, Response
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
from packages.event_bus.bus import event_bus
from services.citizen_channels.storage import citizen_storage

# Allowed file extensions and maximum size (10 MB)
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

# --- Downstream Event Listeners ---

async def handle_request_normalized(event: EventEnvelope):
    data = event.data
    req_id = data.get("request_id")
    if req_id:
        citizen_storage.update_stage_from_event(
            req_id,
            stage="normalizing",
            category=data.get("category"),
            public_summary=data.get("summary")
        )

async def handle_request_needs_review(event: EventEnvelope):
    data = event.data
    req_id = data.get("request_id")
    if req_id:
        citizen_storage.update_stage_from_event(
            req_id,
            stage="under_review",
            public_summary="Under analyst review."
        )

async def handle_hotspot_updated(event: EventEnvelope):
    data = event.data
    # When a hotspot score is published, update all associated requests
    # In an event-driven system, the hotspot event or request mapping allows score tracking
    pass

async def handle_recommendation_created(event: EventEnvelope):
    data = event.data
    pass

async def handle_policy_decision(event: EventEnvelope):
    data = event.data
    pass

# Register event bus subscribers
event_bus.subscribe("request.normalized.v1", handle_request_normalized)
event_bus.subscribe("request.needs_review.v1", handle_request_needs_review)
event_bus.subscribe("hotspot.updated.v1", handle_hotspot_updated)
event_bus.subscribe("recommendation.created.v1", handle_recommendation_created)
event_bus.subscribe("policy.decision.recorded.v1", handle_policy_decision)

app = FastAPI(
    title="CivicBridge Citizen Channels Service",
    description="Citizen intake, validation, secure media storage, and public status tracking. Owned by Sujal.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints ---

@app.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": "citizen-channels",
        "owner": "Sujal",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

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
    record = citizen_storage.requests[req_id]

    # Publish request.created.v1 event
    event = EventEnvelope(
        event_type="request.created.v1",
        producer="citizen-channels",
        trace_id=current_trace_id,
        data=RequestCreatedData(
            request_id=req_id,
            channel=record["channel"],
            country_code=record["country_code"],
            language_hint=record["language_hint"],
            content_ref=record["content_ref"],
            location=LocationApproximate(**record["location"]),
            consent=record["consent"],
            submitted_at=record["submitted_at"]
        ).model_dump()
    )
    await event_bus.publish(event)

    response.headers["X-Trace-Id"] = current_trace_id
    return {
        "request_id": req_id,
        "status": "accepted",
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
    if request_id not in citizen_storage.requests:
        raise HTTPException(
            status_code=404, 
            detail={"error": {"code": "REQUEST_NOT_FOUND", "message": f"Request {request_id} not found."}}
        )

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_FILE_TYPE", "message": f"File type {ext} not allowed. Supported: {list(ALLOWED_EXTENSIONS)}"}}
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": f"File size exceeds 10MB limit."}}
        )

    media_ref = citizen_storage.attach_media(
        req_id=request_id,
        filename=file.filename,
        content=content,
        media_type=file.content_type or "application/octet-stream"
    )

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
    if request_id not in citizen_storage.requests:
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
            location_confirmed=LocationApproximate(**updated["location"]),
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
    if request_id not in citizen_storage.requests:
        raise HTTPException(status_code=404, detail="Request not found")

    citizen_storage.add_correction(request_id, payload)
    return {
        "request_id": request_id,
        "status": "correction_recorded",
        "message": "Citizen correction has been securely attached to the request record."
    }

# 6. GET /internal/v1/requests/{request_id}/content - Authenticated retrieval for AI Normalization (Shreyank)
@app.get("/internal/v1/requests/{request_id}/content", response_model=ContentRetrievalResponse)
def get_internal_content(request_id: str):
    content_resp = citizen_storage.get_internal_content(request_id)
    if not content_resp:
        raise HTTPException(status_code=404, detail="Content not found")
    return content_resp
