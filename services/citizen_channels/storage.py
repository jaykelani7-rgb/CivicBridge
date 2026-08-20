import os
import uuid
import datetime
from typing import Dict, Any, Optional, List
from packages.contracts.citizen import (
    CreateRequestPayload,
    LocationApproximate,
    ConsentPayload,
    CitizenCorrectionPayload,
    CitizenStatusResponse,
    ContentRetrievalResponse
)

class CitizenStorage:
    def __init__(self, media_dir: str = "data/media"):
        self.media_dir = media_dir
        os.makedirs(self.media_dir, exist_ok=True)
        
        # Primary in-memory stores
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.idempotency_records: Dict[str, str] = {} # idempotency_key -> request_id
        self.corrections: Dict[str, List[Dict[str, Any]]] = {} # request_id -> list of corrections

    def create_request(self, payload: CreateRequestPayload, idempotency_key: Optional[str] = None) -> str:
        if idempotency_key and idempotency_key in self.idempotency_records:
            return self.idempotency_records[idempotency_key]

        req_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        content_ref = f"private://citizen-content/{req_id}"

        record = {
            "request_id": req_id,
            "channel": payload.channel,
            "country_code": payload.country_code,
            "language_hint": payload.language_hint,
            "location": payload.location.model_dump(),
            "consent": payload.consent.model_dump(),
            "text": payload.text,
            "media_ref": None,
            "media_type": None,
            "submitted_at": now,
            "confirmed_at": None,
            "content_ref": content_ref,
            # Lifecycle tracking
            "processing_stage": "submitted",
            "category": None,
            "public_summary": None,
            "hotspot_score": None,
            "project_title": None,
            "project_status": None,
        }

        self.requests[req_id] = record

        if idempotency_key:
            self.idempotency_records[idempotency_key] = req_id

        return req_id

    def attach_media(self, req_id: str, filename: str, content: bytes, media_type: str) -> str:
        if req_id not in self.requests:
            raise KeyError(f"Request {req_id} not found")

        ext = os.path.splitext(filename)[1].lower()
        saved_filename = f"{req_id}{ext}"
        saved_path = os.path.join(self.media_dir, saved_filename)

        with open(saved_path, "wb") as f:
            f.write(content)

        media_ref = f"private://citizen-media/{saved_filename}"
        self.requests[req_id]["media_ref"] = media_ref
        self.requests[req_id]["media_type"] = media_type
        return media_ref

    def confirm_request(self, req_id: str, location: Optional[LocationApproximate] = None, notes: Optional[str] = None) -> Dict[str, Any]:
        if req_id not in self.requests:
            raise KeyError(f"Request {req_id} not found")

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.requests[req_id]["confirmed_at"] = now
        if location:
            self.requests[req_id]["location"] = location.model_dump()
        if notes:
            self.requests[req_id]["confirmation_notes"] = notes
        return self.requests[req_id]

    def add_correction(self, req_id: str, payload: CitizenCorrectionPayload):
        if req_id not in self.requests:
            raise KeyError(f"Request {req_id} not found")
        if req_id not in self.corrections:
            self.corrections[req_id] = []
        
        self.corrections[req_id].append({
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "reason": payload.reason,
            "suggested_category": payload.suggested_category,
            "notes": payload.notes
        })

    def get_public_status(self, req_id: str) -> Optional[CitizenStatusResponse]:
        req = self.requests.get(req_id)
        if not req:
            return None

        return CitizenStatusResponse(
            request_id=req["request_id"],
            channel=req["channel"],
            country_code=req["country_code"],
            submitted_at=req["submitted_at"],
            processing_stage=req["processing_stage"],
            public_summary=req.get("public_summary"),
            category=req.get("category"),
            hotspot_score=req.get("hotspot_score"),
            project_title=req.get("project_title"),
            project_status=req.get("project_status"),
            pii_masked=True
        )

    def get_internal_content(self, req_id: str) -> Optional[ContentRetrievalResponse]:
        req = self.requests.get(req_id)
        if not req:
            return None

        return ContentRetrievalResponse(
            request_id=req["request_id"],
            channel=req["channel"],
            language_hint=req["language_hint"],
            country_code=req["country_code"],
            text=req.get("text"),
            media_ref=req.get("media_ref"),
            media_type=req.get("media_type"),
            submitted_at=req["submitted_at"]
        )

    def update_stage_from_event(self, req_id: str, stage: str, **kwargs):
        if req_id in self.requests:
            self.requests[req_id]["processing_stage"] = stage
            for k, v in kwargs.items():
                if v is not None:
                    self.requests[req_id][k] = v

# Global storage instance for citizen channels
citizen_storage = CitizenStorage()
