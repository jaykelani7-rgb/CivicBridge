from pydantic import BaseModel, Field
from typing import List, Optional

class IntendedBeneficiaries(BaseModel):
    value: int = Field(
        ..., 
        description="Estimated number of beneficiaries affected by the project"
    )
    basis_source_ids: List[str] = Field(
        default_factory=list, 
        description="Source request IDs or demographic indicators justifying this number"
    )

class PriorityRationaleClaim(BaseModel):
    claim: str = Field(
        ..., 
        description="A specific data-backed claim justifying the priority"
    )
    source_ids: List[str] = Field(
        default_factory=list, 
        description="Source request or indicator IDs supporting this claim"
    )

class InvestmentAlignmentItem(BaseModel):
    plan_project_id: str = Field(
        ..., 
        description="ID of a planned or active public investment project"
    )
    relationship: str = Field(
        ..., 
        description="Relationship type: supports, overlaps, conflicts, none"
    )

class SuccessMetricItem(BaseModel):
    metric: str = Field(
        ..., 
        description="Description of the indicator metric (e.g. travel time, water access)"
    )
    baseline_source_id: str = Field(
        ..., 
        description="ID of the source document or data record for the baseline value"
    )
    target: str = Field(
        ..., 
        description="Target outcome value or goal statement"
    )

class ProjectRecommendationAIResponse(BaseModel):
    project_title: str = Field(
        ..., 
        description="Short, action-oriented project title"
    )
    problem: str = Field(
        ..., 
        description="Source-grounded problem statement linking back to raw evidence"
    )
    proposed_intervention: str = Field(
        ..., 
        description="Specific, pre-feasibility intervention description"
    )
    intended_beneficiaries: IntendedBeneficiaries = Field(
        ..., 
        description="Object specifying estimated beneficiaries and references"
    )
    priority_rationale: List[PriorityRationaleClaim] = Field(
        default_factory=list, 
        description="Array of claims justifying why this project is prioritized, with sources"
    )
    investment_alignment: List[InvestmentAlignmentItem] = Field(
        default_factory=list, 
        description="Analysis of alignment with existing official infrastructure plans"
    )
    delivery_dependencies: List[str] = Field(
        default_factory=list, 
        description="Key dependency items required for delivery (e.g., land access, permits)"
    )
    risks: List[str] = Field(
        default_factory=list, 
        description="Identified risks for execution or operational phases"
    )
    budget_band: str = Field(
        ..., 
        description="Must be: requires_local_estimation, low, medium, high"
    )
    success_metrics: List[SuccessMetricItem] = Field(
        default_factory=list, 
        description="List of KPIs, including their baseline reference ID and targets"
    )
    confidence: float = Field(
        ..., 
        description="Overall confidence in recommendation relevance (0.0 to 1.0)"
    )
    human_review_required: bool = Field(
        ..., 
        description="Flag to mark whether this recommendation must go to review queue"
    )
