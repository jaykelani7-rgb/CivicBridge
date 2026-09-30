from __future__ import annotations

import base64
import binascii
import json
import logging
import math
from datetime import date
from typing import Optional

from fastapi import APIRouter, Header, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.domain.errors import DomainError, NotFoundError
from app.schemas.api import RecalculateRequest
from app.schemas.events import EventEnvelope, NormalizedRequest, NormalizedRequestEvent
from app.schemas.pubsub import PubSubPushEnvelope

router = APIRouter()
logger = logging.getLogger("civicbridge.data_intelligence")


def _valid_polygon_geojson(points: object) -> Optional[dict]:
    if not isinstance(points, list) or len(points) < 3:
        return None
    valid = all(
        isinstance(point, list) and len(point) == 2
        and all(isinstance(value, (int, float)) for value in point)
        for point in points
    )
    if not valid:
        return None
    ring = [list(point) for point in points]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def _public_geography(admin: dict) -> dict:
    source = str(admin["boundary_source"])
    authoritative = "demo" not in source.lower() and "synthetic" not in source.lower()
    boundary = _valid_polygon_geojson(admin.get("polygon")) if authoritative else None
    limitation = None if boundary else (
        "An approved administrative centroid is shown because an authoritative public boundary is not configured."
    )
    return {
        "geography_id": admin["geography_id"], "country_code": admin["country_code"],
        "admin1": admin["admin1"], "admin2": admin["admin2"], "locality": admin["locality"],
        "public_centroid": {
            "latitude": round(float(admin["centroid_lat"]), 2),
            "longitude": round(float(admin["centroid_lon"]), 2),
            "precision": "administrative_area",
        },
        "boundary_geojson": boundary, "boundary_source": source,
        "boundary_version": admin["boundary_version"], "location_precision": "administrative_area",
        "limitation": limitation,
    }


def _decorate_hotspot(repository, hotspot: dict, decision_metadata=None, *, category_scope: Optional[str] = None) -> dict:
    admin = repository.get_admin_unit(hotspot["geography_id"])
    sources = repository.get_enrichment(hotspot["geography_id"], hotspot["category"]).get("sources", [])
    synthetic = bool(sources) and any(
        bool(source.get("synthetic")) or source.get("classification") == "synthetic_demo" for source in sources
    )
    result = {
        **hotspot, "geography": _public_geography(admin),
        "provenance": {
            "kind": "synthetic" if synthetic else "live", "is_synthetic": synthetic,
            "source_ids": [source["source_id"] for source in sources],
        },
    }
    if decision_metadata:
        _, components = repository.get_latest_score(hotspot["hotspot_id"])
        ranked = repository.list_hotspots_for_ranking(hotspot["country_code"], category_scope)
        result["priority"] = decision_metadata.priority({**hotspot, "score_components": components}, ranked, category_scope=category_scope)
        evidence = repository.get_evidence(hotspot["hotspot_id"])
        result["evidence_readiness"] = evidence.get("evidence_readiness") if evidence else None
    return result


def _push_error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "retryable": status >= 500,
            }
        },
    )


