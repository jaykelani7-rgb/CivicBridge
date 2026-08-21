import asyncio
import logging
from typing import Dict, List, Callable, Any, Set

logger = logging.getLogger("civicbridge.event_bus")

class PublishResult:
    def __init__(self, event: Any):
        self.event = event

    def __await__(self):
        async def _async_val():
            return self.event
        return _async_val().__await__()

    def __getattr__(self, name):
        return getattr(self.event, name)

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Any], Any]]] = {}
        self._processed_events: Set[str] = set()
        self.published_events: List[Any] = []

    def subscribe(self, event_type: str, handler: Callable[[Any], Any]):
        """Register a handler for a given event_type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to event {event_type}")

    def publish(self, event: Any) -> PublishResult:
        """
        Publish an event to all subscribers.
        Supports both synchronous execution and asynchronous awaiting.
        Enforces idempotency using event.event_id.
        """
        if event.event_id in self._processed_events:
            logger.warning(f"Duplicate event {event.event_id} ({event.event_type}) ignored.")
            return PublishResult(event)

        self._processed_events.add(event.event_id)
        self.published_events.append(event)
        
        handlers = self._subscribers.get(event.event_type, [])
        logger.info(f"[EventBus] Publishing event {event.event_type} (id: {event.event_id}, trace: {getattr(event, 'trace_id', None)}) to {len(handlers)} handlers.")

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    try:
                        # Try to schedule it in the running loop
                        loop = asyncio.get_running_loop()
                        loop.create_task(handler(event))
                    except RuntimeError:
                        # No running loop, run it synchronously
                        asyncio.run(handler(event))
                else:
                    handler(event)
            except Exception as e:
                logger.error(f"Error handling event {event.event_type} in {handler.__name__}: {e}", exc_info=True)

        return PublishResult(event)

    def clear(self):
        self.published_events.clear()
        self._processed_events.clear()

# Global shared event bus instances
event_bus = EventBus()

def get_event_bus() -> EventBus:
    return event_bus
