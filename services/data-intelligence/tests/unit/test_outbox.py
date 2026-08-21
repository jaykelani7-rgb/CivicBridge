import json
from concurrent.futures import ThreadPoolExecutor

from app.domain.models import Metrics
from app.services.outbox import OutboxDispatcher


class Repository:
    def __init__(self):
        self.published = False

    def pending_outbox(self):
        if self.published:
            return []
        return [
            {"event_id": "event-1", "payload_json": json.dumps({"event_id": "event-1"})}
        ]

    def transaction(self):
        class Transaction:
            def __enter__(self):
                return None

            def __exit__(self, *args):
                return False

        return Transaction()

    def mark_outbox_published(self, event_id, now):
        self.published = True

    def mark_outbox_failed(self, event_id, error):
        raise AssertionError(error)


class Publisher:
    def __init__(self):
        self.events = []

    def publish(self, event):
        self.events.append(event["event_id"])


def test_concurrent_drains_publish_each_outbox_row_once():
    repository = Repository()
    publisher = Publisher()
    dispatcher = OutboxDispatcher(repository, publisher, Metrics())
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: dispatcher.dispatch(), range(2)))
    assert publisher.events == ["event-1"]
