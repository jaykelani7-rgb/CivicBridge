"""Normalization records with an in-memory test adapter and durable SQL adapter."""
import datetime
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from packages.contracts.normalization import NormalizedRequestData


class NormalizationRecord:
    def __init__(self, request_id: str, result: NormalizedRequestData, status: str):
        self.request_id = request_id
        self.result = result
        self.status = status  # "normalized" | "needs_review" | "failed"
        self.attempts = 1
        self.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.history: List[Dict[str, Any]] = []
        self.reviewed_at: Optional[str] = None
        self.reviewed_by: Optional[str] = None
        self.reviewer_role: Optional[str] = None

    def record_attempt(self, result: NormalizedRequestData, status: str):
        self.history.append(
            {
                "result": self.result.model_dump(),
                "status": self.status,
                "recorded_at": self.updated_at,
            }
        )
        self.result = result
        self.status = status
        self.attempts += 1
        self.updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def record_approval(self, result: NormalizedRequestData, reviewer_id: str, reviewer_role: str):
        reviewed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.history.append(
            {
                "result": self.result.model_dump(),
                "status": self.status,
                "recorded_at": self.updated_at,
                "decision": "approved",
                "reviewer_id": reviewer_id,
                "reviewer_role": reviewer_role,
            }
        )
        self.result = result
        self.status = "normalized"
        self.reviewed_at = reviewed_at
        self.reviewed_by = reviewer_id
        self.reviewer_role = reviewer_role
        self.updated_at = reviewed_at


class NormalizationRepository:
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url if database_url is not None else os.getenv("NORMALIZATION_DATABASE_URL")
        if os.getenv("ENVIRONMENT", "development").lower() == "production" and not (self.database_url or "").startswith(("postgres://", "postgresql://")):
            raise RuntimeError("Production normalization requires NORMALIZATION_DATABASE_URL (PostgreSQL)")
        self.postgres = bool(self.database_url and self.database_url.startswith(("postgres://", "postgresql://")))
        self._records: Dict[str, NormalizationRecord] = {}
        if self.database_url:
            if not self.postgres:
                Path(self.database_url).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
            with self._db() as connection:
                connection.cursor().execute("CREATE TABLE IF NOT EXISTS normalization_records (request_id TEXT PRIMARY KEY, data_json TEXT NOT NULL)")

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

    def persist(self, record: NormalizationRecord):
        if self.database_url:
            data = {
                "request_id": record.request_id, "result": record.result.model_dump(),
                "status": record.status, "attempts": record.attempts,
                "created_at": record.created_at, "updated_at": record.updated_at,
                "history": record.history, "reviewed_at": record.reviewed_at,
                "reviewed_by": record.reviewed_by, "reviewer_role": record.reviewer_role,
            }
            query = "INSERT INTO normalization_records(request_id,data_json) VALUES(?,?) ON CONFLICT(request_id) DO UPDATE SET data_json=excluded.data_json"
            if self.postgres:
                query = query.replace("?", "%s")
            with self._db() as connection:
                connection.cursor().execute(query, (record.request_id, json.dumps(data)))
        self._records[record.request_id] = record

    def get(self, request_id: str) -> Optional[NormalizationRecord]:
        if self.database_url:
            query = "SELECT data_json FROM normalization_records WHERE request_id = ?"
            with self._db() as connection:
                row = connection.cursor().execute(query.replace("?", "%s") if self.postgres else query, (request_id,)).fetchone()
            if not row:
                return None
            data = json.loads(row[0])
            record = NormalizationRecord(request_id, NormalizedRequestData.model_validate(data["result"]), data["status"])
            for key in ("attempts", "created_at", "updated_at", "history", "reviewed_at", "reviewed_by", "reviewer_role"):
                setattr(record, key, data.get(key))
            return record
        return self._records.get(request_id)

    def exists(self, request_id: str) -> bool:
        return self.get(request_id) is not None

    def save(self, request_id: str, result: NormalizedRequestData, status: str) -> NormalizationRecord:
        existing = self.get(request_id)
        if existing:
            existing.record_attempt(result, status)
            self.persist(existing)
            return existing
        record = NormalizationRecord(request_id, result, status)
        self.persist(record)
        return record

    def list_needs_review(self) -> List[NormalizationRecord]:
        if self.database_url:
            with self._db() as connection:
                rows = connection.cursor().execute("SELECT request_id FROM normalization_records").fetchall()
            return [record for row in rows if (record := self.get(row[0])) and record.status == "needs_review"]
        return [r for r in self._records.values() if r.status == "needs_review"]

    def clear(self):
        if self.database_url:
            with self._db() as connection:
                connection.cursor().execute("DELETE FROM normalization_records")
        self._records.clear()


# Global singleton, consistent with the rest of the codebase's in-process demo style.
_repository = NormalizationRepository()


def get_repository() -> NormalizationRepository:
    return _repository
