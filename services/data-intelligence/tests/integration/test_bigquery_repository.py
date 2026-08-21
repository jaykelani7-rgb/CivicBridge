from datetime import date
from types import SimpleNamespace

from app.adapters.bigquery.repository import BigQueryAnalyticalRepository
from app.domain.errors import DependencyError
from app.domain.models import EmbeddingRecord
from app.domain.ports import FallbackAnalyticalRepository, FallbackEmbeddingRepository


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
        elif "request_embeddings" in query and "SELECT request_id" in query:
            rows=[{"request_id":"r1","content_hash":"hash","embedding":[1.0,0.0],
                   "embedding_model":"model","embedding_dimension":2,"canonical_text_version":"v1",
                   "provider":"vertex","created_at":"2026-08-20T00:00:00Z"}]
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


def test_bigquery_embedding_cache_uses_parameters_and_preserves_metadata():
    client=FakeClient()
    repository=BigQueryAnalyticalRepository("project","dataset",client=client,bigquery_module=fake_bigquery())
    cached=repository.get_embedding("hash")
    assert cached["embedding"]==[1.0,0.0]
    assert "WHERE content_hash=@content_hash" in client.queries[-1][0]
    assert "WHERE content_hash='hash'" not in client.queries[-1][0]
    record=EmbeddingRecord("r1","hash",[1.0,0.0],"model",2,"v1","vertex","2026-08-20T00:00:00Z")
    repository.save_embedding(record)
    query,config,_=client.queries[-1]
    assert "MERGE `project.dataset.request_embeddings`" in query
    assert len(config.query_parameters)==8


def test_bigquery_embedding_failure_falls_back_to_sqlite_compatible_repository():
    class Primary:
        def get_embedding(self,digest): raise DependencyError("offline")
        def save_embedding(self,record): raise DependencyError("offline")
    class Local:
        def __init__(self): self.saved=None
        def get_embedding(self,digest): return {"content_hash":digest}
        def save_embedding(self,record): self.saved=record
    local=Local()
    fallback=FallbackEmbeddingRepository(Primary(),local)
    assert fallback.get_embedding("hash")["content_hash"]=="hash"
    record=EmbeddingRecord("r","hash",[1.0],"model",1,"v1","vertex","now")
    fallback.save_embedding(record)
    assert local.saved==record
