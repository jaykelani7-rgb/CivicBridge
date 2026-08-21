from __future__ import annotations

import math
from datetime import date
from typing import Optional

from fastapi import APIRouter, Header, Query, Request

from app.domain.errors import DomainError, NotFoundError
from app.schemas.api import RecalculateRequest
from app.schemas.events import EventEnvelope, NormalizedRequest


router = APIRouter()


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
    return {"items":items,"pagination":{"page":page,"page_size":size,"total":total,"pages":math.ceil(total/size) if total else 0}}


@router.get("/v1/hotspots/{hotspot_id}", tags=["hotspots"])
def hotspot_detail(hotspot_id: str, request: Request) -> dict:
    hotspot = request.app.state.repository.get_hotspot(hotspot_id)
    if not hotspot:
        raise NotFoundError("HOTSPOT_NOT_FOUND","The requested hotspot does not exist.")
    admin = request.app.state.repository.get_admin_unit(hotspot["geography_id"])
    return {"hotspot":hotspot,"geography":{k:admin[k] for k in ["geography_id","country_code","admin1","admin2","locality","boundary_source","boundary_version"]}}


@router.get("/v1/hotspots/{hotspot_id}/evidence", tags=["hotspots"])
def hotspot_evidence(hotspot_id: str, request: Request) -> dict:
    bundle = request.app.state.repository.get_evidence(hotspot_id)
    if not bundle:
        raise NotFoundError("HOTSPOT_NOT_FOUND","No evidence bundle exists for the requested hotspot.")
    return bundle


@router.get("/v1/hotspots/{hotspot_id}/score", tags=["hotspots"])
def hotspot_score(hotspot_id: str, request: Request) -> dict:
    hotspot,components = request.app.state.repository.get_latest_score(hotspot_id)
    if not hotspot:
        raise NotFoundError("HOTSPOT_NOT_FOUND","The requested hotspot does not exist.")
    return {"hotspot_id":hotspot_id,"need_score":hotspot["need_score"],"action_score":hotspot["action_score"],
        "evidence_confidence":hotspot["evidence_confidence"],"components":components,"warnings":hotspot["warnings"],
        "score_version":hotspot["score_version"],"calculation_timestamp":hotspot["calculated_at"]}


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
        "operational_repository":"sqlite",
        "analytical_repository":type(request.app.state.primary_analytical_repository).__name__,
        "geography_provider":type(request.app.state.primary_geography_provider).__name__,
        "local_fallback_enabled":request.app.state.settings.allow_local_fallback,
        "current_score_version":request.app.state.settings.score_version}
