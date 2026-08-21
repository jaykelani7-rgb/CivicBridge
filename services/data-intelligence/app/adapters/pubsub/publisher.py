from __future__ import annotations

import json
from typing import Any

from app.domain.errors import DependencyError


class InMemoryEventPublisher:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.available = True

    def publish(self, event: dict[str, Any]) -> str:
        if not self.available:
            raise DependencyError("The in-memory event bus is unavailable.")
        if not any(x["event_id"] == event["event_id"] for x in self.events):
            self.events.append(event)
        return event["event_id"]

    def ping(self) -> bool:
        return self.available


class PubSubEventPublisher:
    def __init__(self, project: str, topic: str) -> None:
        try:
            from google.cloud import pubsub_v1
        except ImportError as exc:
            raise DependencyError("Install the production extra to use Pub/Sub.") from exc
        self.client = pubsub_v1.PublisherClient()
        self.topic_path = self.client.topic_path(project, topic)

    def publish(self, event: dict[str, Any]) -> str:
        try:
            future = self.client.publish(
                self.topic_path, json.dumps(event,sort_keys=True).encode("utf-8"),
                event_type=event["event_type"], trace_id=event["trace_id"],
            )
            return future.result(timeout=30)
        except Exception as exc:
            raise DependencyError("Pub/Sub event publication failed.") from exc

    def ping(self) -> bool:
        return True
