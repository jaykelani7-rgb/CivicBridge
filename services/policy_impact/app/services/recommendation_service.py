from datetime import datetime, timezone
import logging
from typing import List, Optional
from uuid import uuid4

from packages.contracts import (
    EventEnvelope,
    Recommendation,
    RecommendationCreateRequest,
    RecommendationStatus,
)
from packages.event_bus import get_event_bus
from services.policy_impact.app.database import PolicyImpactRepository, get_repository
from services.policy_impact.app.services.evidence_validator import EvidenceValidator
from services.policy_impact.app.stubs.ai_normalization_stub import AINormalizationClient
from services.policy_impact.app.stubs.data_intelligence_stub import DataIntelligenceClient
from services.policy_impact.app.config import settings

logger = logging.getLogger("recommendation-service")


def _source_finding(source_id: str, bundle: dict) -> Optional[str]:
    findings = []
    for section, fields in (("demographic_features", ("population", "equity_vulnerability")), ("infrastructure_gap_records", ("infrastructure_gap", "existing_facility_coverage")), ("investment_plan_records", ("strategic_alignment", "delivery_readiness", "existing_coverage_penalty"))):
        for record in bundle.get(section, []):
            if record.get("source_id") == source_id:
                findings.extend(f"{name.replace('_', ' ')}: {record[name]}" for name in fields if record.get(name) is not None)
    return "; ".join(findings) if findings else None


class RecommendationService:
    def __init__(
        self,
        repository: Optional[PolicyImpactRepository] = None,
        data_client: Optional[DataIntelligenceClient] = None,
        ai_client: Optional[AINormalizationClient] = None,
    ):
        self.repo = repository or get_repository()
        self.data_client = data_client or DataIntelligenceClient(
            settings.JAY_DATA_INTELLIGENCE_URL,
            settings.ENABLE_MOCK_STUBS,
            settings.AUTHENTICATE_CLOUD_RUN,
        )
        self.ai_client = ai_client or AINormalizationClient(
            settings.SHREYANK_AI_SERVICE_URL,
            settings.ENABLE_MOCK_STUBS,
            settings.AUTHENTICATE_CLOUD_RUN,
        )
        self.event_bus = get_event_bus()

    def create_recommendation(self, req: RecommendationCreateRequest) -> Recommendation:
        now_str = datetime.now(timezone.utc).isoformat()

        # 1. Fetch bounded evidence bundle from Jay's Data Intelligence service
        evidence_bundle = self.data_client.get_evidence_bundle(req.hotspot_id, req.evidence_bundle_id)
        if not evidence_bundle:
            raise ValueError(f"Evidence bundle {req.evidence_bundle_id} for hotspot {req.hotspot_id} not found.")

        bundle_hotspot = evidence_bundle.get("hotspot_id") or (evidence_bundle.get("hotspot_snapshot") or {}).get("hotspot_id")
        if bundle_hotspot != req.hotspot_id or evidence_bundle.get("evidence_bundle_id") != req.evidence_bundle_id:
            raise ValueError("Evidence bundle identity does not match the requested hotspot and version.")

        valid_evidence_ids = evidence_bundle.get("valid_evidence_ids", [])

        # 2. Obtain draft (either from AI or manual fields)
        if req.override_draft and req.manual_fields:
            draft = req.manual_fields
            ai_draft = False
        else:
            draft = self.ai_client.generate_policy_brief_draft(req.hotspot_id, req.evidence_bundle_id, evidence_bundle)
            ai_draft = True

        title = req.title or draft.get("title", f"Infrastructure recommendation for hotspot {req.hotspot_id[:8]}")
        supporting_ids = draft.get("supporting_evidence_ids", valid_evidence_ids)

        # 3. Strictly validate claims against supplied evidence IDs
        val_result = EvidenceValidator.validate_citations(supporting_ids, valid_evidence_ids)
        if not val_result.is_valid:
            logger.error(f"[RecommendationService] Grounding validation failed: {val_result.message}")
            raise ValueError(f"Grounding validation error: {val_result.message}")
        claim_traces = EvidenceValidator.require_supported_numbers(draft, evidence_bundle)

        # 4. Construct Recommendation entity
        rec = Recommendation(
            recommendation_id=str(uuid4()),
            hotspot_id=req.hotspot_id,
            evidence_bundle_id=req.evidence_bundle_id,
            quantitative_claims=claim_traces,
            country_code=(evidence_bundle.get("hotspot_snapshot") or {}).get("country_code"),
            category=(evidence_bundle.get("hotspot_snapshot") or {}).get("category"),
            evidence_sources=[{
                "source_id": source.get("source_id", ""),
                "title": source.get("title") or source.get("dataset_name"),
                "publisher": source.get("publisher"),
                "url": source.get("url") or source.get("source_url"),
                "reference_period": source.get("reference_period") or source.get("time_coverage"),
                "retrieved_at": source.get("retrieved_at"),
                "finding": source.get("finding") or _source_finding(source.get("source_id", ""), evidence_bundle),
                "provenance": "synthetic_demo" if source.get("synthetic") else source.get("classification") or evidence_bundle.get("provenance"),
            } for source in evidence_bundle.get("data_sources", []) if source.get("source_id") in supporting_ids],
            title=title,
            problem=draft.get("problem", "Recurring infrastructure access issue."),
            proposed_intervention=draft.get("proposed_intervention", "Conduct feasibility study for capacity upgrade."),
            intended_beneficiaries=draft.get("intended_beneficiaries"),
            supporting_evidence_ids=supporting_ids,
            risks=draft.get("risks", []),
            missing_information=draft.get("missing_information", []),
            confidence=draft.get("confidence"),
            status=RecommendationStatus.UNDER_REVIEW,
            ai_draft=ai_draft,
            processing_mode="manual" if not ai_draft else draft.get("processing_mode", "unknown"),
            draft_provider=None if not ai_draft else draft.get("provider"),
            draft_model=None if not ai_draft else draft.get("model"),
            human_approved=False,
            created_at=now_str,
            updated_at=now_str,
        )

        # 5. Persist to DB
        self.repo.save_recommendation(rec)

        # 6. Publish recommendation.created.v1 event
        event = EventEnvelope(
            event_type="recommendation.created.v1",
            producer="policy-impact",
            data=rec.model_dump(),
        )
        self.event_bus.publish(event)

        logger.info(f"[RecommendationService] Created recommendation {rec.recommendation_id}")
        return rec

    def get_recommendation(self, recommendation_id: str) -> Optional[Recommendation]:
        return self.repo.get_recommendation(recommendation_id)

    def list_recommendations(self, hotspot_id: Optional[str] = None, status: Optional[str] = None) -> List[Recommendation]:
        return self.repo.list_recommendations(hotspot_id, status)
