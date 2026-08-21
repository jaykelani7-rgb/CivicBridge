from types import SimpleNamespace

import pytest

from app.adapters.bigquery.geography import BigQueryGeographyProvider
from app.domain.errors import DomainError
from app.domain.ports import FallbackGeographyProvider


class FakeJob:
    def __init__(self,rows): self.rows=rows
    def result(self): return self.rows


class FakeClient:
    def __init__(self):
        self.queries=[]
        self.rows=[]

    def query(self,query,job_config=None,location=None):
        self.queries.append((query,job_config,location))
        return FakeJob(self.rows)


def fake_bigquery():
    return SimpleNamespace(
        ScalarQueryParameter=lambda *args:args,
        ArrayQueryParameter=lambda *args:args,
        QueryJobConfig=lambda query_parameters:SimpleNamespace(query_parameters=query_parameters),
    )


def geography_row(**overrides):
    row={"geography_id":"IN-RJ-JPR-W42","country_code":"IN","admin1":"Rajasthan","admin2":"Jaipur",
         "locality":"Ward 42","centroid_lat":26.91,"centroid_lon":75.78,"boundary_source":"official-test",
         "boundary_version":"2026-v1","spatial_cell":"s2-l13-123"}
    row.update(overrides)
    return row


def test_bigquery_gis_adapter_uses_parameterized_s2_containment():
    client=FakeClient()
    client.rows=[geography_row()]
    provider=BigQueryGeographyProvider("project","dataset",13,client=client,bigquery_module=fake_bigquery())
    geography=provider.resolve("IN",latitude=26.91,longitude=75.78,administrative_id=None,location_mentions=[])
    query,config,location=client.queries[0]
    assert "ST_COVERS" in query and "ST_GEOGPOINT" in query and "S2_CELLIDFROMPOINT" in query
    assert len(config.query_parameters)==4
    assert geography.geography_id=="IN-RJ-JPR-W42"
    assert geography.spatial_cell.startswith("s2-l13-")
    assert geography.confidence==0.98
    assert location=="US"


def test_bigquery_geography_resolution_priority_and_admin_lookup():
    client=FakeClient()
    client.rows=[geography_row()]
    provider=BigQueryGeographyProvider("project","dataset",13,client=client,bigquery_module=fake_bigquery())
    provider.resolve("IN",latitude=None,longitude=None,administrative_id="IN-RJ-JPR-W42",location_mentions=["ignored"])
    assert "geography_id=@administrative_id" in client.queries[0][0]


def test_bigquery_gazetteer_tie_routes_to_review():
    client=FakeClient()
    client.rows=[geography_row(match_score=2),geography_row(geography_id="IN-RJ-JPR-W18",match_score=2)]
    provider=BigQueryGeographyProvider("project","dataset",13,client=client,bigquery_module=fake_bigquery())
    with pytest.raises(DomainError,match="location mentions"):
        provider.resolve("IN",latitude=None,longitude=None,administrative_id=None,location_mentions=["Jaipur"])


def test_geography_fallback_preserves_local_provider_on_bigquery_miss(app):
    client=FakeClient()
    provider=BigQueryGeographyProvider("project","dataset",13,client=client,bigquery_module=fake_bigquery())
    fallback=FallbackGeographyProvider(provider,app.state.pipeline.geography_provider)
    geography=fallback.resolve("IN",latitude=None,longitude=None,administrative_id=None,location_mentions=["Ward 42","Jaipur"])
    assert geography.geography_id=="IN-RJ-JPR-W42"
    assert geography.spatial_cell.startswith("grid-r")
