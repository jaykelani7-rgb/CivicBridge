import logging
from typing import Callable, Dict, List
from packages.contracts.events import EventEnvelope

logger = logging.getLogger("event-bus")


class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[EventEnvelope], None]]] = {}
        self.published_events: List[EventEnvelope] = []

    def subscribe(self, event_type: str, callback: Callable[[EventEnvelope], None]):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def publish(self, event: EventEnvelope) -> EventEnvelope:
        logger.info(f"[EventBus] Published event: {event.event_type} (id: {event.event_id}, trace: {event.trace_id})")
        self.published_events.append(event)
        subscribers = self._subscribers.get(event.event_type, [])
        for sub in subscribers:
            try:
                sub(event)
            except Exception as e:
                logger.error(f"[EventBus] Error notifying subscriber for {event.event_type}: {e}")
        return event

    def clear(self):
        self.published_events.clear()


_global_event_bus = EventBus()


def get_event_bus() -> EventBus:
    return _global_event_bus
