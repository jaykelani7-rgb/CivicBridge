from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class ImpactMetricCreateRequest(BaseModel):
    metric_code: str = Field(..., description="Unique metric identifier, e.g. road_flooding_request_rate")
    baseline: float = Field(..., description="Baseline measurement value")
    target: float = Field(..., description="Target target value")
    current: float = Field(..., description="Current measured value")
    unit: str = Field(..., description="Measurement unit, e.g. requests_per_10000_people_per_month")
    source_id: str = Field(..., description="Data source reference, e.g. civicbridge_validated_requests")
    measured_at: Optional[str] = Field(None, description="ISO timestamp of measurement date")
    confidence: float = Field(0.85, ge=0.0, le=1.0, description="Measurement data confidence score")


class ImpactMetric(BaseModel):
    metric_id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    metric_code: str
    baseline: float
    target: float
    current: float
    unit: str
    source_id: str
    measured_at: str
    confidence: float = 0.85
    outcome_status: str = "improving"  # delivered, improving, unchanged, pending
    recorded_at: str
    schema_version: str = "impact-metric-1.0.0"
