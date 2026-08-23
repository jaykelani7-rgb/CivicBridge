from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.schemas.events import EventEnvelope, NormalizedRequest


DEMO_TARGETS = (
    ("india", "drainage", "IN-RJ-JPR-W42", 5),
    ("india", "roads", "IN-RJ-JPR-W18", 6),
    ("brazil", "sanitation", "BR-SP-SAO-CAP", 6),
    ("south_africa", "water", "ZA-GP-JHB-SOW", 5),
)


def _template(fixture_dir: Path, pack: str, category: str) -> dict[str, Any]:
    events = json.loads((fixture_dir / pack / "normalized_requests.json").read_text(encoding="utf-8"))
    return next(event for event in events if event["data"]["category"] == category)


def build_demo_events(fixture_dir: Path) -> list[EventEnvelope[NormalizedRequest]]:
    """Build deterministic, privacy-safe demo events for a six-report baseline."""
    occurred_at = datetime(2026, 8, 20, 10, 30, tzinfo=timezone.utc)
    events: list[EventEnvelope[NormalizedRequest]] = []
    for pack, category, administrative_id, event_count in DEMO_TARGETS:
        template = _template(fixture_dir, pack, category)
        for index in range(event_count):
            seed = f"civicbridge-image-demo-v1:{administrative_id}:{category}:{index}"
            payload = deepcopy(template)
            payload["event_id"] = str(uuid5(NAMESPACE_URL, seed + ":event"))
            payload["trace_id"] = str(uuid5(NAMESPACE_URL, seed + ":trace"))
            payload["occurred_at"] = (occurred_at + timedelta(minutes=len(events))).isoformat().replace("+00:00", "Z")
            payload["data"]["request_id"] = str(uuid5(NAMESPACE_URL, seed + ":request"))
            payload["data"]["administrative_id"] = administrative_id
            payload["data"]["model"] = "synthetic-demo-fixture"
            events.append(EventEnvelope[NormalizedRequest].model_validate(payload))
    return events


def seed_demo_hotspots(application: Any, fixture_dir: Path) -> int:
    """Process the baked demo baseline through the canonical intelligence pipeline."""
    for event in build_demo_events(fixture_dir):
        application.state.pipeline.process(event)
    return len(DEMO_TARGETS)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a deterministic SQLite demo baseline into the container image.")
    parser.add_argument("--database-path", required=True)
    parser.add_argument("--fixture-dir", required=True)
    args = parser.parse_args(argv)

    os.environ.update({
        "CB_ENV": "test",
        "CB_MODE": "local",
        "CB_STORAGE_BACKEND": "sqlite",
        "CB_DATABASE_PATH": str(Path(args.database_path).resolve()),
        "CB_FIXTURE_DIR": str(Path(args.fixture_dir).resolve()),
        "CB_ANALYTICAL_BACKEND": "local",
        "CB_GEOGRAPHY_PROVIDER": "local",
        "CB_EVENT_BUS": "memory",
        "CB_IDEMPOTENCY_BACKEND": "local",
        "SIMILARITY_PROVIDER": "lexical",
    })
    from app.main import app

    seeded = seed_demo_hotspots(app, Path(args.fixture_dir).resolve())
    hotspots, total = app.state.repository.list_hotspots({}, 1, 100)
    if seeded != 4 or total != 4 or any(item["request_count"] != 6 for item in hotspots):
        raise RuntimeError("Demo database validation failed.")
    app.state.repository.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
