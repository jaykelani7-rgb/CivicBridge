from typing import List, Optional
from pydantic import BaseModel, Field

class RecommendationData(BaseModel):
    recommendation_id: str
    hotspot_id: str
    evidence_bundle_id: str
    title: str
    problem: str
    proposed_intervention: str
    intended_beneficiaries: int
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    confidence: float
    status: str = "under_review"
    ai_draft: bool = True
    human_approved: bool = False
    schema_version: str = "recommendation-1.0.0"

class PolicyDecisionData(BaseModel):
    decision_id: str
    recommendation_id: str
    action: str = Field(..., description="approve_for_assessment, request_evidence, edit, assign, defer, reject")
    reason: str
    actor_id: str
    actor_role: str = "decision_maker"
    decided_at: str

class ImpactMetricData(BaseModel):
    project_id: str
    metric_code: str
    baseline: float
    target: float
    current: float
    unit: str
    source_id: str
    measured_at: str
    confidence: float
