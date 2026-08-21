from datetime import date
from types import SimpleNamespace

from app.adapters.bigquery.repository import BigQueryAnalyticalRepository
from app.domain.errors import DependencyError
from app.domain.ports import FallbackAnalyticalRepository


class FakeJob:
    def __init__(self,rows): self.rows=rows
    def result(self): return self.rows


class FakeClient:
    def __init__(self): self.queries=[]
    def query(self,query,job_config=None,location=None):
        self.queries.append((query,job_config,location))
        if "current_demographic_features" in query:
            rows=[{"feature_id":"dem1","geography_id":"g1","population":1000,"equity_vulnerability":70,
                   "reference_year":2025,"source_id":"src1","dataset_version":"2025-v1"}]
        elif "current_infrastructure_indices" in query:
            rows=[{"feature_id":"inf1","geography_id":"g1","category":"water","infrastructure_gap":80,
                   "existing_facility_coverage":20,"reference_year":2025,"source_id":"src1","dataset_version":"2025-v1"}]
        elif "current_investment_projects" in query:
            rows=[]
        elif "current_data_sources" in query:
            rows=[{"source_id":"src1","publisher":"Official Publisher","retrieved_at":date(2026,8,20),
                   "synthetic":False,"is_current":True,"confidence":0.95}]
        else: rows=[{"ok":1}]
        return FakeJob(rows)


def fake_bigquery():
    return SimpleNamespace(
        ScalarQueryParameter=lambda *args:args,
        ArrayQueryParameter=lambda *args:args,
        QueryJobConfig=lambda query_parameters:SimpleNamespace(query_parameters=query_parameters),
    )


def test_repository_reads_only_current_provenance_views_with_parameters():
    client=FakeClient()
    repository=BigQueryAnalyticalRepository("project","dataset","asia-south1",client=client,bigquery_module=fake_bigquery())
    result=repository.get_enrichment("g1","water")
    assert result["demographic"]["population"]==1000
    assert result["sources"][0]["retrieved_at"]=="2026-08-20"
    assert result["sources"][0]["synthetic"] is False
    queries=[item[0] for item in client.queries]
    assert all("current_" in query for query in queries)
    assert all("g1" not in query and "water" not in query for query in queries)
    assert all(item[2]=="asia-south1" for item in client.queries)


def test_repository_ping_uses_configured_location():
    client=FakeClient()
    repository=BigQueryAnalyticalRepository("project","dataset","EU",client=client,bigquery_module=fake_bigquery())
    assert repository.ping()
    assert client.queries[0][2]=="EU"


def test_analytical_fallback_preserves_local_result_on_dependency_failure():
    class Primary:
        def ping(self): raise DependencyError("offline")
        def get_enrichment(self,geography_id,category): raise DependencyError("offline")
    class Local:
        def ping(self): return True
        def get_enrichment(self,geography_id,category): return {"sources":[{"source_id":"local"}]}
    result=FallbackAnalyticalRepository(Primary(),Local()).get_enrichment("g1","water")
    assert result["sources"][0]["source_id"]=="local"
