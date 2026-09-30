import json
from concurrent.futures import ThreadPoolExecutor
import pytest

from app.domain.models import Metrics
from app.services.outbox import OutboxDispatcher
from app.domain.errors import DependencyError


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


def test_lost_publish_ack_leaves_stable_event_for_retry():
    class RecoverableRepository(Repository):
        def __init__(self):
            super().__init__()
            self.failed_attempts = 0

        def mark_outbox_failed(self, event_id, error):
            self.failed_attempts += 1

    class AckLostPublisher(Publisher):
        def publish(self, event):
            super().publish(event)
            raise RuntimeError("ack lost after publish")

    repository = RecoverableRepository()
    first = AckLostPublisher()
    with pytest.raises(DependencyError):
        OutboxDispatcher(repository, first, Metrics()).dispatch()
    assert repository.failed_attempts == 1
    assert not repository.published
    second = Publisher()
    assert OutboxDispatcher(repository, second, Metrics()).dispatch() == ["event-1"]
    assert first.events == second.events == ["event-1"]
    assert repository.published
