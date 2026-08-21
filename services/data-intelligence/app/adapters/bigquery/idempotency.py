from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from app.domain.errors import DependencyError
from app.domain.idempotency import DeliveryClaim


class BigQueryDeliveryIdempotencyStore:
    """Durable Pub/Sub delivery ledger; payloads and citizen text are never stored."""

    def __init__(
        self,
        project: str,
        dataset: str,
        location: str = "US",
        *,
        client: Optional[Any] = None,
        bigquery_module: Optional[Any] = None,
    ) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", project) or not re.fullmatch(
            r"[A-Za-z0-9_]+", dataset
        ):
            raise ValueError("BigQuery project or dataset identifier is invalid")
        if bigquery_module is None:
            try:
                from google.cloud import bigquery as bigquery_module
            except ImportError as exc:
                raise DependencyError(
                    "Install the production extra to use BigQuery idempotency."
                ) from exc
        self.bigquery = bigquery_module
        self.client = client or bigquery_module.Client(
            project=project, location=location
        )
        self.table = f"{project}.{dataset}.processed_event_deliveries"
        self.location = location

    def _run(self, query: str, parameters: list[Any]) -> list[Any]:
        try:
            config = self.bigquery.QueryJobConfig(query_parameters=parameters)
            return list(
                self.client.query(
                    query, job_config=config, location=self.location
                ).result()
            )
        except Exception as exc:
            raise DependencyError(
                "BigQuery delivery idempotency operation failed."
            ) from exc

    def begin(
        self, event_id: str, event_type: str, request_id: str, event_version: str
    ) -> DeliveryClaim:
        token = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        query = f"""
        MERGE `{self.table}` target
        USING (SELECT @event_id AS event_id) source ON target.event_id=source.event_id
        WHEN MATCHED AND target.status='failed' THEN UPDATE SET
          status='processing', claim_token=@claim_token, error_code=NULL, updated_at=TIMESTAMP(@now)
        WHEN NOT MATCHED THEN INSERT
          (event_id,event_type,request_id,event_version,status,claim_token,created_at,updated_at)
        VALUES
          (@event_id,@event_type,@request_id,@event_version,'processing',@claim_token,TIMESTAMP(@now),TIMESTAMP(@now));
        SELECT status,claim_token FROM `{self.table}` WHERE event_id=@event_id LIMIT 1
        """
        parameters = [
            self.bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
            self.bigquery.ScalarQueryParameter("event_type", "STRING", event_type),
            self.bigquery.ScalarQueryParameter("request_id", "STRING", request_id),
            self.bigquery.ScalarQueryParameter(
                "event_version", "STRING", event_version
            ),
            self.bigquery.ScalarQueryParameter("claim_token", "STRING", token),
            self.bigquery.ScalarQueryParameter("now", "STRING", now),
        ]
        rows = self._run(query, parameters)
        if not rows:
            raise DependencyError("BigQuery delivery claim returned no state.")
        row = dict(rows[-1])
        if row["status"] == "completed":
            return DeliveryClaim(acquired=False, duplicate=True)
        return DeliveryClaim(acquired=row.get("claim_token") == token)

    def complete(self, event_id: str) -> None:
        self._set_status(event_id, "completed", None)

    def fail(self, event_id: str, error_code: str) -> None:
        self._set_status(event_id, "failed", error_code)

    def _set_status(
        self, event_id: str, status: str, error_code: Optional[str]
    ) -> None:
        query = f"""UPDATE `{self.table}` SET status=@status,error_code=@error_code,
        updated_at=CURRENT_TIMESTAMP() WHERE event_id=@event_id"""
        self._run(
            query,
            [
                self.bigquery.ScalarQueryParameter("event_id", "STRING", event_id),
                self.bigquery.ScalarQueryParameter("status", "STRING", status),
                self.bigquery.ScalarQueryParameter("error_code", "STRING", error_code),
            ],
        )
