from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

from app.domain.errors import DependencyError, DomainError
from app.domain.models import Geography


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD",value.casefold())
    return " ".join("".join(c for c in decomposed if not unicodedata.combining(c)).split())


class BigQueryGeographyProvider:
    """Resolve coordinates, administrative IDs, or gazetteer mentions with BigQuery GIS."""

    def __init__(
        self,
        project: str,
        dataset: str,
        s2_level: int,
        location: str = "US",
        *,
        client: Optional[Any] = None,
        bigquery_module: Optional[Any] = None,
    ) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_-]+",project) or not re.fullmatch(r"[A-Za-z0-9_]+",dataset):
            raise ValueError("BigQuery project or dataset identifier is invalid")
        if bigquery_module is None:
            try:
                from google.cloud import bigquery as bigquery_module
            except ImportError as exc:
                raise DependencyError("Install the production extra to use BigQuery GIS.") from exc
        self.bigquery = bigquery_module
        self.client = client or bigquery_module.Client(project=project,location=location)
        self.table = f"`{project}.{dataset}.current_admin_units`"
        if not 0<=s2_level<=30:
            raise ValueError("BigQuery S2 level must be between 0 and 30")
        self.s2_level=s2_level
        self.location = location

    def _query(self, sql: str, parameters: list[Any]) -> list[dict[str,Any]]:
        config = self.bigquery.QueryJobConfig(query_parameters=parameters)
        try:
            return [dict(row) for row in self.client.query(sql,job_config=config,location=self.location).result()]
        except Exception as exc:
            raise DependencyError("BigQuery GIS geography lookup failed.") from exc

    def _to_geography(self, row: dict[str,Any], latitude: float, longitude: float, confidence: float) -> Geography:
        return Geography(
            geography_id=row["geography_id"],country_code=row["country_code"],admin1=row["admin1"],
            admin2=row["admin2"],locality=row["locality"],spatial_cell=row["spatial_cell"],
            latitude=float(latitude),longitude=float(longitude),confidence=confidence,
            boundary_source=row["boundary_source"],boundary_version=row["boundary_version"],
        )

    def resolve_coordinates(self,country_code: str,latitude: float,longitude: float) -> Geography:
        query = f"""
            SELECT geography_id,country_code,admin1,admin2,locality,boundary_source,boundary_version,
                   CONCAT('s2-l',CAST(@s2_level AS STRING),'-',CAST(S2_CELLIDFROMPOINT(
                       ST_GEOGPOINT(@longitude,@latitude),@s2_level) AS STRING)) AS spatial_cell
            FROM {self.table}
            WHERE country_code=@country_code
              AND ST_COVERS(boundary_geography,ST_GEOGPOINT(@longitude,@latitude))
            ORDER BY ST_AREA(boundary_geography),boundary_version DESC
            LIMIT 1
        """
        rows = self._query(query,[
            self.bigquery.ScalarQueryParameter("country_code","STRING",country_code),
            self.bigquery.ScalarQueryParameter("longitude","FLOAT64",longitude),
            self.bigquery.ScalarQueryParameter("latitude","FLOAT64",latitude),
            self.bigquery.ScalarQueryParameter("s2_level","INT64",self.s2_level),
        ])
        if not rows:
            raise DomainError("GEOGRAPHY_NOT_FOUND","No current administrative boundary contains the approximate location.")
        return self._to_geography(rows[0],latitude,longitude,0.98)

    def resolve_administrative_id(self,country_code: str,administrative_id: str) -> Geography:
        query = f"""
            SELECT geography_id,country_code,admin1,admin2,locality,centroid_lat,centroid_lon,
                   boundary_source,boundary_version,
                   CONCAT('s2-l',CAST(@s2_level AS STRING),'-',CAST(S2_CELLIDFROMPOINT(
                       ST_GEOGPOINT(centroid_lon,centroid_lat),@s2_level) AS STRING)) AS spatial_cell
            FROM {self.table}
            WHERE country_code=@country_code AND geography_id=@administrative_id
            ORDER BY boundary_version DESC LIMIT 1
        """
        rows = self._query(query,[
            self.bigquery.ScalarQueryParameter("country_code","STRING",country_code),
            self.bigquery.ScalarQueryParameter("administrative_id","STRING",administrative_id),
            self.bigquery.ScalarQueryParameter("s2_level","INT64",self.s2_level),
        ])
        if not rows:
            raise DomainError("GEOGRAPHY_NOT_FOUND","The supplied administrative identifier is not in the current boundary version.")
        row=rows[0]
        return self._to_geography(row,row["centroid_lat"],row["centroid_lon"],0.94)

    def resolve_mentions(self,country_code: str,location_mentions: list[str]) -> Geography:
        mentions=sorted({_normalize(value) for value in location_mentions if value.strip()})
        query=f"""
            SELECT geography_id,country_code,admin1,admin2,locality,centroid_lat,centroid_lon,
                   boundary_source,boundary_version,
                   CONCAT('s2-l',CAST(@s2_level AS STRING),'-',CAST(S2_CELLIDFROMPOINT(
                       ST_GEOGPOINT(centroid_lon,centroid_lat),@s2_level) AS STRING)) AS spatial_cell,
                   COUNTIF(LOWER(alias) IN UNNEST(@mentions)) * 2
                     + COUNTIF(EXISTS(SELECT 1 FROM UNNEST(@mentions) mention WHERE STRPOS(LOWER(alias),mention)>0)) AS match_score
            FROM {self.table},UNNEST(aliases) alias
            WHERE country_code=@country_code
            GROUP BY geography_id,country_code,admin1,admin2,locality,centroid_lat,centroid_lon,
                     boundary_source,boundary_version,spatial_cell
            HAVING match_score>0
            ORDER BY match_score DESC,boundary_version DESC,geography_id
            LIMIT 2
        """
        rows=self._query(query,[
            self.bigquery.ScalarQueryParameter("country_code","STRING",country_code),
            self.bigquery.ArrayQueryParameter("mentions","STRING",mentions),
            self.bigquery.ScalarQueryParameter("s2_level","INT64",self.s2_level),
        ])
        if not rows or (len(rows)>1 and rows[0]["match_score"]==rows[1]["match_score"]):
            raise DomainError("LOCATION_AMBIGUOUS","The location mentions do not identify one current administrative boundary.")
        row=rows[0]
        confidence=min(0.90,0.72+0.06*float(row["match_score"]))
        return self._to_geography(row,row["centroid_lat"],row["centroid_lon"],confidence)

    def resolve(self,country_code: str,*,latitude: Optional[float],longitude: Optional[float],
                administrative_id: Optional[str],location_mentions: list[str]) -> Geography:
        if latitude is not None and longitude is not None:
            return self.resolve_coordinates(country_code,latitude,longitude)
        if administrative_id:
            return self.resolve_administrative_id(country_code,administrative_id)
        if location_mentions:
            return self.resolve_mentions(country_code,location_mentions)
        raise DomainError("LOCATION_AMBIGUOUS","At least one usable geography input is required.")
