from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from app.domain.errors import DependencyError, DomainError
from app.domain.models import Geography


@runtime_checkable
class AnalyticalRepository(Protocol):
    def ping(self) -> bool: ...
    def get_enrichment(self, geography_id: str, category: str) -> dict[str, Any]: ...


@runtime_checkable
class GeographyProvider(Protocol):
    def resolve(
        self,
        country_code: str,
        *,
        latitude: Optional[float],
        longitude: Optional[float],
        administrative_id: Optional[str],
        location_mentions: list[str],
    ) -> Geography: ...


class FallbackAnalyticalRepository:
    """Use Google analytics first while preserving the complete local MVP fallback."""

    def __init__(self, primary: AnalyticalRepository, fallback: AnalyticalRepository) -> None:
        self.primary = primary
        self.fallback = fallback

    def ping(self) -> bool:
        return self.primary.ping()

    def get_enrichment(self, geography_id: str, category: str) -> dict[str, Any]:
        try:
            result = self.primary.get_enrichment(geography_id, category)
            if result.get("sources"):
                return result
        except DependencyError:
            pass
        return self.fallback.get_enrichment(geography_id, category)


class FallbackGeographyProvider:
    """Use BigQuery GIS first, then the deterministic local boundary/grid provider."""

    FALLBACK_CODES = {"DEPENDENCY_UNAVAILABLE", "GEOGRAPHY_NOT_FOUND", "LOCATION_AMBIGUOUS"}

    def __init__(self, primary: GeographyProvider, fallback: GeographyProvider) -> None:
        self.primary = primary
        self.fallback = fallback

    def resolve(
        self,
        country_code: str,
        *,
        latitude: Optional[float],
        longitude: Optional[float],
        administrative_id: Optional[str],
        location_mentions: list[str],
    ) -> Geography:
        try:
            return self.primary.resolve(
                country_code,
                latitude=latitude,
                longitude=longitude,
                administrative_id=administrative_id,
                location_mentions=location_mentions,
            )
        except DomainError as exc:
            if exc.code not in self.FALLBACK_CODES:
                raise
        return self.fallback.resolve(
            country_code,
            latitude=latitude,
            longitude=longitude,
            administrative_id=administrative_id,
            location_mentions=location_mentions,
        )
