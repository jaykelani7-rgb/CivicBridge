"""
CivicBridge AI - Shared Contracts Package
Contains standard Pydantic models for shared event envelopes, standard errors,
recommendations, policy decisions, projects, milestones, and impact metrics.
"""

from .errors import StandardErrorBody, StandardErrorResponse
from .events import EventEnvelope
from .recommendation import (
    Recommendation,
    RecommendationCreateRequest,
    RecommendationStatus,
)
from .decision import PolicyAction, PolicyDecision, PolicyDecisionCreateRequest
from .project import (
    Project,
    ProjectCreateRequest,
    ProjectStatus,
    Milestone,
    MilestoneCreateRequest,
)
from .impact import ImpactMetric, ImpactMetricCreateRequest

__all__ = [
    "StandardErrorBody",
    "StandardErrorResponse",
    "EventEnvelope",
    "Recommendation",
    "RecommendationCreateRequest",
    "RecommendationStatus",
    "PolicyAction",
    "PolicyDecision",
    "PolicyDecisionCreateRequest",
    "Project",
    "ProjectCreateRequest",
    "ProjectStatus",
    "Milestone",
    "MilestoneCreateRequest",
    "ImpactMetric",
    "ImpactMetricCreateRequest",
]
