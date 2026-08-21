"""
In-memory repository for AI Normalization results.

Mirrors the pattern used by Sujal's CitizenStorage and Sharmad's
PolicyImpactRepository: a simple, dependency-free store that is enough for
the hackathon demo and for tests, but keeps a narrow interface so it can be
swapped for Firestore/BigQuery later without touching the service layer.
"""
import datetime
from typing import Any, Dict, List, Optional

from packages.contracts.normalization import NormalizedRequestData


class NormalizationRecord:
    def __init__(self, result: NormalizedRequestData, status: str):
        self.result = result
        self.status = status  # "normalized" | "needs_review" | "failed"
        self.attempts = 1
        self.created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.history: List[Dict[str, Any]] = []

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


class NormalizationRepository:
    def __init__(self):
        self._records: Dict[str, NormalizationRecord] = {}

    def get(self, request_id: str) -> Optional[NormalizationRecord]:
        return self._records.get(request_id)

    def exists(self, request_id: str) -> bool:
        return request_id in self._records

    def save(self, request_id: str, result: NormalizedRequestData, status: str) -> NormalizationRecord:
        existing = self._records.get(request_id)
        if existing:
            existing.record_attempt(result, status)
            return existing
        record = NormalizationRecord(result, status)
        self._records[request_id] = record
        return record

    def list_needs_review(self) -> List[NormalizationRecord]:
        return [r for r in self._records.values() if r.status == "needs_review"]

    def clear(self):
        self._records.clear()


# Global singleton, consistent with the rest of the codebase's in-process demo style.
_repository = NormalizationRepository()


def get_repository() -> NormalizationRepository:
    return _repository
