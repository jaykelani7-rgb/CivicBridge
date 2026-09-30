from pathlib import Path

from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def test_startup_replays_committed_hotspot_event_after_restart(tmp_path):
    service_dir = Path(__file__).resolve().parents[2]
    path = str(tmp_path / "intelligence.db")
    settings = Settings(environment="test", database_path=path,
                        fixture_dir=str(service_dir / "fixtures"))

    class Publisher:
        def __init__(self):
            self.events = []

        def publish(self, event):
            self.events.append(event["event_id"])

    first = create_app(settings, publisher=Publisher())
    with first.state.repository.transaction():
        first.state.repository.enqueue_outbox(
            "hotspot-event-1", "hotspot.updated.v1",
            {"event_id": "hotspot-event-1", "event_type": "hotspot.updated.v1"},
            "trace-1", "2026-09-30T00:00:00Z",
        )
    first.state.repository.close()

    publisher = Publisher()
    restarted = create_app(settings, publisher=publisher)
    with TestClient(restarted):
        assert publisher.events == ["hotspot-event-1"]
        assert restarted.state.repository.pending_outbox() == []
    restarted.state.repository.close()
