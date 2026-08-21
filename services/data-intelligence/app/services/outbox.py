from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Any

from app.domain.errors import DependencyError


class OutboxDispatcher:
    def __init__(self, repository: Any, publisher: Any, metrics: Any) -> None:
        self.repository = repository
        self.publisher = publisher
        self.metrics = metrics
        self._dispatch_lock = threading.Lock()

    def dispatch(self) -> list[str]:
        with self._dispatch_lock:
            return self._dispatch_pending()

    def _dispatch_pending(self) -> list[str]:
        published: list[str] = []
        failed = False
        for row in self.repository.pending_outbox():
            try:
                self.publisher.publish(json.loads(row["payload_json"]))
                now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                with self.repository.transaction():
                    self.repository.mark_outbox_published(row["event_id"], now)
                self.metrics.increment("events_published")
                published.append(row["event_id"])
            except Exception as exc:
                failed = True
                with self.repository.transaction():
                    self.repository.mark_outbox_failed(row["event_id"], str(exc))
        if failed:
            raise DependencyError(
                "One or more pending hotspot events could not be published."
            )
        return published
