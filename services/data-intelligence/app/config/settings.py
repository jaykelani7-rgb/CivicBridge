from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional


def _env(source: Mapping[str, str], name: str, default: str) -> str:
    return source.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    runtime_mode: str = "local"
    environment: str = "local"
    service_port: int = 8080
    log_level: str = "INFO"
    storage_backend: str = "sqlite"
    analytical_backend: str = "local"
    database_path: str = "./data/intelligence.db"
    fixture_dir: str = "./fixtures"
    geography_provider: str = "local"
    country_packs: tuple[str, ...] = ("IN", "BR", "ZA")
    grid_resolution: int = 3
    duplicate_distance_km: float = 15.0
    duplicate_time_window_days: int = 90
    duplicate_high_threshold: float = 0.85
    duplicate_review_threshold: float = 0.65
    score_version: str = "priority-1.0.0"
    default_page_size: int = 20
    max_page_size: int = 100
    event_bus: str = "memory"
    bigquery_project: Optional[str] = None
    bigquery_dataset: Optional[str] = None
    bigquery_location: str = "US"
    bigquery_s2_level: int = 13
    bigquery_raw_dataset: Optional[str] = None
    allow_local_fallback: bool = True
    pubsub_project: Optional[str] = None
    pubsub_topic: str = "hotspot-updated-v1"
    pubsub_subscription: str = "request-normalized-v1-data-intelligence"

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None) -> "Settings":
        source = os.environ if env is None else env
        runtime_mode = _env(source, "CB_MODE", "local").lower()
        legacy_storage = _env(source, "CB_STORAGE_BACKEND", "sqlite").lower()
        default_analytical = "bigquery" if runtime_mode == "google" or legacy_storage == "bigquery" else "local"
        default_geography = "bigquery" if runtime_mode == "google" else "local"
        settings = cls(
            runtime_mode=runtime_mode,
            environment=_env(source, "CB_ENV", "local"),
            service_port=int(_env(source, "CB_SERVICE_PORT", "8080")),
            log_level=_env(source, "CB_LOG_LEVEL", "INFO").upper(),
            storage_backend="sqlite" if legacy_storage == "bigquery" else legacy_storage,
            analytical_backend=_env(source, "CB_ANALYTICAL_BACKEND", default_analytical).lower(),
            database_path=_env(source, "CB_DATABASE_PATH", "./data/intelligence.db"),
            fixture_dir=_env(source, "CB_FIXTURE_DIR", "./fixtures"),
            geography_provider=_env(source, "CB_GEOGRAPHY_PROVIDER", default_geography).lower(),
            country_packs=tuple(x.strip().upper() for x in _env(source, "CB_COUNTRY_PACKS", "IN,BR,ZA").split(",") if x.strip()),
            grid_resolution=int(_env(source, "CB_GRID_RESOLUTION", "3")),
            duplicate_distance_km=float(_env(source, "CB_DUPLICATE_DISTANCE_KM", "15")),
            duplicate_time_window_days=int(_env(source, "CB_DUPLICATE_TIME_WINDOW_DAYS", "90")),
            duplicate_high_threshold=float(_env(source, "CB_DUPLICATE_HIGH_THRESHOLD", "0.85")),
            duplicate_review_threshold=float(_env(source, "CB_DUPLICATE_REVIEW_THRESHOLD", "0.65")),
            score_version=_env(source, "CB_SCORE_VERSION", "priority-1.0.0"),
            default_page_size=int(_env(source, "CB_DEFAULT_PAGE_SIZE", "20")),
            max_page_size=int(_env(source, "CB_MAX_PAGE_SIZE", "100")),
            event_bus=_env(source, "CB_EVENT_BUS", "memory"),
            bigquery_project=source.get("CB_BIGQUERY_PROJECT") or None,
            bigquery_dataset=source.get("CB_BIGQUERY_DATASET") or None,
            bigquery_location=_env(source, "CB_BIGQUERY_LOCATION", "US"),
            bigquery_s2_level=int(_env(source, "CB_BIGQUERY_S2_LEVEL", "13")),
            bigquery_raw_dataset=source.get("CB_BIGQUERY_RAW_DATASET") or None,
            allow_local_fallback=_env(source, "CB_ALLOW_LOCAL_FALLBACK", "true").lower() in {"1", "true", "yes", "on"},
            pubsub_project=source.get("CB_PUBSUB_PROJECT") or None,
            pubsub_topic=_env(source, "CB_PUBSUB_TOPIC", "hotspot-updated-v1"),
            pubsub_subscription=_env(source, "CB_PUBSUB_SUBSCRIPTION", "request-normalized-v1-data-intelligence"),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if self.runtime_mode not in {"local", "google"}:
            raise ValueError("CB_MODE must be local or google")
        if self.environment not in {"local", "test", "production"}:
            raise ValueError("CB_ENV must be local, test, or production")
        if self.storage_backend != "sqlite":
            raise ValueError("CB_STORAGE_BACKEND must remain sqlite for this release")
        if self.analytical_backend not in {"local", "bigquery"}:
            raise ValueError("CB_ANALYTICAL_BACKEND must be local or bigquery")
        if self.geography_provider not in {"local", "bigquery"}:
            raise ValueError("CB_GEOGRAPHY_PROVIDER must be local or bigquery")
        if self.event_bus not in {"memory", "pubsub"}:
            raise ValueError("CB_EVENT_BUS must be memory or pubsub")
        if not 0 <= self.duplicate_review_threshold < self.duplicate_high_threshold <= 1:
            raise ValueError("duplicate thresholds must satisfy 0 <= review < high <= 1")
        if self.default_page_size < 1 or self.max_page_size < self.default_page_size:
            raise ValueError("pagination limits are invalid")
        if not 0 <= self.grid_resolution <= 8:
            raise ValueError("CB_GRID_RESOLUTION must be between 0 and 8")
        if not 0 <= self.bigquery_s2_level <= 30:
            raise ValueError("CB_BIGQUERY_S2_LEVEL must be between 0 and 30")
        if self.runtime_mode == "google":
            if self.analytical_backend != "bigquery" or self.geography_provider != "bigquery":
                raise ValueError("CB_MODE=google requires BigQuery analytics and geography")
        if self.analytical_backend == "bigquery" or self.geography_provider == "bigquery":
            if not (self.bigquery_project and self.bigquery_dataset):
                raise ValueError("BigQuery project and dataset are required for Google adapters")
            for name, value in (("CB_BIGQUERY_PROJECT", self.bigquery_project), ("CB_BIGQUERY_DATASET", self.bigquery_dataset),
                                ("CB_BIGQUERY_RAW_DATASET", self.bigquery_raw_dataset)):
                if value and not re.fullmatch(r"[A-Za-z0-9_-]+", value):
                    raise ValueError(f"{name} contains an invalid identifier")
            if not re.fullmatch(r"[A-Za-z0-9-]+",self.bigquery_location):
                raise ValueError("CB_BIGQUERY_LOCATION contains an invalid location")
        if self.environment == "production":
            if self.event_bus == "pubsub" and not self.pubsub_project:
                raise ValueError("Pub/Sub project is required in production")

    def resolved_fixture_dir(self) -> Path:
        return Path(self.fixture_dir).expanduser().resolve()

    @property
    def effective_raw_dataset(self) -> Optional[str]:
        if self.bigquery_raw_dataset:
            return self.bigquery_raw_dataset
        return f"{self.bigquery_dataset}_raw" if self.bigquery_dataset else None