@router.post("/pubsub/request-normalized", tags=["events"], status_code=204)
def receive_normalized_request_push(request: Request, payload: dict) -> Response:
    message_id = None
    event_id = None
    request_id = None
    event_version = None
    try:
        push = PubSubPushEnvelope.model_validate(payload)
        message_id = push.message.message_id
    except ValidationError:
        logger.warning(
            "pubsub_push_rejected",
            extra={
                "result": "permanent_failure",
                "error_code": "PUBSUB_ENVELOPE_INVALID",
            },
        )
        return _push_error(
            "PUBSUB_ENVELOPE_INVALID", "The Pub/Sub push envelope is invalid.", 400
        )
    try:
        decoded = base64.b64decode(push.message.data,validate=True)
    except (binascii.Error, ValueError):
        logger.warning(
            "pubsub_push_rejected",
            extra={
                "pubsub_message_id": message_id,
                "result": "permanent_failure",
                "error_code": "PUBSUB_DATA_INVALID_BASE64",
            },
        )
        return _push_error(
            "PUBSUB_DATA_INVALID_BASE64", "message.data is not valid Base64.", 400
        )
    try:
        raw_event = json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError):
        logger.warning(
            "pubsub_push_rejected",
            extra={
                "pubsub_message_id": message_id,
                "result": "permanent_failure",
                "error_code": "PUBSUB_DATA_INVALID_JSON",
            },
        )
        return _push_error(
            "PUBSUB_DATA_INVALID_JSON",
            "Decoded message.data is not valid JSON.",
            400,
        )
    try:
        event = NormalizedRequestEvent.model_validate(raw_event)
        event_id = str(event.event_id)
        request_id = str(event.data.request_id)
        event_version = event.schema_version
    except ValidationError:
        logger.warning(
            "pubsub_push_rejected",
            extra={
                "pubsub_message_id": message_id,
                "result": "permanent_failure",
                "error_code": "NORMALIZED_REQUEST_INVALID",
            },
        )
        return _push_error(
            "NORMALIZED_REQUEST_INVALID",
            "Decoded event does not match request.normalized.v1.",
            400,
        )

    context = {
        "pubsub_message_id": message_id,
        "event_id": event_id,
        "event_type": event.event_type,
        "request_id": request_id,
        "event_version": event_version,
    }
    try:
        claim = request.app.state.delivery_idempotency.begin(
            event_id, event.event_type, request_id, event_version
        )
    except DomainError as exc:
        logger.warning("pubsub_push_idempotency_failed", extra={**context, "result": "retryable_failure", "error_code": exc.code})
        return _push_error(exc.code, "Delivery idempotency is temporarily unavailable.", 503)
    if claim.duplicate:
        logger.info("pubsub_push_processed", extra={**context, "result": "success", "duplicate_delivery": True})
        return Response(status_code=204)
    if not claim.acquired:
        logger.warning("pubsub_push_processing_in_progress", extra={**context, "result": "retryable_failure", "error_code": "EVENT_ALREADY_PROCESSING"})
        return _push_error("EVENT_ALREADY_PROCESSING", "The event is already being processed.", 503)
    try:
        result = request.app.state.consumer.handle_event(event)
    except DomainError as exc:
        request.app.state.delivery_idempotency.fail(event_id, exc.code)
        status = 503 if exc.retryable else 400
        logger.warning(
            "pubsub_push_processing_failed",
            extra={
                **context,
                "result": (
                    "retryable_failure" if exc.retryable else "permanent_failure"
                ),
                "error_code": exc.code,
                "duplicate_delivery": False,
            },
        )
        return _push_error(
            exc.code, "Normalized request processing failed.", status
        )
    except Exception:
        request.app.state.delivery_idempotency.fail(event_id, "INTERNAL_PROCESSING_FAILURE")
        logger.exception(
            "pubsub_push_processing_failed",
            extra={
                **context,
                "result": "transient_failure",
                "error_code": "INTERNAL_PROCESSING_FAILURE",
                "duplicate_delivery": False,
            },
        )
        return _push_error(
            "INTERNAL_PROCESSING_FAILURE",
            "Normalized request processing is temporarily unavailable.",
            500,
        )

    request.app.state.delivery_idempotency.complete(event_id)
    duplicate = bool(result.get("idempotent_replay", False))
    logger.info(
        "pubsub_push_processed",
        extra={
            **context,
            "result": "success",
            "duplicate_delivery": duplicate,
        },
    )
    return Response(status_code=204)


@router.post("/internal/v1/intelligence/requests/{request_id}/process", tags=["internal"])
def process_request(request_id: str, envelope: EventEnvelope[NormalizedRequest], request: Request) -> dict:
    if str(envelope.data.request_id) != request_id:
        raise DomainError("NORMALIZED_REQUEST_INVALID","Path request_id does not match the event payload.",
                          details=[{"field":"request_id","reason":"path/body mismatch"}],http_status=400)
    return request.app.state.pipeline.process(envelope)


@router.get("/v1/hotspots", tags=["hotspots"])
def list_hotspots(
    request: Request, country_code: Optional[str] = None, category: Optional[str] = None,
    geography_id: Optional[str] = None, date_from: Optional[date] = None, date_to: Optional[date] = None,
    min_need_score: Optional[float] = Query(None,ge=0,le=100), min_action_score: Optional[float] = Query(None,ge=0,le=100),
    min_confidence: Optional[float] = Query(None,ge=0,le=1), status: Optional[str] = None,
    page: int = Query(1,ge=1), page_size: Optional[int] = Query(None,ge=1),
) -> dict:
    settings = request.app.state.settings
    size = page_size or settings.default_page_size
    if size > settings.max_page_size:
        raise DomainError("NORMALIZED_REQUEST_INVALID",f"page_size cannot exceed {settings.max_page_size}.",http_status=422)
    filters = {"country_code":country_code.upper() if country_code else None,"category":category,"geography_id":geography_id,
        "date_from":date_from.isoformat() if date_from else None,"date_to":date_to.isoformat() if date_to else None,
        "min_need_score":min_need_score,"min_action_score":min_action_score,"min_confidence":min_confidence,"status":status}
    items,total = request.app.state.repository.list_hotspots(filters,page,size)
    items = [_decorate_hotspot(request.app.state.repository, item, request.app.state.decision_metadata,
                               category_scope=category) for item in items]
    return {"items":items,"pagination":{"page":page,"page_size":size,"total":total,"pages":math.ceil(total/size) if total else 0}}


@router.get("/v1/hotspots/{hotspot_id}", tags=["hotspots"])
def hotspot_detail(hotspot_id: str, request: Request) -> dict:
    hotspot = request.app.state.repository.get_hotspot(hotspot_id)
    if not hotspot:
        raise NotFoundError("HOTSPOT_NOT_FOUND","The requested hotspot does not exist.")
    admin = request.app.state.repository.get_admin_unit(hotspot["geography_id"])
    return {"hotspot":_decorate_hotspot(request.app.state.repository, hotspot, request.app.state.decision_metadata),
            "geography":_public_geography(admin)}


