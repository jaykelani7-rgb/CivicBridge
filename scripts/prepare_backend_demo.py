#!/usr/bin/env python3
"""Non-destructive readiness and optional safe-fixture smoke checks."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
SERVICES = (
    "civicbridge-citizen-channels",
    "civicbridge-ai-normalization",
    "civicbridge-data-intelligence",
    "civicbridge-policy-impact",
)
PUSH_SUBSCRIPTIONS = (
    "ai-normalization-request-created",
    "ai-normalization-request-confirmed",
    "data-intelligence-normalized",
    "policy-impact-hotspot-updated",
)
TABLES = (
    "civicbridge_ai_normalization.processed_event_deliveries",
    "civicbridge_intelligence.processed_event_deliveries",
    "civicbridge_intelligence.request_embeddings",
    "civicbridge_policy_impact.processed_event_deliveries",
)
FIXTURES = {
    "IN": ROOT / "services/data-intelligence/fixtures/india/normalized_requests.json",
    "BR": ROOT / "services/data-intelligence/fixtures/brazil/normalized_requests.json",
    "ZA": ROOT / "services/data-intelligence/fixtures/south_africa/normalized_requests.json",
}


def run(*args: str, capture: bool = True) -> str:
    completed = subprocess.run(args, check=True, text=True, capture_output=capture)
    return completed.stdout.strip() if capture else ""


def verify(project: str, region: str) -> None:
    failures: list[str] = []
    for service in SERVICES:
        raw = run("gcloud", "run", "services", "describe", service, "--project", project, "--region", region, "--format=json")
        value = json.loads(raw)
        ready = any(item.get("type") == "Ready" and item.get("status") == "True" for item in value["status"]["conditions"])
        max_scale = value["spec"]["template"].get("metadata", {}).get("annotations", {}).get("autoscaling.knative.dev/maxScale")
        if not ready or max_scale != "1":
            failures.append(f"{service}: ready={ready}, max-instances={max_scale}")
        policy = json.loads(run("gcloud", "run", "services", "get-iam-policy", service, "--project", project, "--region", region, "--format=json"))
        public = any(member in {"allUsers", "allAuthenticatedUsers"} for binding in policy.get("bindings", []) for member in binding.get("members", []))
        if public:
            failures.append(f"{service}: public invoker binding present")

    subscriptions = json.loads(run("gcloud", "pubsub", "subscriptions", "list", "--project", project, "--format=json"))
    indexed = {item["name"].split("/")[-1]: item for item in subscriptions}
    for name in PUSH_SUBSCRIPTIONS:
        item = indexed.get(name, {})
        dlq = item.get("deadLetterPolicy", {})
        if not item.get("pushConfig", {}).get("pushEndpoint") or dlq.get("maxDeliveryAttempts") != 5:
            failures.append(f"{name}: push or five-attempt DLQ configuration missing")
        inspection = f"{name}-dead-letter-inspection"
        if inspection not in indexed:
            failures.append(f"{inspection}: missing")

    for table in TABLES:
        try:
            run("bq", f"--project_id={project}", "show", f"{project}:{table}")
        except subprocess.CalledProcessError:
            failures.append(f"BigQuery table missing: {table}")

    for country, path in FIXTURES.items():
        values = json.loads(path.read_text(encoding="utf-8"))
        if not values or values[0].get("data", {}).get("country_code") != country:
            failures.append(f"{country} fixture missing or invalid")

    if failures:
        raise RuntimeError("Readiness failed:\n- " + "\n- ".join(failures))
    print("Ready: four private Cloud Run services, four authenticated pushes, four DLQs, required BigQuery tables, and IN/BR/ZA fixtures.")


def publish_fixtures(project: str) -> None:
    started = datetime.now(timezone.utc).isoformat()
    request_ids: list[str] = []
    for country, path in FIXTURES.items():
        event = json.loads(path.read_text(encoding="utf-8"))[0]
        event["event_id"] = str(uuid4())
        event["trace_id"] = str(uuid4())
        event["occurred_at"] = datetime.now(timezone.utc).isoformat()
        event["data"]["request_id"] = str(uuid4())
        request_ids.append(event["data"]["request_id"])
        run(
            "gcloud", "pubsub", "topics", "publish", "request-normalized-v1",
            "--project", project, "--message", json.dumps(event, separators=(",", ":")),
            "--attribute", f"event_type=request.normalized.v1,country_code={country}",
        )
        print(f"Published safe {country} fixture request {event['data']['request_id']}")

    quoted = ",".join(f'"{value}"' for value in request_ids)
    for _ in range(10):
        query = (
            "SELECT COUNTIF(status='completed') AS completed "
            f"FROM `{project}.civicbridge_intelligence.processed_event_deliveries` WHERE request_id IN ({quoted})"
        )
        rows = json.loads(run("bq", f"--project_id={project}", "query", "--use_legacy_sql=false", "--format=json", query))
        if rows and int(rows[0]["completed"]) == len(request_ids):
            break
        time.sleep(5)
    else:
        raise RuntimeError("Fixture input deliveries did not complete within 50 seconds")

    query = (
        "SELECT COUNTIF(status='completed') AS completed "
        f"FROM `{project}.civicbridge_policy_impact.processed_event_deliveries` "
        f"WHERE updated_at >= TIMESTAMP('{started}')"
    )
    for _ in range(10):
        rows = json.loads(run("bq", f"--project_id={project}", "query", "--use_legacy_sql=false", "--format=json", query))
        if rows and int(rows[0]["completed"]) >= 1:
            print("Observed completed downstream hotspot delivery in the Policy ledger.")
            return
        time.sleep(5)
    raise RuntimeError("No downstream hotspot output reached Policy within 50 seconds")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="civicbridge-1")
    parser.add_argument("--region", default="us-central1")
    parser.add_argument("--publish-fixtures", action="store_true", help="Explicitly publish synthetic IN/BR/ZA fixtures")
    args = parser.parse_args()
    verify(args.project, args.region)
    if args.publish_fixtures:
        publish_fixtures(args.project)
    else:
        print("Verification only; no events were published. Add --publish-fixtures explicitly to run the cloud smoke flow.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
