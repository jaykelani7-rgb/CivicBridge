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

        # 4. Construct Recommendation entity
        rec = Recommendation(
            recommendation_id=str(uuid4()),
            hotspot_id=req.hotspot_id,
            evidence_bundle_id=req.evidence_bundle_id,
            title=title,
            problem=draft.get("problem", "Recurring infrastructure access issue."),
            proposed_intervention=draft.get("proposed_intervention", "Conduct feasibility study for capacity upgrade."),
            intended_beneficiaries=draft.get("intended_beneficiaries", 10000),
            supporting_evidence_ids=supporting_ids,
            risks=draft.get("risks", []),
            missing_information=draft.get("missing_information", []),
            confidence=draft.get("confidence", 0.85),
            status=RecommendationStatus.UNDER_REVIEW,
            ai_draft=ai_draft,
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
