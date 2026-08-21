from enum import Enum
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class PolicyAction(str, Enum):
    APPROVE_FOR_ASSESSMENT = "approve_for_assessment"
    REQUEST_EVIDENCE = "request_evidence"
    EDIT = "edit"
    ASSIGN = "assign"
    DEFER = "defer"
    REJECT = "reject"


class PolicyDecisionCreateRequest(BaseModel):
    action: PolicyAction
    reason: str = Field(..., min_length=3, description="Justification for the human decision")
    actor_id: str = Field(..., description="ID of the human decision maker")
    actor_role: str = Field("decision_maker", description="Role of the actor, e.g. decision_maker, analyst")
    assigned_to: Optional[str] = Field(None, description="Department or reviewer if action is assign")
    edited_fields: Optional[dict] = Field(None, description="Updated recommendation fields if action is edit")


class PolicyDecision(BaseModel):
    decision_id: str = Field(default_factory=lambda: str(uuid4()))
    recommendation_id: str
    action: PolicyAction
    reason: str
    actor_id: str
    actor_role: str
    decided_at: str
    schema_version: str = "policy-decision-1.0.0"
