from __future__ import annotations

import json
from typing import Any, Union

from app.schemas.events import NormalizedRequestEvent


class NormalizedRequestConsumer:
    """Adapter-neutral consumer used by Pub/Sub callbacks and integration tests."""

    def __init__(self, pipeline: Any) -> None:
        self.pipeline = pipeline

    def handle_payload(self, payload: Union[bytes, str, dict]) -> dict:
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        if isinstance(payload, str):
            payload = json.loads(payload)
        envelope = NormalizedRequestEvent.model_validate(payload)
        return self.handle_event(envelope)

    def handle_event(self, envelope: NormalizedRequestEvent) -> dict:
        return self.pipeline.process(envelope)

    def pubsub_callback(self, message: Any) -> None:
        try:
            self.handle_payload(message.data)
            message.ack()
        except Exception as exc:
            if getattr(exc,"retryable",False):
                message.nack()
            else:
                message.ack()  # subscription DLQ policy records non-retryable poison messages
