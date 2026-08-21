from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4
from pydantic import BaseModel, Field


class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique event identifier for idempotency")
    event_type: str = Field(..., description="Canonical event name, e.g. recommendation.created.v1")
    schema_version: str = Field("1.0.0", description="Event schema version")
    occurred_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC timestamp in ISO 8601 format",
    )
    producer: str = Field("policy-impact", description="Service producing the event")
    trace_id: str = Field(default_factory=lambda: str(uuid4()), description="Trace identifier")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event data payload")
