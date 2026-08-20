from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid
import datetime

class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    schema_version: str = "1.0.0"
    occurred_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    producer: str
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: Dict[str, Any]

class ErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool = False
    details: List[Any] = Field(default_factory=list)
    trace_id: str

class StandardErrorResponse(BaseModel):
    error: ErrorDetail
