from typing import Literal, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class ImpactMetricCreateRequest(BaseModel):
    metric_code: str = Field(..., description="Unique metric identifier, e.g. road_flooding_request_rate")
    baseline: Optional[float] = Field(None, description="Baseline measurement value")
    target: Optional[float] = Field(None, description="Target value")
    current: Optional[float] = Field(None, description="Current measured value")
    direction: Literal["higher_is_better", "lower_is_better"] = "lower_is_better"
    unit: str = Field(..., description="Measurement unit, e.g. requests_per_10000_people_per_month")
    source_id: str = Field(..., description="Data source reference, e.g. civicbridge_validated_requests")
    measured_at: Optional[str] = Field(None, description="ISO timestamp of measurement date")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Measurement data confidence score")
    # This intake endpoint records staff measurements. Independent verification
    # needs a separate reviewed workflow, not a caller-selected label.
    source_type: Literal["manual"] = "manual"
    methodology: Optional[str] = None


class ImpactMetric(BaseModel):
    metric_id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    metric_code: str
    baseline: Optional[float] = None
    target: Optional[float] = None
    current: Optional[float] = None
    direction: Literal["higher_is_better", "lower_is_better"] = "lower_is_better"
    unit: str
    source_id: str
    measured_at: str
    confidence: Optional[float] = None
    source_type: Literal["manual", "independently_verified"] = "manual"
    methodology: Optional[str] = None
    outcome_status: str = "pending"  # target_achieved, improving, deteriorating, unchanged, pending
    recorded_at: str
    schema_version: str = "impact-metric-1.0.0"
