"""Transactional, order-tolerant projection of downstream events onto public status."""
from __future__ import annotations
import datetime
import json
from typing import Any

from packages.contracts.envelope import EventEnvelope

PRIORITY = {
    "request.needs_review.v1": 1, "request.normalized.v1": 2,
    "hotspot.updated.v1": 3, "recommendation.created.v1": 4,
    "policy.decision.recorded.v1": 5, "project.status.updated.v1": 6,
    "impact.metric.updated.v1": 7,
}
STAGE_RANK = {
    "awaiting_media": 0, "submitted": 1, "transcribing": 2, "translating": 3,
    "normalizing": 4, "processing_failed": 5, "under_review": 5,
    "matching": 6, "hotspot_aggregated": 7, "recommended": 8,
    "policy_review_requested": 9, "policy_approved": 10,
    "project_active": 11, "project_cancelled": 12, "project_completed": 12,
    "outcome_tracking": 13,
}


def _instant(value: Any) -> datetime.datetime:
    if not isinstance(value, str):
        return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)
    except ValueError:
        return datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)


def _candidate(event: EventEnvelope, record: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    kind, data = event.event_type, event.data
    request_id = record["request_id"]
    if kind in {"request.normalized.v1", "request.needs_review.v1"}:
        if data.get("request_id") != request_id:
            return None
        if kind == "request.normalized.v1":
            return "matching", {"category": data.get("category"), "normalized_summary": data.get("summary"), "processing_mode": data.get("processing_mode"), "public_summary": data.get("summary")}
        failed = data.get("speech_status") == "failed" or data.get("translation_status") == "failed" or data.get("extraction_status") == "failed_fallback"
        return ("processing_failed" if failed else "under_review"), {
            "normalized_summary": None if failed else data.get("summary"), "processing_mode": data.get("processing_mode"),
            "public_summary": "Automated processing could not finish. An analyst can review this report or retry processing." if failed else "This report needs an analyst review before it can be grouped with others.",
        }
    if kind == "hotspot.updated.v1":
        if request_id not in data.get("request_ids", []):
            return None
        return "hotspot_aggregated", {"hotspot_id": data.get("hotspot_id"), "hotspot_score": data.get("action_score"), "public_summary": "Grouped with related reports for review."}
    if kind == "recommendation.created.v1":
        if record.get("hotspot_id") != data.get("hotspot_id"):
            return None
        return "recommended", {"recommendation_id": data.get("recommendation_id"), "public_summary": "A proposed response is awaiting human review."}
    if kind == "policy.decision.recorded.v1":
        decision = data.get("decision") if isinstance(data.get("decision"), dict) else data
        if record.get("recommendation_id") != decision.get("recommendation_id"):
            return None
        approved = decision.get("action") == "approve_for_assessment"
        return ("policy_approved" if approved else "policy_review_requested"), {"public_summary": "Approved for project assessment; delivery is not yet verified." if approved else "A human reviewer requested more work on the proposal."}
    if kind == "project.status.updated.v1":
        if record.get("recommendation_id") != data.get("recommendation_id"):
            return None
        status = str(data.get("status") or "candidate")
        stage = "project_completed" if status == "completed" else "project_cancelled" if status == "cancelled" else "project_active"
        summary = "Project delivery is marked complete; measured outcomes remain separate." if status == "completed" else "The project candidate was cancelled." if status == "cancelled" else "A project candidate is being assessed; no outcome is claimed."
        return stage, {"project_id": data.get("project_id"), "project_title": data.get("title") or "Linked project", "project_status": status, "public_summary": summary}
    if kind == "impact.metric.updated.v1":
        if record.get("project_id") != data.get("project_id"):
            return None
        source_type = str(data.get("source_type") or "manual")
        label = "An independently verified" if source_type == "independently_verified" else "A manually entered"
        return "outcome_tracking", {"outcome_status": data.get("outcome_status"), "measurement_source_type": source_type,
            "public_summary": f"{label} measurement was recorded for the linked project. A change does not establish that the project caused it."}
    return None


def apply_status_event(storage: Any, event: EventEnvelope) -> int:
    """Persist inbound event and reconcile prerequisites in one SQL transaction.

    Unmatched events stay pending; a later prerequisite event replays them. A
    duplicated envelope ID is harmless and older updates cannot lower progress.
    """
    if event.event_type not in PRIORITY:
        raise ValueError(f"Unsupported status event: {event.event_type}")
    applied = 0
    with storage._db() as connection:
        if not storage.postgres:
            connection.execute("BEGIN IMMEDIATE")
        cursor = connection.cursor()
        cursor.execute(storage._sql("INSERT INTO citizen_inbound_events(event_id,event_type,payload_json,received_at) VALUES(?,?,?,?) ON CONFLICT(event_id) DO NOTHING"),
            (event.event_id, event.event_type, json.dumps(event.model_dump(mode="json")), datetime.datetime.now(datetime.timezone.utc).isoformat()))
        while True:
            rows = cursor.execute("SELECT event_id,payload_json FROM citizen_inbound_events WHERE applied_at IS NULL").fetchall()
            pending = [EventEnvelope.model_validate(json.loads(row[1])) for row in rows]
            pending.sort(key=lambda item: (PRIORITY.get(item.event_type, 99), _instant(item.occurred_at), item.event_id))
            changed = False
            for pending_event in pending:
                query = "SELECT request_id,data_json FROM citizen_requests"
                if storage.postgres:
                    query += " FOR UPDATE"
                records = [(record_id, json.loads(data_json)) for record_id, data_json in cursor.execute(query).fetchall()]
                candidates = [(record_id, record, _candidate(pending_event, record)) for record_id, record in records]
                candidates = [(record_id, record, candidate) for record_id, record, candidate in candidates if candidate]
                if not candidates:
                    continue
                for record_id, record, (stage, fields) in candidates:
                    versions = record.setdefault("status_event_versions", {})
                    family = pending_event.event_type
                    nested_decision = pending_event.data.get("decision") or {}
                    version = (pending_event.data.get("updated_at") or pending_event.data.get("decided_at")
                               or nested_decision.get("decided_at") or pending_event.data.get("measured_at")
                               or pending_event.occurred_at)
                    if _instant(version) <= _instant(versions.get(family)):
                        continue
                    versions[family] = version
                    old_rank = STAGE_RANK.get(record.get("processing_stage"), 0)
                    new_rank = STAGE_RANK[stage]
                    for field, value in fields.items():
                        if value is None or (field == "public_summary" and new_rank < old_rank):
                            continue
                        record[field] = value
                    if new_rank >= old_rank:
                        record["processing_stage"] = stage
                    cursor.execute(storage._sql("UPDATE citizen_requests SET data_json = ? WHERE request_id = ?"), (json.dumps(record), record_id))
                    storage.requests[record_id] = record
                now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                cursor.execute(storage._sql("UPDATE citizen_inbound_events SET applied_at = ? WHERE event_id = ?"), (now, pending_event.event_id))
                cursor.execute(storage._sql("INSERT INTO citizen_event_receipts(event_id,processed_at) VALUES(?,?) ON CONFLICT(event_id) DO NOTHING"), (pending_event.event_id, now))
                applied += 1
                changed = True
            if not changed:
                break
    return applied
