from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.common import JobEnvelope


class DecayRecalculationRequest(BaseModel):
    run_reason: Literal["scheduler", "manual", "backfill"] = "scheduler"
    triggered_by: str | None = None
    open_need_ids: list[str] = Field(default_factory=list)
    as_of: datetime | None = None


class DecayNeedUpdate(BaseModel):
    need_id: str
    previous_heat_score: float = Field(..., ge=0, le=100)
    recalculated_heat_score: float = Field(..., ge=0, le=100)
    decay_state: Literal["fresh", "warming", "cooling"]
    severity_weight: float = Field(..., ge=0)
    elapsed_minutes: int = Field(..., ge=0)


class DecayRecalculationResponse(JobEnvelope):
    processed_count: int = Field(..., ge=0)
    interval_minutes: int = Field(..., ge=1)
    updates: list[DecayNeedUpdate] = Field(default_factory=list)
