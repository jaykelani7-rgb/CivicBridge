from datetime import datetime, timezone
import logging
from typing import Optional, Tuple
from uuid import uuid4

from packages.contracts import (
    EventEnvelope,
    PolicyAction,
    PolicyDecision,
    PolicyDecisionCreateRequest,
    Recommendation,
    RecommendationStatus,
)
from packages.event_bus import get_event_bus
from services.policy_impact.app.database import PolicyImpactRepository, get_repository

logger = logging.getLogger("policy-service")


class PolicyService:
    def __init__(self, repository: Optional[PolicyImpactRepository] = None):
        self.repo = repository or get_repository()
        self.event_bus = get_event_bus()

    def record_decision(
        self, recommendation_id: str, req: PolicyDecisionCreateRequest
    ) -> Tuple[PolicyDecision, Recommendation]:
        now_str = datetime.now(timezone.utc).isoformat()

        rec = self.repo.get_recommendation(recommendation_id)
        if not rec:
            raise ValueError(f"Recommendation {recommendation_id} not found.")

        # 1. Map PolicyAction to RecommendationStatus
        new_status = rec.status
        if req.action == PolicyAction.APPROVE_FOR_ASSESSMENT:
            new_status = RecommendationStatus.APPROVED_FOR_ASSESSMENT
            rec.human_approved = True
        elif req.action == PolicyAction.REQUEST_EVIDENCE:
            new_status = RecommendationStatus.EVIDENCE_REQUESTED
        elif req.action == PolicyAction.DEFER:
            new_status = RecommendationStatus.DEFERRED
        elif req.action == PolicyAction.REJECT:
            new_status = RecommendationStatus.REJECTED
        elif req.action == PolicyAction.ASSIGN:
            new_status = RecommendationStatus.ASSIGNED
            if req.assigned_to:
                rec.assigned_department = req.assigned_to
        elif req.action == PolicyAction.EDIT:
            if req.edited_fields:
                for key, val in req.edited_fields.items():
                    if hasattr(rec, key):
                        setattr(rec, key, val)

        rec.status = new_status
        rec.updated_at = now_str
        self.repo.save_recommendation(rec)

        # 2. Record policy decision audit
        decision = PolicyDecision(
            decision_id=str(uuid4()),
            recommendation_id=recommendation_id,
            action=req.action,
            reason=req.reason,
            actor_id=req.actor_id,
            actor_role=req.actor_role,
            decided_at=now_str,
        )
        self.repo.save_decision(decision)

        # 3. Publish policy.decision.recorded.v1 event
        event = EventEnvelope(
            event_type="policy.decision.recorded.v1",
            producer="policy-impact",
            data={
                "decision": decision.model_dump(),
                "recommendation_status": rec.status.value,
                "human_approved": rec.human_approved,
            },
        )
        self.event_bus.publish(event)

        logger.info(
            f"[PolicyService] Recorded decision {decision.decision_id} ({req.action.value}) for recommendation {recommendation_id}"
        )
        return decision, rec

    def assign_recommendation(
        self, recommendation_id: str, department: str, reviewer: Optional[str] = None
    ) -> Recommendation:
        rec = self.repo.get_recommendation(recommendation_id)
        if not rec:
            raise ValueError(f"Recommendation {recommendation_id} not found.")

        rec.assigned_department = department
        if reviewer:
            rec.assigned_reviewer = reviewer
        rec.status = RecommendationStatus.ASSIGNED
        rec.updated_at = datetime.now(timezone.utc).isoformat()
        self.repo.save_recommendation(rec)

        logger.info(f"[PolicyService] Assigned recommendation {recommendation_id} to department {department}")
        return rec
