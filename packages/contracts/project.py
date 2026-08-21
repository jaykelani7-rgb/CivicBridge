from enum import Enum
from typing import List, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class ProjectStatus(str, Enum):
    CANDIDATE = "candidate"
    IN_FEASIBILITY = "in_feasibility"
    APPROVED_FOR_CONSTRUCTION = "approved_for_construction"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class MilestoneCreateRequest(BaseModel):
    title: str = Field(..., min_length=2)
    target_date: Optional[str] = None
    notes: Optional[str] = None


class Milestone(BaseModel):
    milestone_id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    title: str
    status: str = "pending"  # pending, in_progress, completed
    target_date: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    recommendation_id: str = Field(..., description="Must reference an approved recommendation")
    title: Optional[str] = Field(None, description="Optional custom title")
    assigned_department: Optional[str] = Field(None, description="Department responsible for execution")


class Project(BaseModel):
    project_id: str = Field(default_factory=lambda: str(uuid4()))
    recommendation_id: str
    hotspot_id: str
    country_code: str = "IN"
    title: str
    sector: str = "drainage"
    status: ProjectStatus = ProjectStatus.CANDIDATE
    assigned_department: Optional[str] = None
    milestones: List[Milestone] = Field(default_factory=list)
    created_at: str
    updated_at: str
    schema_version: str = "project-1.0.0"
