from typing import Any, List, Optional
from pydantic import BaseModel, Field


class StandardErrorBody(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error explanation")
    retryable: bool = Field(False, description="Whether the operation can be retried safely")
    details: List[Any] = Field(default_factory=list, description="Additional context or validation details")
    trace_id: Optional[str] = Field(None, description="Distributed trace identifier")


class StandardErrorResponse(BaseModel):
    error: StandardErrorBody
