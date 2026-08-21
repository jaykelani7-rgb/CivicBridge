"""
CivicBridge AI - Shared Contracts Package
Contains standard Pydantic models for shared event envelopes, standard errors,
recommendations, policy decisions, projects, milestones, and impact metrics.
"""

from .envelope import EventEnvelope, StandardErrorResponse, ErrorDetail
from .citizen import (
    LocationApproximate,
    ConsentPayload,
    CreateRequestPayload,
    RequestCreatedData,
    RequestConfirmedData,
    CitizenCorrectionPayload,
    CitizenStatusResponse,
    ContentRetrievalResponse
)
from .normalization import NormalizedRequestData
from .intelligence import HotspotSnapshotData
from .policy import RecommendationData, PolicyDecisionData, ImpactMetricData

# Policy + Impact specific contracts from Sharmad's branch
from .errors import StandardErrorBody
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
    "EventEnvelope",
    "StandardErrorResponse",
    "ErrorDetail",
    "LocationApproximate",
    "ConsentPayload",
    "CreateRequestPayload",
    "RequestCreatedData",
    "RequestConfirmedData",
    "CitizenCorrectionPayload",
    "CitizenStatusResponse",
    "ContentRetrievalResponse",
    "NormalizedRequestData",
    "HotspotSnapshotData",
    "RecommendationData",
    "PolicyDecisionData",
    "ImpactMetricData",
    # Sharmad's additions
    "StandardErrorBody",
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
