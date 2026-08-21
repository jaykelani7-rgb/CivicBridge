from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.adapters.geospatial.local import LocalGeographyProvider
from app.adapters.bigquery.geography import BigQueryGeographyProvider
from app.adapters.bigquery.repository import BigQueryAnalyticalRepository
from app.adapters.local.fixtures import load_fixtures
from app.adapters.pubsub.publisher import InMemoryEventPublisher, PubSubEventPublisher
from app.adapters.similarity.factory import build_similarity_service
from app.api.routes import router
from app.config.logging import configure_logging
from app.config.settings import Settings
from app.domain.errors import DomainError
from app.domain.models import Metrics
from app.domain.ports import FallbackAnalyticalRepository, FallbackEmbeddingRepository, FallbackGeographyProvider
from app.repositories.sqlite import SQLiteRepository
from app.services.duplicates import DuplicateDetector
from app.services.outbox import OutboxDispatcher
from app.services.pipeline import IntelligencePipeline
from app.services.scoring import ScoringEngine
from app.workers.consumer import NormalizedRequestConsumer


BASE_DIR = Path(__file__).resolve().parents[1]


def _error(code: str, message: str, retryable: bool, details: list, trace_id: str, status: int) -> JSONResponse:
    return JSONResponse(status_code=status,content={"error":{"code":code,"message":message,"retryable":retryable,"details":details,"trace_id":trace_id}})


def create_app(settings: Optional[Settings] = None, *, publisher=None) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging(settings.log_level,settings.environment)
    repository = SQLiteRepository(settings.database_path,BASE_DIR / "migrations")
    fixture_dir = settings.resolved_fixture_dir()
    load_fixtures(repository,fixture_dir,settings.country_packs)
    local_geography = LocalGeographyProvider(repository,settings.grid_resolution)
    primary_analytical_repository = repository
    analytical_repository = repository
    if settings.analytical_backend == "bigquery":
        primary_analytical_repository = BigQueryAnalyticalRepository(
            settings.bigquery_project or "",settings.bigquery_dataset or "",settings.bigquery_location
        )
        analytical_repository = (FallbackAnalyticalRepository(primary_analytical_repository,repository)
                                 if settings.allow_local_fallback else primary_analytical_repository)
    geography = local_geography
    primary_geography = local_geography
    if settings.geography_provider == "bigquery":
        primary_geography = BigQueryGeographyProvider(
            settings.bigquery_project or "",settings.bigquery_dataset or "",settings.bigquery_s2_level,settings.bigquery_location
        )
        geography = (FallbackGeographyProvider(primary_geography,local_geography)
                     if settings.allow_local_fallback else primary_geography)
    scoring_path = BASE_DIR / "app" / "config" / "scoring" / f"{settings.score_version}.json"
    scoring = ScoringEngine(scoring_path)
    metrics = Metrics()
    publisher = publisher or (PubSubEventPublisher(settings.pubsub_project or "",settings.pubsub_topic)
                              if settings.event_bus == "pubsub" else InMemoryEventPublisher())
    outbox = OutboxDispatcher(repository,publisher,metrics)
    embedding_repository = repository
    if settings.analytical_backend == "bigquery":
        embedding_repository = (FallbackEmbeddingRepository(primary_analytical_repository,repository)
                                if settings.allow_local_fallback else primary_analytical_repository)
    similarity_service = build_similarity_service(settings,embedding_repository)
    detector = DuplicateDetector(repository,settings.duplicate_distance_km,settings.duplicate_time_window_days,
                                 settings.duplicate_high_threshold,settings.duplicate_review_threshold,
                                 similarity_service)
    pipeline = IntelligencePipeline(repository,geography,detector,scoring,outbox,metrics,analytical_repository)
    app = FastAPI(title="CivicBridge Data Intelligence API",version="1.0.0",
                  description="Deterministic geospatial enrichment, clustering, hotspot scoring, and bounded evidence.")
    app.state.settings,app.state.repository,app.state.publisher = settings,repository,publisher
    app.state.analytical_repository = analytical_repository
    app.state.similarity_service = similarity_service
    app.state.primary_analytical_repository = primary_analytical_repository
    app.state.primary_geography_provider = primary_geography
    app.state.pipeline,app.state.consumer,app.state.metrics = pipeline,NormalizedRequestConsumer(pipeline),metrics
    app.include_router(router)

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        trace = request.headers.get("X-Trace-Id",str(uuid4()))
        return _error(exc.code,exc.message,exc.retryable,exc.details,trace,exc.http_status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        trace = request.headers.get("X-Trace-Id",str(uuid4()))
        details = [{"field":".".join(str(x) for x in e["loc"]),"reason":e["msg"]} for e in exc.errors()]
        code = "SCHEMA_VERSION_UNSUPPORTED" if any("schema_version" in x["field"] for x in details) else "NORMALIZED_REQUEST_INVALID"
        return _error(code,"The request payload failed validation.",False,details,trace,422)
    return app


app = create_app()
