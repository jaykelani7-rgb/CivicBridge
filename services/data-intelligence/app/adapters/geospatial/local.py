from __future__ import annotations

import math
import unicodedata
from typing import Optional

from app.domain.errors import DomainError
from app.domain.models import Geography
from app.repositories.sqlite import SQLiteRepository


def _normalized_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return " ".join("".join(c for c in decomposed if not unicodedata.combining(c)).split())


def point_in_polygon(latitude: float, longitude: float, polygon: list[list[float]]) -> bool:
    """Ray-casting containment for small local WGS84 fixture polygons."""
    inside = False
    j = len(polygon) - 1
    for i, (x_i, y_i) in enumerate(polygon):
        x_j, y_j = polygon[j]
        crosses = (y_i > latitude) != (y_j > latitude)
        if crosses:
            x_at_y = (x_j - x_i) * (latitude - y_i) / (y_j - y_i) + x_i
            if longitude < x_at_y:
                inside = not inside
        j = i
    return inside


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def stable_grid_cell(latitude: float, longitude: float, resolution: int) -> str:
    """Stable privacy-preserving rectangular grid fallback when H3 is unavailable."""
    step = 1.0 / (2 ** resolution)
    lat_index = math.floor((latitude + 90.0) / step)
    lon_index = math.floor((longitude + 180.0) / step)
    return f"grid-r{resolution}-{lat_index:x}-{lon_index:x}"


class LocalGeographyProvider:
    def __init__(self, repository: SQLiteRepository, grid_resolution: int) -> None:
        self.repository = repository
        self.grid_resolution = grid_resolution

    def resolve(
        self,
        country_code: str,
        *,
        latitude: Optional[float],
        longitude: Optional[float],
        administrative_id: Optional[str],
        location_mentions: list[str],
    ) -> Geography:
        units = self.repository.list_admin_units(country_code)
        selected: Optional[dict] = None
        confidence = 0.0

        if latitude is not None and longitude is not None:
            matches = [u for u in units if point_in_polygon(latitude, longitude, u["polygon"])]
            if matches:
                selected = min(matches, key=lambda u: haversine_km(latitude, longitude, u["centroid_lat"], u["centroid_lon"]))
                confidence = 0.97 if len(matches) == 1 else 0.90
        elif administrative_id:
            selected = self.repository.get_admin_unit(administrative_id)
            if selected and selected["country_code"] == country_code:
                latitude, longitude, confidence = selected["centroid_lat"], selected["centroid_lon"], 0.92
            else:
                selected = None
        else:
            normalized_mentions = [_normalized_text(x) for x in location_mentions]
            scored = []
            for unit in units:
                aliases = {_normalized_text(x) for x in [unit["geography_id"], unit["locality"], unit["admin2"], *unit["aliases"]]}
                score = sum(any(alias in mention or mention in alias for alias in aliases) for mention in normalized_mentions)
                if score:
                    scored.append((score, unit))
            scored.sort(key=lambda x: (-x[0], x[1]["geography_id"]))
            if scored and (len(scored) == 1 or scored[0][0] > scored[1][0]):
                selected = scored[0][1]
                latitude, longitude = selected["centroid_lat"], selected["centroid_lon"]
                confidence = min(0.88, 0.68 + 0.10 * scored[0][0])

        if not selected or latitude is None or longitude is None:
            raise DomainError("LOCATION_AMBIGUOUS", "The approximate location could not be resolved uniquely.", details=[{"field": "location", "reason": "manual geography review required"}])

        return Geography(
            geography_id=selected["geography_id"], country_code=country_code, admin1=selected["admin1"],
            admin2=selected["admin2"], locality=selected["locality"],
            spatial_cell=stable_grid_cell(latitude, longitude, self.grid_resolution),
            latitude=float(latitude), longitude=float(longitude), confidence=confidence,
            boundary_source=selected["boundary_source"], boundary_version=selected["boundary_version"],
        )