@router.get("/v1/hotspots/{hotspot_id}/evidence", tags=["hotspots"])
def hotspot_evidence(hotspot_id: str, request: Request) -> dict:
    bundle = request.app.state.repository.get_evidence(hotspot_id)
    if not bundle:
        raise NotFoundError("HOTSPOT_NOT_FOUND","No evidence bundle exists for the requested hotspot.")
    hotspot = request.app.state.repository.get_hotspot(hotspot_id)
    if hotspot:
        _, components = request.app.state.repository.get_latest_score(hotspot_id)
        ranked = request.app.state.repository.list_hotspots_for_ranking(hotspot["country_code"])
        bundle["priority"] = request.app.state.decision_metadata.priority(
            {**hotspot, "score_components": components}, ranked
        )
    return bundle


@router.get("/v1/hotspots/{hotspot_id}/score", tags=["hotspots"])
def hotspot_score(hotspot_id: str, request: Request) -> dict:
    hotspot,components = request.app.state.repository.get_latest_score(hotspot_id)
    if not hotspot:
        raise NotFoundError("HOTSPOT_NOT_FOUND","The requested hotspot does not exist.")
    history = request.app.state.repository.get_score_history(hotspot_id)
    previous = history[1]["action_score"] if len(history) > 1 else None
    ranked = request.app.state.repository.list_hotspots_for_ranking(hotspot["country_code"])
    priority = request.app.state.decision_metadata.priority({**hotspot, "score_components": components}, ranked)
    evidence = request.app.state.repository.get_evidence(hotspot_id) or {}
    return {"hotspot_id":hotspot_id,"need_score":hotspot["need_score"],"action_score":hotspot["action_score"],
        "evidence_confidence":hotspot["evidence_confidence"],"components":components,"warnings":hotspot["warnings"],
        "priority":priority,"evidence_readiness":evidence.get("evidence_readiness"),
        "score_version":hotspot["score_version"],"calculation_timestamp":hotspot["calculated_at"],
        "history":history,"change_since_previous":None if previous is None else round(hotspot["action_score"]-previous,4)}


@router.get("/v1/summary", tags=["operations"])
def public_summary(request: Request) -> dict:
    repository = request.app.state.repository
    hotspots, _ = repository.list_hotspots({}, 1, request.app.state.settings.max_page_size)
    synthetic = any(
        any(bool(source.get("synthetic")) for source in repository.get_enrichment(item["geography_id"], item["category"]).get("sources", []))
        for item in hotspots
    )
    return {
        **repository.workflow_counts(), "provenance":"synthetic" if synthetic else "live",
        "updated_at":max((item["calculated_at"] for item in hotspots), default=None),
    }


@router.post("/internal/v1/hotspots/{hotspot_id}/recalculate", tags=["internal"])
def recalculate_hotspot(hotspot_id: str, body: RecalculateRequest, request: Request,
                        idempotency_key: str = Header(...,alias="Idempotency-Key",min_length=8,max_length=200)) -> dict:
    return request.app.state.pipeline.recalculate(hotspot_id,body.reason,body.requested_score_version,body.trace_id,idempotency_key)


@router.get("/health", tags=["operations"])
def health(request: Request) -> dict:
    def safe_ping(dependency) -> bool:
        try:
            return bool(dependency.ping())
        except Exception:
            return False

    repository = request.app.state.repository
    publisher = request.app.state.publisher
    storage_ok = safe_ping(repository)
    analytical_ok = safe_ping(request.app.state.analytical_repository)
    event_ok = safe_ping(publisher)
    counts = repository.dataset_counts()
    status = "ok" if storage_ok and analytical_ok and event_ok and counts["admin_units"] else "degraded"
    return {"status":status,"service":"data-intelligence","version":"1.0.0","storage_connectivity":storage_ok,
        "event_bus_connectivity":event_ok,"dataset_fixture_status":{"loaded":bool(counts["admin_units"]),"counts":counts},
        "analytical_data_connectivity":analytical_ok,
        "runtime_mode":request.app.state.settings.runtime_mode,
        "operational_repository":type(repository).__name__.replace("Repository", "").lower(),
        "analytical_repository":type(request.app.state.primary_analytical_repository).__name__,
        "geography_provider":type(request.app.state.primary_geography_provider).__name__,
        "similarity_provider":request.app.state.similarity_service.metadata.provider,
        "embedding_model":request.app.state.similarity_service.metadata.model,
        "embedding_dimension":request.app.state.similarity_service.metadata.dimension,
        "operational_persistence_warning":("Cloud Run SQLite state is ephemeral; configure PostgreSQL before production durability claims."
                                           if request.app.state.settings.storage_backend == "sqlite" and request.app.state.settings.environment == "production" else None),
        "local_fallback_enabled":request.app.state.settings.allow_local_fallback,
        "current_score_version":request.app.state.settings.score_version}
