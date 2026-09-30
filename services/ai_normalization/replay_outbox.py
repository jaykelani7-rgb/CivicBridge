"""Replay committed normalization events with the configured service publisher.

Run from the repository root with the normalization service's environment:
python3 -m services.ai_normalization.replay_outbox
"""
import sys

from services.ai_normalization.main import app


def main() -> int:
    repository = app.state.repository
    if not repository.database_url:
        print({"normalization_outbox_pending": "no durable database configured"})
        return 2
    while repository.pending_event_count():
        if not repository.dispatch_pending(app.state.event_bus):
            break
    remaining = repository.pending_event_count()
    print({"normalization_outbox_pending": remaining})
    return 0 if remaining == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
