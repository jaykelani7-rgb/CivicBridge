from __future__ import annotations

import hashlib
import json
import re
from datetime import date
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.domain.errors import DependencyError, DomainError


TargetTable = Literal["admin_units","demographic_features","infrastructure_indices","investment_projects"]
SourceFormat = Literal["PARQUET","CSV","NEWLINE_DELIMITED_JSON"]


class OfficialDatasetAsset(BaseModel):
    model_config=ConfigDict(extra="forbid")
    asset_id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{2,62}$")
    uri: str
    target_table: TargetTable
    source_format: SourceFormat
    normalized_schema_version: Literal["official-normalized-1.0.0"]
    description: str = Field(min_length=3,max_length=500)

    @field_validator("uri")
    @classmethod
    def require_cloud_storage(cls,value: str) -> str:
        if not value.startswith("gs://") or value.count("/")<3:
            raise ValueError("official dataset assets must use a gs:// object URI")
        return value


class OfficialDatasetManifest(BaseModel):
    model_config=ConfigDict(extra="forbid")
    manifest_version: Literal["official-dataset-manifest-1.0.0"]
    dataset_id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{2,62}$")
    dataset_version: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
    source_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$")
    publisher: str = Field(min_length=2,max_length=300)
    dataset_title: str = Field(min_length=3,max_length=500)
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    geographic_coverage: str = Field(min_length=2,max_length=500)
    time_coverage: str = Field(min_length=1,max_length=200)
    retrieved_at: date
    license: Optional[str] = Field(default=None,max_length=300)
    source_url: HttpUrl
    transformation_notes: str = Field(min_length=10,max_length=2000)
    confidence: float = Field(ge=0,le=1)
    freshness_status: Literal["current","stale","historical"]
    synthetic: Literal[False]
    assets: list[OfficialDatasetAsset] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_assets(self) -> "OfficialDatasetManifest":
        identifiers=[asset.asset_id for asset in self.assets]
        if len(identifiers)!=len(set(identifiers)):
            raise ValueError("asset_id values must be unique")
        targets=[asset.target_table for asset in self.assets]
        if len(targets)!=len(set(targets)):
            raise ValueError("one normalized asset per target table is allowed in a manifest")
        return self

    @field_validator("source_url")
    @classmethod
    def require_https_source(cls,value: HttpUrl) -> HttpUrl:
        if value.scheme!="https":
            raise ValueError("official publisher source_url must use HTTPS")
        return value

    @property
    def snapshot_id(self) -> str:
        canonical=json.dumps(self.model_dump(mode="json"),sort_keys=True,separators=(",",":"),ensure_ascii=False)
        return "snap_"+hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]

    @classmethod
    def from_path(cls,path: Path) -> "OfficialDatasetManifest":
        return cls.model_validate_json(path.read_text(encoding="utf-8"))


