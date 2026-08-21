from enum import Enum
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class RecommendationStatus(str, Enum):
    UNDER_REVIEW = "under_review"
    APPROVED_FOR_ASSESSMENT = "approved_for_assessment"
    EVIDENCE_REQUESTED = "evidence_requested"
    DEFERRED = "deferred"
    REJECTED = "rejected"
    ASSIGNED = "assigned"


class RecommendationCreateRequest(BaseModel):
    hotspot_id: str = Field(..., description="Target hotspot UUID")
    evidence_bundle_id: str = Field(..., description="Associated evidence bundle ID from Data Intelligence")
    title: Optional[str] = Field(None, description="Optional custom title or AI generated")
    override_draft: Optional[bool] = Field(False, description="Manual recommendation submission without AI draft call")
    manual_fields: Optional[dict] = Field(None, description="Optional fields if override_draft is True")


class Recommendation(BaseModel):
    recommendation_id: str = Field(default_factory=lambda: str(uuid4()))
    hotspot_id: str
    evidence_bundle_id: str
    title: str
    problem: str
    proposed_intervention: str
    intended_beneficiaries: int
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    status: RecommendationStatus = RecommendationStatus.UNDER_REVIEW
    ai_draft: bool = True
    human_approved: bool = False
    assigned_department: Optional[str] = None
    assigned_reviewer: Optional[str] = None
    created_at: str
    updated_at: str
    schema_version: str = "recommendation-1.0.0"
