from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from packages.contracts import (
    PolicyDecision,
    PolicyDecisionCreateRequest,
    Recommendation,
)
from services.policy_impact.app.services.policy_service import PolicyService

router = APIRouter(prefix="/v1/recommendations", tags=["Policy Decisions"])
service = PolicyService()


class AssignmentRequest(BaseModel):
    department: str
    reviewer: Optional[str] = None


@router.post("/{recommendation_id}/decisions", response_model=PolicyDecision, status_code=status.HTTP_200_OK)
def record_decision(recommendation_id: str, req: PolicyDecisionCreateRequest):
    try:
        decision, rec = service.record_decision(recommendation_id, req)
        return decision
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "POLICY_DECISION_INVALID", "message": str(e)}},
        )


@router.post("/{recommendation_id}/assignments", response_model=Recommendation, status_code=status.HTTP_200_OK)
def assign_recommendation(recommendation_id: str, req: AssignmentRequest):
    try:
        return service.assign_recommendation(recommendation_id, req.department, req.reviewer)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECOMMENDATION_NOT_FOUND", "message": str(e)}},
        )
