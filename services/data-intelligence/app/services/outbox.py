from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any


class OutboxDispatcher:
    def __init__(self, repository: Any, publisher: Any, metrics: Any) -> None:
        self.repository = repository
        self.publisher = publisher
        self.metrics = metrics

    def dispatch(self) -> list[str]:
        published: list[str] = []
        for row in self.repository.pending_outbox():
            try:
                self.publisher.publish(json.loads(row["payload_json"]))
                now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                with self.repository.transaction():
                    self.repository.mark_outbox_published(row["event_id"], now)
                self.metrics.increment("events_published")
                published.append(row["event_id"])
            except Exception as exc:
                with self.repository.transaction():
                    self.repository.mark_outbox_failed(row["event_id"], str(exc))
        return published
