"""Private citizen records. SQLite is local development; PostgreSQL is shared production storage."""
import datetime
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from packages.contracts.citizen import (
    CitizenCorrectionPayload, CitizenStatusResponse, ContentRetrievalResponse,
    CreateRequestPayload, LocationApproximate,
)


class CitizenStorage:
    def __init__(self, media_dir: Optional[str] = None, database_url: Optional[str] = None, media_bucket: Optional[str] = None):
        self.database_url = database_url or os.getenv("CITIZEN_DATABASE_URL", "data/citizen_channels.db")
        self.media_dir = media_dir or os.getenv("CITIZEN_MEDIA_DIR", "data/media")
        self.media_bucket = media_bucket if media_bucket is not None else os.getenv("CITIZEN_MEDIA_BUCKET", "")
        self.postgres = self.database_url.startswith(("postgres://", "postgresql://"))
        if os.getenv("ENVIRONMENT", "development").lower() == "production" and (not self.postgres or not self.media_bucket):
            raise RuntimeError("Production citizen storage requires CITIZEN_DATABASE_URL (PostgreSQL) and CITIZEN_MEDIA_BUCKET")
        if not self.postgres:
            Path(self.database_url).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        if not self.media_bucket:
            Path(self.media_dir).mkdir(parents=True, exist_ok=True)
        self.requests: Dict[str, Dict[str, Any]] = {}  # compatibility cache, never authoritative
        self.idempotency_records: Dict[str, str] = {}
        self.corrections: Dict[str, List[Dict[str, Any]]] = {}
        self._init_db()

    def _sql(self, statement: str) -> str:
        return statement.replace("?", "%s") if self.postgres else statement

    @contextmanager
    def _db(self):
        if self.postgres:
            import psycopg
            connection = psycopg.connect(self.database_url)
        else:
            connection = sqlite3.connect(self.database_url, timeout=30)
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _init_db(self):
        with self._db() as connection:
            cursor = connection.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS citizen_requests (request_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, idempotency_key TEXT UNIQUE)")
            cursor.execute("CREATE TABLE IF NOT EXISTS citizen_media (media_ref TEXT PRIMARY KEY, request_id TEXT NOT NULL, storage_key TEXT NOT NULL, filename TEXT NOT NULL, media_type TEXT NOT NULL, size_bytes INTEGER NOT NULL)")
            cursor.execute("CREATE TABLE IF NOT EXISTS citizen_event_receipts (event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL)")
            cursor.execute("CREATE TABLE IF NOT EXISTS citizen_channel_sessions (channel_id TEXT PRIMARY KEY, data_json TEXT NOT NULL)")

    def _read(self, request_id: str) -> Optional[Dict[str, Any]]:
        with self._db() as connection:
            row = connection.cursor().execute(self._sql("SELECT data_json FROM citizen_requests WHERE request_id = ?"), (request_id,)).fetchone()
        record = json.loads(row[0]) if row else None
        if record:
            self.requests[request_id] = record
        return record

    def _save(self, record: Dict[str, Any]):
        with self._db() as connection:
            connection.cursor().execute(self._sql("UPDATE citizen_requests SET data_json = ? WHERE request_id = ?"), (json.dumps(record), record["request_id"]))
        self.requests[record["request_id"]] = record

    def list_requests(self) -> List[Dict[str, Any]]:
        with self._db() as connection:
            rows = connection.cursor().execute("SELECT data_json FROM citizen_requests").fetchall()
        return [json.loads(row[0]) for row in rows]

    def has_request(self, request_id: str) -> bool:
        return self._read(request_id) is not None

    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        return self._read(request_id)

    def mark_published(self, request_id: str):
        record = self._read(request_id)
        if record:
            record["event_published"] = True
            record["processing_stage"] = "submitted"
            self._save(record)

    def create_request(self, payload: CreateRequestPayload, idempotency_key: Optional[str] = None) -> str:
        if idempotency_key:
            with self._db() as connection:
                row = connection.cursor().execute(self._sql("SELECT request_id FROM citizen_requests WHERE idempotency_key = ?"), (idempotency_key,)).fetchone()
            if row:
                self._read(row[0]); return row[0]
        request_id = str(uuid.uuid4())
        submitted_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        record = {
            "request_id": request_id, "channel": payload.channel, "country_code": payload.country_code,
            "language_hint": payload.language_hint, "location": payload.location.model_dump() if payload.location else None,
            "administrative_area": payload.administrative_area, "consent": payload.consent.model_dump(),
            "text": payload.text, "media_ref": None, "media_type": None, "media": [],
            "submitted_at": submitted_at, "confirmed_at": None,
            "content_ref": f"private://citizen-content/{request_id}",
            "processing_stage": "awaiting_media" if payload.channel.endswith("_voice") else "submitted", "event_published": False, "category": None, "public_summary": None,
            "created_event_id": str(uuid.uuid4()),
            "hotspot_score": None, "hotspot_id": None, "recommendation_id": None,
            "project_id": None, "project_title": None, "project_status": None,
            "normalized_summary": None, "processing_mode": None, "outcome_status": None, "measurement_source_type": None,
            "corrections": [],
        }
        try:
            with self._db() as connection:
                connection.cursor().execute(self._sql("INSERT INTO citizen_requests(request_id,data_json,idempotency_key) VALUES(?,?,?)"), (request_id, json.dumps(record), idempotency_key))
        except Exception as error:
            if not idempotency_key:
                raise
            with self._db() as connection:
                row = connection.cursor().execute(self._sql("SELECT request_id FROM citizen_requests WHERE idempotency_key = ?"), (idempotency_key,)).fetchone()
            if not row:
                raise error
            self._read(row[0]); return row[0]
        self.requests[request_id] = record
        if idempotency_key:
            self.idempotency_records[idempotency_key] = request_id
        return request_id

    def attach_media(self, req_id: str, filename: str, content: bytes, media_type: str) -> str:
        record = self._read(req_id)
        if not record:
            raise KeyError(f"Request {req_id} not found")
        extension = Path(filename).suffix.lower()
        storage_key = f"citizen/{req_id}/{uuid.uuid4()}{extension}"
        if self.media_bucket:
            from google.cloud import storage
            storage.Client().bucket(self.media_bucket).blob(storage_key).upload_from_string(content, content_type=media_type)
        else:
            path = Path(self.media_dir) / storage_key
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "wb") as output:
                os.chmod(path, 0o600)
                output.write(content)
        media_ref = f"private://citizen-media/{storage_key}"
        with self._db() as connection:
            connection.cursor().execute(self._sql("INSERT INTO citizen_media(media_ref,request_id,storage_key,filename,media_type,size_bytes) VALUES(?,?,?,?,?,?)"), (media_ref, req_id, storage_key, filename, media_type, len(content)))
        item = {"media_ref": media_ref, "filename": filename, "media_type": media_type, "size_bytes": len(content)}
        record.setdefault("media", []).append(item)
        if media_type.startswith("audio/") and not record.get("media_ref"):
            record["media_ref"] = media_ref
            record["media_type"] = media_type
        self._save(record)
        return media_ref

    def get_media(self, request_id: str, media_ref: str) -> Optional[tuple[bytes, str]]:
        with self._db() as connection:
            row = connection.cursor().execute(self._sql("SELECT storage_key,media_type FROM citizen_media WHERE request_id = ? AND media_ref = ?"), (request_id, media_ref)).fetchone()
        if not row:
            return None
        storage_key, media_type = row
        if self.media_bucket:
            from google.cloud import storage
            content = storage.Client().bucket(self.media_bucket).blob(storage_key).download_as_bytes()
        else:
            content = (Path(self.media_dir) / storage_key).read_bytes()
        return content, media_type

    def confirm_request(self, req_id: str, location: Optional[LocationApproximate] = None, notes: Optional[str] = None) -> Dict[str, Any]:
        record = self._read(req_id)
        if not record:
            raise KeyError(req_id)
        record["confirmed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if location:
            record["location"] = location.model_dump()
        if notes:
            record["confirmation_notes"] = notes
        self._save(record)
        return record

    def add_correction(self, req_id: str, payload: CitizenCorrectionPayload):
        record = self._read(req_id)
        if not record:
            raise KeyError(req_id)
        item = {"timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(), **payload.model_dump()}
        record.setdefault("corrections", []).append(item)
        self._save(record)
        self.corrections[req_id] = record["corrections"]

    def get_public_status(self, req_id: str) -> Optional[CitizenStatusResponse]:
        record = self._read(req_id)
        if not record:
            return None
        return CitizenStatusResponse(**record, report_confirmed=bool(record.get("confirmed_at")), pii_masked=True)

    def get_internal_content(self, req_id: str) -> Optional[ContentRetrievalResponse]:
        record = self._read(req_id)
        if not record:
            return None
        return ContentRetrievalResponse(**record)

    def update_stage_from_event(self, req_id: str, stage: str, **kwargs):
        record = self._read(req_id)
        if not record:
            return
        record["processing_stage"] = stage
        for key, value in kwargs.items():
            if value is not None:
                record[key] = value
        self._save(record)

    def update_for_hotspot(self, hotspot_id: str, request_ids: List[str], score: Optional[float]):
        for request_id in request_ids:
            self.update_stage_from_event(request_id, "hotspot_aggregated", hotspot_id=hotspot_id, hotspot_score=score, public_summary="Grouped with related reports for review.")

    def requests_for_hotspot(self, hotspot_id: str) -> List[str]:
        return [record["request_id"] for record in self.list_requests() if record.get("hotspot_id") == hotspot_id]

    def requests_for_recommendation(self, recommendation_id: str) -> List[str]:
        return [record["request_id"] for record in self.list_requests() if record.get("recommendation_id") == recommendation_id]

    def requests_for_project(self, project_id: str) -> List[str]:
        return [record["request_id"] for record in self.list_requests() if record.get("project_id") == project_id]

    def unpublished_requests(self) -> List[str]:
        return [record["request_id"] for record in self.list_requests()
                if not record.get("event_published") and
                (not record["channel"].endswith("_voice") or record.get("media_ref"))]

    def event_seen(self, event_id: str) -> bool:
        with self._db() as connection:
            row = connection.cursor().execute(self._sql("SELECT event_id FROM citizen_event_receipts WHERE event_id = ?"), (event_id,)).fetchone()
        return row is not None

    def mark_event(self, event_id: str):
        with self._db() as connection:
            connection.cursor().execute(self._sql("INSERT INTO citizen_event_receipts(event_id,processed_at) VALUES(?,?) ON CONFLICT(event_id) DO NOTHING"), (event_id, datetime.datetime.now(datetime.timezone.utc).isoformat()))

    def get_channel_session(self, channel_id: str) -> Dict[str, Any]:
        with self._db() as connection:
            row = connection.cursor().execute(self._sql("SELECT data_json FROM citizen_channel_sessions WHERE channel_id = ?"), (channel_id,)).fetchone()
        return json.loads(row[0]) if row else {}

    def save_channel_session(self, channel_id: str, state: Dict[str, Any]):
        query = "INSERT INTO citizen_channel_sessions(channel_id,data_json) VALUES(?,?) ON CONFLICT(channel_id) DO UPDATE SET data_json=excluded.data_json"
        with self._db() as connection:
            connection.cursor().execute(self._sql(query), (channel_id, json.dumps(state)))


citizen_storage = CitizenStorage()
