#!/usr/bin/env python3
"""Publish privacy-safe synthetic normalized requests through canonical Pub/Sub."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from typing import Callable
from uuid import NAMESPACE_URL, UUID, uuid5

PROJECT = "civicbridge-1"
TOPIC = "request-normalized-v1"

HOTSPOTS = [
    {"country":"IN","language":"hi-IN","administrative_id":"IN-RJ-JPR-W42","mentions":["Ward 42","Jaipur"],"category":"drainage","subcategory":"stormwater_drainage","summary":"Recurring stormwater overflow blocks community access in Ward 42 during rain.","problem":"Stormwater overflow repeatedly blocks the local road during rainfall.","outcome":"Assess and restore safe stormwater drainage capacity.","urgency":"high"},
    {"country":"IN","language":"en-IN","administrative_id":"IN-RJ-JPR-W18","mentions":["Ward 18","Jaipur"],"category":"roads","subcategory":"road_damage","summary":"Repeated road surface damage disrupts access in Jaipur Ward 18.","problem":"Road surface damage is disrupting community access in Ward 18.","outcome":"Assess and repair the damaged public road surface.","urgency":"medium"},
    {"country":"BR","language":"pt-BR","administrative_id":"BR-SP-SAO-CAP","mentions":["Capela do Socorro","São Paulo"],"category":"sanitation","subcategory":"sanitation_service","summary":"Recurring sanitation service gaps affect public spaces in Capela do Socorro.","problem":"Sanitation service gaps repeatedly affect shared public areas.","outcome":"Assess and restore reliable local sanitation service.","urgency":"high"},
    {"country":"ZA","language":"en-ZA","administrative_id":"ZA-GP-JHB-SOW","mentions":["Soweto","Johannesburg"],"category":"water","subcategory":"water_supply","summary":"Repeated water supply interruptions affect community access in Soweto.","problem":"Community water supply is repeatedly interrupted.","outcome":"Assess and restore reliable community water supply.","urgency":"high"},
]


def seeded_uuid(run_id: str, hotspot_index: int, report_index: int, kind: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"civicbridge-live-demo:{run_id}:{hotspot_index}:{report_index}:{kind}"))


def build_events(run_id: str, reports_per_hotspot: int = 4) -> list[dict]:
    UUID(run_id)  # A UUID run ID makes requesting a genuinely new run explicit.
    if not 3 <= reports_per_hotspot <= 5:
        raise ValueError("reports_per_hotspot must be between 3 and 5")
    now = datetime.now(timezone.utc).replace(microsecond=0)
    events = []
    for hotspot_index, fixture in enumerate(HOTSPOTS):
        for report_index in range(reports_per_hotspot):
            event_id = seeded_uuid(run_id, hotspot_index, report_index, "event")
            request_id = seeded_uuid(run_id, hotspot_index, report_index, "request")
            trace_id = seeded_uuid(run_id, hotspot_index, report_index, "trace")
            occurred = now - timedelta(minutes=(hotspot_index * reports_per_hotspot + report_index))
            events.append({
                "event_id": event_id, "event_type": "request.normalized.v1", "schema_version": "1.0.0",
                "occurred_at": occurred.isoformat().replace("+00:00", "Z"), "producer": "ai-normalization", "trace_id": trace_id,
                "data": {
                    "request_id": request_id, "country_code": fixture["country"], "original_language": fixture["language"],
                    "translation_working": fixture["problem"], "category": fixture["category"], "subcategory": fixture["subcategory"],
                    "summary": fixture["summary"], "problem_description": fixture["problem"], "requested_outcome": fixture["outcome"],
                    "urgency": fixture["urgency"], "affected_scope": "community", "location_mentions": fixture["mentions"],
                    "administrative_id": fixture["administrative_id"], "evidence_types": ["text", "repeat_report"], "confidence": 0.92,
                    "pii_flags": ["none"], "needs_human_review": False, "review_reason": None,
                    "model": "synthetic-demo-fixture", "prompt_version": "normalize-1.0.0", "schema_version": "normalized-request-1.0.0",
                    "fixture_provenance": {"kind":"synthetic_demo","seed_run_id":run_id,"contains_pii":False},
                },
            })
    return events


def publish(events: list[dict], project: str, publisher_factory: Callable | None = None) -> list[str]:
    if publisher_factory is None:
        try:
            from google.cloud import pubsub_v1
            publisher_factory = pubsub_v1.PublisherClient
        except ImportError:
            message_ids = []
            for event in events:
                completed = subprocess.run([
                    "gcloud", "pubsub", "topics", "publish", TOPIC, f"--project={project}",
                    f"--message={json.dumps(event, separators=(',', ':'), ensure_ascii=False)}",
                    "--attribute=event_type=request.normalized.v1,provenance=synthetic_demo",
                    "--format=value(messageIds)",
                ], check=True, capture_output=True, text=True)
                message_ids.append(completed.stdout.strip())
            return message_ids
    publisher = publisher_factory()
    topic_path = publisher.topic_path(project, TOPIC)
    futures = [publisher.publish(topic_path, json.dumps(event, separators=(",", ":"), ensure_ascii=False).encode("utf-8"), event_type="request.normalized.v1", seed_run_id=event["data"]["fixture_provenance"]["seed_run_id"]) for event in events]
    return [future.result(timeout=60) for future in futures]


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--run-id", required=True, help="A new UUID for a deliberately new seed run; reusing it safely reuses canonical IDs.")
    result.add_argument("--reports-per-hotspot", type=int, default=4, choices=range(3, 6))
    result.add_argument("--confirm-project", help=f"Required to publish; must equal {PROJECT}.")
    result.add_argument("--dry-run", action="store_true", help="Validate and print IDs without publishing (default without confirmation).")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try: events = build_events(args.run_id, args.reports_per_hotspot)
    except ValueError as exc: print(f"error: {exc}", file=sys.stderr); return 2
    publishing = not args.dry_run and args.confirm_project is not None
    if publishing and args.confirm_project != PROJECT:
        print(f"error: --confirm-project must exactly equal {PROJECT}", file=sys.stderr); return 2
    if not publishing:
        print("DRY RUN — no Pub/Sub messages published. To publish, pass --confirm-project=civicbridge-1.")
    else:
        message_ids = publish(events, PROJECT)
        print(f"Published {len(message_ids)} synthetic demo events to projects/{PROJECT}/topics/{TOPIC}.")
    for event in events:
        print(f"{event['data']['country_code']} {event['data']['category']} event_id={event['event_id']} request_id={event['data']['request_id']} trace_id={event['trace_id']}")
    print("Verify: curl -fsS https://civicbridge-web-129884310679.us-central1.run.app/api/intelligence/hotspots")
    print("Then use each returned hotspot_id with /api/intelligence/hotspots/{id}, /score, and /evidence.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
