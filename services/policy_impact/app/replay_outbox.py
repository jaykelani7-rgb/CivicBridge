"""Replay committed Policy & Impact events using the configured event bus.

Run from the repository root with the same environment as the policy service:
python3 -m services.policy_impact.app.replay_outbox
"""
import sys

from packages.event_bus import get_event_bus
from services.policy_impact.app.database import get_repository
from services.policy_impact.app import main as _configured_main  # noqa: F401


def main() -> int:
    repository = get_repository()
    while repository.pending_event_count():
        published = repository.dispatch_pending(get_event_bus(), fail_on_error=True)
        if not published:
            break
    remaining = repository.pending_event_count()
    print({"policy_outbox_pending": remaining})
    return 0 if remaining == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
