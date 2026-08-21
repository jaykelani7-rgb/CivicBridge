from types import SimpleNamespace

import pytest

from app.adapters.bigquery.ingestion import BigQueryOfficialDatasetIngestor,OfficialDatasetManifest
from app.domain.errors import DependencyError
from tests.unit.test_dataset_manifest import manifest_payload


class FakeJob:
    def result(self): return []


class FakeClient:
    def __init__(self,fail_load=False):
        self.fail_load=fail_load
        self.loads=[]
        self.queries=[]
        self.deleted=[]
    def load_table_from_uri(self,uri,destination,job_config=None,location=None):
        self.loads.append((uri,destination,job_config,location))
        if self.fail_load: raise RuntimeError("load failed")
        return FakeJob()
    def query(self,query,job_config=None,location=None):
        self.queries.append((query,job_config,location))
        return FakeJob()
    def delete_table(self,table,not_found_ok=False):
        self.deleted.append((table,not_found_ok))


def fake_bigquery():
    return SimpleNamespace(
        SourceFormat=SimpleNamespace(PARQUET="PARQUET",CSV="CSV",NEWLINE_DELIMITED_JSON="NEWLINE_DELIMITED_JSON"),
        WriteDisposition=SimpleNamespace(WRITE_TRUNCATE="WRITE_TRUNCATE"),
        LoadJobConfig=lambda **kwargs:SimpleNamespace(**kwargs),
        QueryJobConfig=lambda query_parameters:SimpleNamespace(query_parameters=query_parameters),
        ScalarQueryParameter=lambda *args:args,
    )


def test_ingestion_dry_run_is_deterministic_and_does_not_contact_cloud():
    client=FakeClient()
    ingestor=BigQueryOfficialDatasetIngestor("project","analytics","raw","US",client=client,bigquery_module=fake_bigquery())
    manifest=OfficialDatasetManifest.model_validate(manifest_payload())
    first=ingestor.ingest(manifest,dry_run=True)
    second=ingestor.ingest(manifest,dry_run=True)
    assert first==second and first["status"]=="dry_run"
    assert not client.loads and not client.queries


def test_ingestion_loads_staging_transforms_and_marks_current_source():
    client=FakeClient()
    ingestor=BigQueryOfficialDatasetIngestor("project","analytics","raw","asia-south1",client=client,bigquery_module=fake_bigquery())
    manifest=OfficialDatasetManifest.model_validate(manifest_payload())
    result=ingestor.ingest(manifest)
    assert result["status"]=="completed"
    assert client.loads[0][0].startswith("gs://")
    assert client.loads[0][1].startswith("project.raw.stg_")
    assert client.deleted==[(client.loads[0][1],True)]
    sql="\n".join(item[0] for item in client.queries)
    assert "ASSERT" in sql
    assert "DELETE FROM `project.analytics.demographic_features` WHERE snapshot_id=@snapshot_id" in sql
    assert "UPDATE `project.analytics.data_sources` SET is_current=FALSE" in sql
    assert "MERGE `project.analytics.ingestion_runs`" in sql
    assert all(item[2]=="asia-south1" for item in client.queries)


def test_failed_ingestion_records_failure_and_preserves_safe_error():
    client=FakeClient(fail_load=True)
    ingestor=BigQueryOfficialDatasetIngestor("project","analytics","raw",client=client,bigquery_module=fake_bigquery())
    with pytest.raises(DependencyError,match="prior current snapshot remains"):
        ingestor.ingest(OfficialDatasetManifest.model_validate(manifest_payload()))
    assert any(("failed",) in [parameter[2:] for parameter in item[1].query_parameters]
               for item in client.queries if item[1])
