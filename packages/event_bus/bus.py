import asyncio
import logging
from typing import Dict, List, Callable, Any, Set
from packages.contracts.envelope import EventEnvelope

logger = logging.getLogger("civicbridge.event_bus")

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[EventEnvelope], Any]]] = {}
        self._processed_events: Set[str] = set()

    def subscribe(self, event_type: str, handler: Callable[[EventEnvelope], Any]):
        """Register a handler for a given event_type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to event {event_type}")

    async def publish(self, event: EventEnvelope):
        """
        Publish an event to all subscribers.
        Enforces idempotency using event.event_id.
        """
        if event.event_id in self._processed_events:
            logger.warning(f"Duplicate event {event.event_id} ({event.event_type}) ignored.")
            return

        self._processed_events.add(event.event_id)
        handlers = self._subscribers.get(event.event_type, [])
        logger.info(f"Publishing event {event.event_type} (id: {event.event_id}) to {len(handlers)} handlers.")

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                logger.error(f"Error handling event {event.event_type} in {handler.__name__}: {e}", exc_info=True)

# Global shared event bus instance
event_bus = EventBus()
