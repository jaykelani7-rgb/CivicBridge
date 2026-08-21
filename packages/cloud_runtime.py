"""Small Google Cloud adapters shared by independently deployed backend services."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from uuid import uuid4

from packages.event_bus.bus import EventBus, PublishResult


class PubSubEventBus(EventBus):
    def __init__(self, project: str, topic_by_event_type: Mapping[str, str]) -> None:
        super().__init__()
        from google.cloud import pubsub_v1

        self.publisher = pubsub_v1.PublisherClient()
        self.topic_by_event_type = {
            event_type: self.publisher.topic_path(project, topic)
            for event_type, topic in topic_by_event_type.items()
        }

    def publish(self, event: Any) -> PublishResult:
        if event.event_id in self._processed_events:
            return PublishResult(event)
        topic_path = self.topic_by_event_type.get(event.event_type)
        if topic_path:
            payload = event.model_dump(mode="json") if hasattr(event, "model_dump") else event
            self.publisher.publish(
                topic_path,
                json.dumps(payload, sort_keys=True, default=str).encode("utf-8"),
                event_type=event.event_type,
                trace_id=getattr(event, "trace_id", ""),
            ).result(timeout=30)
        return super().publish(event)


class BigQueryDeliveryLedger:
    """Durable event claim ledger containing identifiers only, never event payloads."""

    def __init__(self, project: str, dataset: str, location: str) -> None:
        from google.cloud import bigquery

        self.bigquery = bigquery
        self.client = bigquery.Client(project=project, location=location)
        self.table = f"{project}.{dataset}.processed_event_deliveries"
        self.location = location

    def begin(self, event_id: str, event_type: str, request_id: str, version: str) -> str:
        token = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        query = f"""
        MERGE `{self.table}` target
        USING (SELECT @event_id AS event_id) source ON target.event_id=source.event_id
        WHEN MATCHED AND target.status='failed' THEN UPDATE SET
          status='processing',claim_token=@token,error_code=NULL,updated_at=TIMESTAMP(@now)
        WHEN NOT MATCHED THEN INSERT
          (event_id,event_type,request_id,event_version,status,claim_token,created_at,updated_at)
        VALUES
          (@event_id,@event_type,@request_id,@version,'processing',@token,TIMESTAMP(@now),TIMESTAMP(@now));
        SELECT status,claim_token FROM `{self.table}` WHERE event_id=@event_id LIMIT 1
        """
        params = [
            self.bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            self.bigquery.ScalarQueryParameter("event_type", "STRING", event_type),
            self.bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            self.bigquery.ScalarQueryParameter("version", "STRING", version),
            self.bigquery.ScalarQueryParameter("token", "STRING", token),
            self.bigquery.ScalarQueryParameter("now", "STRING", now),
        ]
        rows = list(self.client.query(query, job_config=self.bigquery.QueryJobConfig(query_parameters=params), location=self.location).result())
        if not rows:
            raise RuntimeError("delivery ledger returned no claim")
        row = dict(rows[-1])
        if row["status"] == "completed":
            return "duplicate"
        return "acquired" if row.get("claim_token") == token else "processing"

    def complete(self, event_id: str) -> None:
        self._set(event_id, "completed", None)

    def fail(self, event_id: str, error_code: str) -> None:
        self._set(event_id, "failed", error_code)

    def _set(self, event_id: str, status: str, error_code: Optional[str]) -> None:
        query = f"UPDATE `{self.table}` SET status=@status,error_code=@error_code,updated_at=CURRENT_TIMESTAMP() WHERE event_id=@event_id"
        params = [
            self.bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            self.bigquery.ScalarQueryParameter("status", "STRING", status),
            self.bigquery.ScalarQueryParameter("error_code", "STRING", error_code),
        ]
        self.client.query(query, job_config=self.bigquery.QueryJobConfig(query_parameters=params), location=self.location).result()


def cloud_run_headers(audience: str, enabled: bool) -> dict[str, str]:
    if not enabled:
        return {}
    from google.auth.transport.requests import Request
    from google.oauth2 import id_token

    token = id_token.fetch_id_token(Request(), audience.rstrip("/"))
    return {"Authorization": f"Bearer {token}"}
