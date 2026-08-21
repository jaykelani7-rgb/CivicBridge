from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class DeliveryClaim:
    acquired: bool
    duplicate: bool = False


class DeliveryIdempotencyStore(Protocol):
    def begin(
        self, event_id: str, event_type: str, request_id: str, event_version: str
    ) -> DeliveryClaim: ...
    def complete(self, event_id: str) -> None: ...
    def fail(self, event_id: str, error_code: str) -> None: ...


class PipelineDeliveryIdempotencyStore:
    """Local mode delegates idempotency to the transactional SQLite pipeline."""

    def begin(
        self, event_id: str, event_type: str, request_id: str, event_version: str
    ) -> DeliveryClaim:
        return DeliveryClaim(acquired=True)

    def complete(self, event_id: str) -> None:
        return None

    def fail(self, event_id: str, error_code: str) -> None:
        return None
