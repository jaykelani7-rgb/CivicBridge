"""Drain committed hotspot events using the configured publisher.

Run from services/data-intelligence with its staging environment:
PYTHONPATH=. python3 -m app.replay_outbox
"""
import sys

from app.main import app


def main() -> int:
    repository = app.state.repository
    app.state.outbox.dispatch()
    remaining = len(repository.pending_outbox())
    print({"intelligence_outbox_pending": remaining})
    return 0 if remaining == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