class BigQueryOfficialDatasetIngestor:
    """Load normalized official snapshots from Cloud Storage into versioned BigQuery tables."""

    TARGET_COLUMNS={
        "admin_units":("geography_id,country_code,admin1,admin2,locality,centroid_lat,centroid_lon,"
                       "boundary_geography,aliases,boundary_source,boundary_version,source_id,dataset_version,snapshot_id,ingested_at"),
        "demographic_features":("feature_id,geography_id,population,equity_vulnerability,reference_year,source_id,"
                                "dataset_version,snapshot_id,ingested_at"),
        "infrastructure_indices":("feature_id,geography_id,category,infrastructure_gap,existing_facility_coverage,reference_year,"
                                  "source_id,dataset_version,snapshot_id,ingested_at"),
        "investment_projects":("project_id,geography_id,category,name,status,strategic_alignment,delivery_readiness,"
                               "existing_coverage_penalty,source_id,dataset_version,snapshot_id,ingested_at"),
    }

    def __init__(self,project: str,dataset: str,raw_dataset: str,location: str="US",*,
                 client: Optional[Any]=None,bigquery_module: Optional[Any]=None) -> None:
        for value in (project,dataset,raw_dataset):
            if not re.fullmatch(r"[A-Za-z0-9_-]+",value):
                raise ValueError("BigQuery identifier is invalid")
        if bigquery_module is None:
            try:
                from google.cloud import bigquery as bigquery_module
            except ImportError as exc:
                raise DependencyError("Install the production extra to ingest official datasets.") from exc
        self.bigquery=bigquery_module
        self.client=client or bigquery_module.Client(project=project,location=location)
        self.project,self.dataset,self.raw_dataset,self.location=project,dataset,raw_dataset,location

    def plan(self,manifest: OfficialDatasetManifest) -> dict[str,Any]:
        assets=[]
        for asset in manifest.assets:
            staging=self._staging_name(manifest,asset)
            assets.append({"asset_id":asset.asset_id,"uri":asset.uri,"source_format":asset.source_format,
                           "staging_table":f"{self.project}.{self.raw_dataset}.{staging}",
                           "target_table":f"{self.project}.{self.dataset}.{asset.target_table}"})
        return {"snapshot_id":manifest.snapshot_id,"dataset_id":manifest.dataset_id,
                "dataset_version":manifest.dataset_version,"assets":assets}

    def ingest(self,manifest: OfficialDatasetManifest,*,dry_run: bool=False) -> dict[str,Any]:
        plan=self.plan(manifest)
        if dry_run:
            return {**plan,"status":"dry_run"}
        self._record_run(manifest,"running",None)
        try:
            for asset in manifest.assets:
                staging=self._staging_name(manifest,asset)
                config=self.bigquery.LoadJobConfig(
                    source_format=getattr(self.bigquery.SourceFormat,asset.source_format),
                    write_disposition=self.bigquery.WriteDisposition.WRITE_TRUNCATE,
                    autodetect=True,
                )
                destination=f"{self.project}.{self.raw_dataset}.{staging}"
                self.client.load_table_from_uri(asset.uri,destination,job_config=config,location=self.location).result()
                self.client.query(self._transform_sql(asset,staging),job_config=self._metadata_config(manifest),
                                  location=self.location).result()
                self.client.delete_table(destination,not_found_ok=True)
            self.client.query(self._source_sql(),job_config=self._metadata_config(manifest),location=self.location).result()
            self._record_run(manifest,"completed",None)
        except Exception as exc:
            try:
                self._record_run(manifest,"failed",type(exc).__name__)
            except Exception:
                pass
            raise DependencyError("Official dataset ingestion failed; the prior current snapshot remains available.") from exc
        return {**plan,"status":"completed"}

    def ingest_path(self,path: Path,*,dry_run: bool=False) -> dict[str,Any]:
        return self.ingest(OfficialDatasetManifest.from_path(path),dry_run=dry_run)

    def _staging_name(self,manifest: OfficialDatasetManifest,asset: OfficialDatasetAsset) -> str:
        raw=f"stg_{manifest.dataset_id}_{asset.asset_id}_{manifest.snapshot_id[-8:]}"
        return re.sub(r"[^A-Za-z0-9_]","_",raw)[:1024]

    def _metadata_config(self,manifest: OfficialDatasetManifest):
        return self.bigquery.QueryJobConfig(query_parameters=[
            self.bigquery.ScalarQueryParameter("snapshot_id","STRING",manifest.snapshot_id),
            self.bigquery.ScalarQueryParameter("dataset_id","STRING",manifest.dataset_id),
            self.bigquery.ScalarQueryParameter("dataset_version","STRING",manifest.dataset_version),
            self.bigquery.ScalarQueryParameter("source_id","STRING",manifest.source_id),
            self.bigquery.ScalarQueryParameter("publisher","STRING",manifest.publisher),
            self.bigquery.ScalarQueryParameter("dataset_title","STRING",manifest.dataset_title),
            self.bigquery.ScalarQueryParameter("country_code","STRING",manifest.country_code),
            self.bigquery.ScalarQueryParameter("geographic_coverage","STRING",manifest.geographic_coverage),
            self.bigquery.ScalarQueryParameter("time_coverage","STRING",manifest.time_coverage),
            self.bigquery.ScalarQueryParameter("retrieved_at","DATE",manifest.retrieved_at),
            self.bigquery.ScalarQueryParameter("license","STRING",manifest.license),
            self.bigquery.ScalarQueryParameter("source_url","STRING",str(manifest.source_url)),
            self.bigquery.ScalarQueryParameter("transformation_notes","STRING",manifest.transformation_notes),
            self.bigquery.ScalarQueryParameter("confidence","FLOAT64",manifest.confidence),
            self.bigquery.ScalarQueryParameter("freshness_status","STRING",manifest.freshness_status),
        ])

    def _transform_sql(self,asset: OfficialDatasetAsset,staging: str) -> str:
        target=f"`{self.project}.{self.dataset}.{asset.target_table}`"
        source=f"`{self.project}.{self.raw_dataset}.{staging}`"
        if asset.target_table=="admin_units":
            select=("geography_id,country_code,admin1,admin2,locality,centroid_lat,centroid_lon,"
                    "ST_GEOGFROMTEXT(boundary_wkt),aliases,@dataset_title,@dataset_version,@source_id,"
                    "@dataset_version,@snapshot_id,CURRENT_TIMESTAMP()")
            validation=("ASSERT (SELECT COUNT(*) FROM {source})>0 AS 'staged asset is empty'; "
                        "ASSERT NOT EXISTS(SELECT 1 FROM {source} WHERE geography_id IS NULL OR country_code!=@country_code "
                        "OR centroid_lat NOT BETWEEN -90 AND 90 OR centroid_lon NOT BETWEEN -180 AND 180 "
                        "OR boundary_wkt IS NULL) AS 'invalid administrative boundary record'; ")
        else:
            base={
                "demographic_features":"feature_id,geography_id,population,equity_vulnerability,reference_year",
                "infrastructure_indices":"feature_id,geography_id,category,infrastructure_gap,existing_facility_coverage,reference_year",
                "investment_projects":"project_id,geography_id,category,name,status,strategic_alignment,delivery_readiness,existing_coverage_penalty",
            }[asset.target_table]
            select=f"{base},@source_id,@dataset_version,@snapshot_id,CURRENT_TIMESTAMP()"
            rules={
                "demographic_features":("feature_id IS NULL OR geography_id IS NULL OR population<0 "
                                        "OR equity_vulnerability NOT BETWEEN 0 AND 100 OR reference_year<1900"),
                "infrastructure_indices":("feature_id IS NULL OR geography_id IS NULL OR category IS NULL "
                                          "OR infrastructure_gap NOT BETWEEN 0 AND 100 "
                                          "OR existing_facility_coverage NOT BETWEEN 0 AND 100 OR reference_year<1900"),
                "investment_projects":("project_id IS NULL OR geography_id IS NULL OR category IS NULL OR name IS NULL "
                                       "OR strategic_alignment NOT BETWEEN 0 AND 100 OR delivery_readiness NOT BETWEEN 0 AND 100 "
                                       "OR existing_coverage_penalty NOT BETWEEN 0 AND 100"),
            }[asset.target_table]
            validation=("ASSERT (SELECT COUNT(*) FROM {source})>0 AS 'staged asset is empty'; "
                        f"ASSERT NOT EXISTS(SELECT 1 FROM {{source}} WHERE {rules}) AS 'invalid normalized feature record'; ")
        validation=validation.format(source=source)
        return (f"{validation} BEGIN TRANSACTION; DELETE FROM {target} WHERE snapshot_id=@snapshot_id; "
                f"INSERT INTO {target} ({self.TARGET_COLUMNS[asset.target_table]}) SELECT {select} FROM {source}; COMMIT TRANSACTION;")

    def _source_sql(self) -> str:
        table=f"`{self.project}.{self.dataset}.data_sources`"
        return f"""
            BEGIN TRANSACTION;
            UPDATE {table} SET is_current=FALSE WHERE source_id=@source_id AND is_current=TRUE;
            DELETE FROM {table} WHERE source_id=@source_id AND snapshot_id=@snapshot_id;
            INSERT INTO {table} (source_id,dataset_id,dataset_version,snapshot_id,publisher,dataset_title,country_code,
              geographic_coverage,time_coverage,retrieved_at,license,source_url,transformation_notes,confidence,
              freshness_status,synthetic,is_current,ingested_at)
            VALUES (@source_id,@dataset_id,@dataset_version,@snapshot_id,@publisher,@dataset_title,@country_code,
              @geographic_coverage,@time_coverage,@retrieved_at,@license,@source_url,@transformation_notes,@confidence,
              @freshness_status,FALSE,TRUE,CURRENT_TIMESTAMP());
            COMMIT TRANSACTION;
        """

    def _record_run(self,manifest: OfficialDatasetManifest,status: str,error_code: Optional[str]) -> None:
        table=f"`{self.project}.{self.dataset}.ingestion_runs`"
        query=f"""
            MERGE {table} target USING (SELECT @snapshot_id snapshot_id) source
            ON target.snapshot_id=source.snapshot_id
            WHEN MATCHED THEN UPDATE SET status=@status,error_code=@error_code,updated_at=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (snapshot_id,dataset_id,dataset_version,status,error_code,created_at,updated_at)
              VALUES (@snapshot_id,@dataset_id,@dataset_version,@status,@error_code,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP())
        """
        config=self.bigquery.QueryJobConfig(query_parameters=[
            self.bigquery.ScalarQueryParameter("snapshot_id","STRING",manifest.snapshot_id),
            self.bigquery.ScalarQueryParameter("dataset_id","STRING",manifest.dataset_id),
            self.bigquery.ScalarQueryParameter("dataset_version","STRING",manifest.dataset_version),
            self.bigquery.ScalarQueryParameter("status","STRING",status),
            self.bigquery.ScalarQueryParameter("error_code","STRING",error_code),
        ])
        self.client.query(query,job_config=config,location=self.location).result()
