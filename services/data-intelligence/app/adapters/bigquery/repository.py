from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from app.domain.errors import DependencyError
from app.domain.models import EmbeddingRecord


def _safe_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _safe_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe_value(item) for item in value]
    return value


class BigQueryAnalyticalRepository:
    """Read-only production adapter over versioned, provenance-filtered views."""

    ALLOWED_VIEWS = {
        "current_data_sources",
        "current_demographic_features",
        "current_infrastructure_indices",
        "current_investment_projects",
    }

    def __init__(
        self,
        project: str,
        dataset: str,
        location: str = "US",
        *,
        client: Optional[Any] = None,
        bigquery_module: Optional[Any] = None,
    ) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", project) or not re.fullmatch(r"[A-Za-z0-9_]+", dataset):
            raise ValueError("BigQuery project or dataset identifier is invalid")
        if bigquery_module is None:
            try:
                from google.cloud import bigquery as bigquery_module
            except ImportError as exc:
                raise DependencyError("Install the production extra to use BigQuery.") from exc
        self.bigquery = bigquery_module
        self.client = client or bigquery_module.Client(project=project, location=location)
        self.dataset = f"{project}.{dataset}"
        self.location = location

    def ping(self) -> bool:
        try:
            list(self.client.query("SELECT 1 AS ok", location=self.location).result())
            return True
        except Exception as exc:
            raise DependencyError("BigQuery connectivity check failed.") from exc

    def _rows(
        self,
        view: str,
        predicate: str,
        parameters: list[Any],
        *,
        order_by: str = "",
        limit: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        if view not in self.ALLOWED_VIEWS:
            raise ValueError("BigQuery view is not approved for analytical reads")
        query = f"SELECT * FROM `{self.dataset}.{view}` WHERE {predicate}"
        if order_by:
            query += f" ORDER BY {order_by}"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
        config = self.bigquery.QueryJobConfig(query_parameters=parameters)
        try:
            rows = self.client.query(query,job_config=config,location=self.location).result()
            return [{key:_safe_value(value) for key,value in dict(row).items()} for row in rows]
        except Exception as exc:
            raise DependencyError(f"BigQuery analytical query failed for {view}.") from exc

    def get_enrichment(self, geography_id: str, category: str) -> dict[str, Any]:
        geography_parameter = self.bigquery.ScalarQueryParameter("geography_id","STRING",geography_id)
        category_parameter = self.bigquery.ScalarQueryParameter("category","STRING",category)
        demographics = self._rows(
            "current_demographic_features","geography_id=@geography_id",[geography_parameter],
            order_by="reference_year DESC, dataset_version DESC",limit=1,
        )
        infrastructure = self._rows(
            "current_infrastructure_indices","geography_id=@geography_id AND category=@category",
            [geography_parameter,category_parameter],order_by="reference_year DESC, dataset_version DESC",limit=1,
        )
        projects = self._rows(
            "current_investment_projects","geography_id=@geography_id AND category=@category",
            [geography_parameter,category_parameter],order_by="dataset_version DESC, project_id",
        )
        source_ids = sorted({row["source_id"] for row in [*demographics,*infrastructure,*projects] if row.get("source_id")})
        sources: list[dict[str,Any]] = []
        if source_ids:
            sources = self._rows(
                "current_data_sources","source_id IN UNNEST(@source_ids)",[
                    self.bigquery.ArrayQueryParameter("source_ids","STRING",source_ids)
                ],order_by="source_id",
            )
        return {
            "demographic":demographics[0] if demographics else None,
            "infrastructure":infrastructure[0] if infrastructure else None,
            "projects":projects,
            "sources":sources,
        }

    def get_embedding(self, digest: str) -> Optional[dict[str, Any]]:
        query = f"""
            SELECT request_id,content_hash,embedding,embedding_model,embedding_dimension,
                   canonical_text_version,provider,created_at
            FROM `{self.dataset}.request_embeddings`
            WHERE content_hash=@content_hash
            LIMIT 1
        """
        config = self.bigquery.QueryJobConfig(query_parameters=[
            self.bigquery.ScalarQueryParameter("content_hash","STRING",digest)
        ])
        try:
            rows = list(self.client.query(query,job_config=config,location=self.location).result())
            if not rows:
                return None
            record = {key:_safe_value(value) for key,value in dict(rows[0]).items()}
            record["embedding"] = [float(value) for value in record["embedding"]]
            record["embedding_dimension"] = int(record["embedding_dimension"])
            return record
        except Exception as exc:
            raise DependencyError("BigQuery embedding cache lookup failed.") from exc

    def save_embedding(self, record: EmbeddingRecord) -> None:
        query = f"""
            MERGE `{self.dataset}.request_embeddings` target
            USING (SELECT @content_hash AS content_hash) source
            ON target.content_hash=source.content_hash
            WHEN NOT MATCHED THEN INSERT
              (request_id,content_hash,embedding,embedding_model,embedding_dimension,
               canonical_text_version,provider,created_at)
            VALUES
              (@request_id,@content_hash,@embedding,@embedding_model,@embedding_dimension,
               @canonical_text_version,@provider,TIMESTAMP(@created_at))
        """
        config = self.bigquery.QueryJobConfig(query_parameters=[
            self.bigquery.ScalarQueryParameter("request_id","STRING",record.request_id),
            self.bigquery.ScalarQueryParameter("content_hash","STRING",record.content_hash),
            self.bigquery.ArrayQueryParameter("embedding","FLOAT64",record.embedding),
            self.bigquery.ScalarQueryParameter("embedding_model","STRING",record.embedding_model),
            self.bigquery.ScalarQueryParameter("embedding_dimension","INT64",record.embedding_dimension),
            self.bigquery.ScalarQueryParameter("canonical_text_version","STRING",record.canonical_text_version),
            self.bigquery.ScalarQueryParameter("provider","STRING",record.provider),
            self.bigquery.ScalarQueryParameter("created_at","STRING",record.created_at),
        ])
        try:
            self.client.query(query,job_config=config,location=self.location).result()
        except Exception as exc:
            raise DependencyError("BigQuery embedding cache write failed.") from exc
