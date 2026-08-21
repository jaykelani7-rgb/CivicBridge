"""
Event-bus consumer: automatically normalizes a citizen request as soon as
Sujal's Citizen Channels service publishes request.created.v1 or
request.confirmed.v1 (contract.md event ownership table). This is what makes
"submit a request -> normalized record appears" work without a human calling
the HTTP API in between, matching the Event Sequence in Section 6 of
contract.md ("Worker performs transcription/translation, then Gemini
extraction" as soon as request.created.v1 is published).

The shared EventBus (packages/event_bus/bus.py) is an in-process singleton,
so this only auto-normalizes when both services are imported/mounted in the
same Python process (e.g. the shared pytest suite, or a combined deployment).
When AI Normalization runs as its own standalone process against a real
message bus (Pub/Sub in production, per the blueprint's stack table), this
same handler is what a Pub/Sub push/pull subscriber would call.
"""
import logging

from packages.contracts.envelope import EventEnvelope

from services.ai_normalization.pipeline.normalization_service import NormalizationService

logger = logging.getLogger("ai-normalization.consumer")


def register_consumers(event_bus, service: NormalizationService) -> None:
    def _handle(event: EventEnvelope):
        data = event.data or {}
        request_id = data.get("request_id")
        if not request_id:
            logger.warning("Received %s with no request_id in payload; ignoring.", event.event_type)
            return
        try:
            service.normalize_request(request_id, force=False, trace_id=event.trace_id)
        except Exception as exc:  # noqa: BLE001 - a bad event must never crash the bus
            logger.error("Auto-normalization failed for request %s from event %s: %s", request_id, event.event_type, exc)

    event_bus.subscribe("request.created.v1", _handle)
    event_bus.subscribe("request.confirmed.v1", _handle)
