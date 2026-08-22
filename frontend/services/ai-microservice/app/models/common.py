from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class ExplainabilityEvidence(BaseModel):
    summary: str
    data_points: list[str] = Field(default_factory=list)


class JobEnvelope(BaseModel):
    job_id: str = Field(default_factory=lambda: str(uuid4()))
    status: Literal["queued", "processing", "completed", "failed"] = "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
