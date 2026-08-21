from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator, Optional
from uuid import NAMESPACE_URL, uuid4, uuid5

from app.domain.errors import DomainError, NotFoundError
from app.domain.models import Geography, Metrics
from app.schemas.events import EventEnvelope, HotspotUpdatedData, HotspotUpdatedEvent, NormalizedRequest
from app.services.duplicates import DuplicateDetector
from app.services.evidence import build_evidence_bundle
from app.services.outbox import OutboxDispatcher
from app.services.scoring import ScoringEngine


logger = logging.getLogger("civicbridge.data_intelligence")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class IntelligencePipeline:
    def __init__(self, repository: Any, geography_provider: Any, duplicate_detector: DuplicateDetector,
                 scoring: ScoringEngine, outbox: OutboxDispatcher, metrics: Metrics,
                 public_data_repository: Optional[Any] = None) -> None:
        self.repository = repository
        self.geography_provider = geography_provider
        self.duplicate_detector = duplicate_detector
        self.scoring = scoring
        self.outbox = outbox
        self.metrics = metrics
        self.public_data_repository = public_data_repository or repository

    @contextmanager
    def stage(self, name: str, context: dict[str, Any]) -> Iterator[None]:
        started = time.perf_counter()
        try:
            yield
            result, error_code = "success", None
        except Exception as exc:
            result, error_code = "failure", getattr(exc, "code", "UNEXPECTED_ERROR")
            raise
        finally:
            duration = (time.perf_counter() - started) * 1000
            self.metrics.observe(name, duration)
            logger.info("pipeline_stage", extra={**context,"processing_stage":name,"duration_ms":round(duration,3),"result":result,"error_code":error_code})

    def process(self, envelope: EventEnvelope[NormalizedRequest]) -> dict[str, Any]:
        event_id, trace_id = str(envelope.event_id), str(envelope.trace_id)
        request = envelope.data
        context = {"trace_id":trace_id,"event_id":event_id,"request_id":str(request.request_id)}
        self.metrics.increment("events_received")
        if envelope.event_type != "request.normalized.v1":
            raise DomainError("NORMALIZED_REQUEST_INVALID", "Expected request.normalized.v1 event.", details=[{"field":"event_type","reason":"unsupported event"}])

        try:
            with self.repository.transaction():
                existing = self.repository.get_processed_event(event_id)
                if existing:
                    if existing["status"] == "completed":
                        self.metrics.increment("duplicate_deliveries_ignored")
                        return self._stored_result(existing, trace_id)
                    if existing["status"] == "processing":
                        raise DomainError("EVENT_ALREADY_PROCESSING", "This event is already being processed.", retryable=True, http_status=409)
                    if existing["status"] == "failed" and existing["error_code"] not in {"DEPENDENCY_UNAVAILABLE", "DUPLICATE_CHECK_FAILED"}:
                        raise DomainError(existing["error_code"], "The prior non-retryable event failure is preserved.", http_status=409)
                self.repository.start_event(event_id,envelope.event_type,trace_id,utc_now())

                with self.stage("validate",context):
                    review_reason = self._review_reason(request)
                    if review_reason:
                        self.repository.save_review(str(request.request_id),event_id,request.country_code,review_reason,trace_id,utc_now())
                        self.repository.complete_event(event_id,str(request.request_id),utc_now())
                        self.metrics.increment("requests_requiring_geography_review")
                        return {"processing_status":"pending_review","request_id":str(request.request_id),"review_reason":review_reason,
                                "cluster_assignment":None,"duplicate_candidates":[],"hotspot_id":None,"score_version":self.scoring.config["version"],
                                "evidence_bundle_id":None,"trace_id":trace_id,"warnings":[review_reason]}

                try:
                    with self.stage("resolve_geography",context):
                        location = request.location
                        geography = self.geography_provider.resolve(request.country_code,
                            latitude=location.latitude if location else None, longitude=location.longitude if location else None,
                            administrative_id=request.administrative_id, location_mentions=request.location_mentions)
                except DomainError as exc:
                    if exc.code not in {"LOCATION_AMBIGUOUS","GEOGRAPHY_NOT_FOUND"}:
                        raise
                    self.repository.save_review(str(request.request_id),event_id,request.country_code,exc.message,trace_id,utc_now())
                    self.repository.complete_event(event_id,str(request.request_id),utc_now())
                    self.metrics.increment("requests_requiring_geography_review")
                    return {"processing_status":"pending_review","request_id":str(request.request_id),"review_reason":exc.message,
                            "cluster_assignment":None,"duplicate_candidates":[],"hotspot_id":None,"score_version":self.scoring.config["version"],
                            "evidence_bundle_id":None,"trace_id":trace_id,"warnings":[exc.message]}

                with self.stage("find_duplicates",context):
                    candidates, similarity = self.duplicate_detector.find_with_metadata(request,geography,envelope.occurred_at)
                    stored_candidates = [self.duplicate_detector.stored(x,str(request.request_id)) for x in candidates]
                    self.repository.save_duplicate_candidates(str(request.request_id),stored_candidates,utc_now())
                    if any(x.suggested_action == "manual_review" for x in candidates):
                        self.metrics.increment("manual_review_candidates")

                with self.stage("assign_cluster",context):
                    high = next((x for x in candidates if x.suggested_action == "auto_attach"),None)
                    if high and geography.confidence >= 0.75:
                        cluster_id, assignment = high.candidate_cluster_id, "existing_cluster"
                        self.metrics.increment("high_confidence_cluster_assignments")
                    else:
                        cluster_id, assignment = str(uuid4()), "new_cluster"
                        self.repository.create_cluster({"cluster_id":cluster_id,"country_code":request.country_code,
                            "geography_id":geography.geography_id,"spatial_cell":geography.spatial_cell,"category":request.category,
                            "subcategory":request.subcategory,"canonical_summary":request.summary,"first_seen":self._iso(envelope.occurred_at),
                            "last_seen":self._iso(envelope.occurred_at),
                            "duplicate_method":f"explainable-{similarity.provider}-v1",
                            "centroid_lat":geography.latitude,"centroid_lon":geography.longitude})
                    self.repository.add_cluster_member({"request_id":str(request.request_id),"cluster_id":cluster_id,"event_id":event_id,
                        "summary":request.summary,"requested_outcome":request.requested_outcome,"urgency":request.urgency,
                        "request_confidence":request.confidence,"location_confidence":geography.confidence,
                        "occurred_at":self._iso(envelope.occurred_at),"evidence_refs":[event_id]})
                    context["cluster_id"] = cluster_id

                result = self._calculate_and_store(cluster_id,geography,trace_id,reason="normalized_request_processed",idempotency_key=None)
                context["hotspot_id"] = result["hotspot_id"]
                self.repository.complete_event(event_id,result["hotspot_id"],utc_now())
                self.metrics.increment("events_processed")
                response = {"processing_status":"completed","request_id":str(request.request_id),
                    "cluster_assignment":{"cluster_id":cluster_id,"action":assignment},
                    "duplicate_candidates":[x.__dict__ for x in candidates],"trace_id":trace_id,
                    "similarity_processing":{"provider":similarity.provider,"model":similarity.model,
                        "dimension":similarity.dimension,"canonical_text_version":similarity.canonical_text_version,
                        "degraded":similarity.degraded},**result}
                if similarity.degraded:
                    response["warnings"] = [*response["warnings"],
                        "Vertex semantic similarity was unavailable; explainable lexical fallback was used."]
            self.outbox.dispatch()
            return response
        except DomainError as exc:
            if exc.code != "EVENT_ALREADY_PROCESSING":
                try:
                    with self.repository.transaction():
                        current = self.repository.get_processed_event(event_id)
                        if not current or current["status"] != "completed":
                            self.repository.fail_event(event_id,envelope.event_type,trace_id,exc.code,utc_now())
                except Exception:
                    pass
            raise
        except Exception as exc:
            now = utc_now()
            try:
                with self.repository.transaction():
                    self.repository.fail_event(event_id,envelope.event_type,trace_id,"DEPENDENCY_UNAVAILABLE",now)
            except Exception:
                pass
            raise

    def recalculate(self, hotspot_id: str, reason: str, score_version: str, trace_id: str, idempotency_key: str) -> dict[str, Any]:
        if score_version != self.scoring.config["version"]:
            raise DomainError("SCORE_CONFIGURATION_INVALID", "The requested score version is not installed.")
        with self.repository.transaction():
            existing = self.repository.get_recalculation_by_key(hotspot_id,idempotency_key)
            if existing:
                return {**existing,"idempotent_replay":True}
            hotspot = self.repository.get_hotspot(hotspot_id)
            if not hotspot:
                raise NotFoundError("HOTSPOT_NOT_FOUND","The requested hotspot does not exist.")
            cluster = self.repository.get_cluster(hotspot["cluster_id"])
            admin = self.repository.get_admin_unit(hotspot["geography_id"])
            geography = Geography(geography_id=admin["geography_id"],country_code=admin["country_code"],admin1=admin["admin1"],
                admin2=admin["admin2"],locality=admin["locality"],spatial_cell=hotspot["spatial_cell"],latitude=admin["centroid_lat"],
                longitude=admin["centroid_lon"],confidence=0.90,boundary_source=admin["boundary_source"],boundary_version=admin["boundary_version"])
            result = self._calculate_and_store(cluster["cluster_id"],geography,trace_id,reason=reason,idempotency_key=idempotency_key)
        self.outbox.dispatch()
        return {**result,"idempotent_replay":False}

    def _calculate_and_store(self, cluster_id: str, geography: Geography, trace_id: str, *, reason: str, idempotency_key: Optional[str]) -> dict[str, Any]:
        cluster = self.repository.get_cluster(cluster_id)
        context = {"trace_id":trace_id,"cluster_id":cluster_id}
        with self.stage("join_public_evidence",context):
            enrichment = self.public_data_repository.get_enrichment(cluster["geography_id"],cluster["category"])
            if not enrichment["sources"]:
                raise DomainError("PUBLIC_DATA_NOT_AVAILABLE","No public-data fixture is available for this geography and category.")
        members = self.repository.get_cluster_members(cluster_id)
        with self.stage("calculate_scores",context):
            score = self.scoring.calculate(members,enrichment,geography.confidence)
        population = int((enrichment.get("demographic") or {}).get("population") or 0)
        request_rate = len(members)/population*10000 if population else 0.0
        trend_component = next(x for x in score.components if x.name == "recent_trend")
        trend_30d = float(trend_component.raw_value or 0.0)
        hotspot_id = self.repository.get_or_create_hotspot_id(cluster_id,str(uuid4()))
        version = self.repository.next_hotspot_version(hotspot_id)
        now = score.calculated_at
        hotspot = {"hotspot_id":hotspot_id,"cluster_id":cluster_id,"country_code":cluster["country_code"],
            "geography_id":cluster["geography_id"],"spatial_cell":cluster["spatial_cell"],"category":cluster["category"],
            "calculation_date":now[:10],"request_count":len(members),"unique_request_count":len(members),
            "corroboration_count":max(0,len(members)-1),"suspected_duplicates":0,"pending_review_count":0,"excluded_count":0,
            "request_rate":round(request_rate,4),"affected_population":population,"trend_30d":round(trend_30d,4),
            "infrastructure_gap":(enrichment.get("infrastructure") or {}).get("infrastructure_gap"),
            "equity_vulnerability":(enrichment.get("demographic") or {}).get("equity_vulnerability"),
            "evidence_confidence":score.evidence_confidence,"need_score":score.need_score,"action_score":score.action_score,
            "score_version":score.version,"evidence_bundle_id":None,"calculated_at":now,"status":"active","warnings":score.warnings}
        with self.stage("update_hotspot",context):
            self.repository.upsert_hotspot(hotspot)
            component_rows=[]
            for component in score.components:
                row=component.__dict__.copy()
                row["id"] = str(uuid5(NAMESPACE_URL,f"component:{hotspot_id}:{version}:{component.name}"))
                component_rows.append(row)
            self.repository.save_score_components(hotspot_id,version,component_rows)
        with self.stage("build_evidence_bundle",context):
            geo_public = {**geography.__dict__}
            bundle_id,digest,bundle = build_evidence_bundle(hotspot=hotspot,geography=geo_public,members=members,
                components=component_rows,enrichment=enrichment,bundle_version=version,created_at=now,warnings=score.warnings)
            self.repository.save_evidence_bundle(bundle_id,hotspot_id,version,bundle,digest,now)
            hotspot["evidence_bundle_id"] = bundle_id
            self.repository.set_hotspot_bundle(hotspot_id,bundle_id)
            snapshot = {**hotspot,"hotspot_version":version,"warnings":score.warnings}
            self.repository.save_hotspot_version(hotspot_id,version,snapshot,reason,idempotency_key,trace_id,now)
        with self.stage("publish_hotspot_event",context):
            event_id = str(uuid5(NAMESPACE_URL,f"hotspot.updated.v1:{hotspot_id}:{version}"))
            data = HotspotUpdatedData(hotspot_id=hotspot_id,country_code=cluster["country_code"],geography_id=cluster["geography_id"],
                category=cluster["category"],request_count=len(members),unique_request_count=len(members),affected_population=population,
                trend_30d=trend_30d,need_score=score.need_score,action_score=score.action_score,evidence_confidence=score.evidence_confidence,
                score_version=score.version,evidence_bundle_id=bundle_id,calculated_at=datetime.fromisoformat(now.replace("Z","+00:00")))
            event = HotspotUpdatedEvent(event_id=event_id,event_type="hotspot.updated.v1",schema_version="1.0.0",
                occurred_at=datetime.fromisoformat(now.replace("Z","+00:00")),producer="data-intelligence",trace_id=trace_id,data=data)
            self.repository.enqueue_outbox(event_id,"hotspot.updated.v1",event.model_dump(mode="json"),trace_id,now)
        self.metrics.increment("hotspots_updated")
        return {"hotspot_id":hotspot_id,"score_version":score.version,"evidence_bundle_id":bundle_id,
                "need_score":score.need_score,"action_score":score.action_score,"warnings":score.warnings,"hotspot_version":version}

    def _stored_result(self, existing: dict[str, Any], trace_id: str) -> dict[str, Any]:
        hotspot = self.repository.get_hotspot(existing["result_entity_id"])
        if hotspot:
            return {"processing_status":"completed","idempotent_replay":True,"cluster_assignment":{"cluster_id":hotspot["cluster_id"],"action":"unchanged"},
                "duplicate_candidates":[],"hotspot_id":hotspot["hotspot_id"],"score_version":hotspot["score_version"],
                "evidence_bundle_id":hotspot["evidence_bundle_id"],"trace_id":trace_id,"warnings":hotspot["warnings"]}
        return {"processing_status":"pending_review","idempotent_replay":True,"hotspot_id":None,"score_version":self.scoring.config["version"],
                "evidence_bundle_id":None,"trace_id":trace_id,"warnings":["The request remains pending review."]}

    @staticmethod
    def _review_reason(request: NormalizedRequest) -> Optional[str]:
        if request.needs_human_review:
            return request.review_reason or "The normalization service requested human review."
        if request.confidence < 0.55:
            return "Normalization confidence is below the automatic-processing threshold."
        if not (request.location or request.administrative_id or request.location_mentions):
            return "At least one usable approximate location input is required."
        return None

    @staticmethod
    def _iso(value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat().replace("+00:00","Z")
