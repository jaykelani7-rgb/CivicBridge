from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, Literal, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_CATEGORIES = {
    "water", "sanitation", "roads", "drainage", "electricity", "connectivity",
    "transport", "health", "education", "waste", "housing", "environment", "other",
}
SUPPORTED_COUNTRIES = {"IN", "BR", "ZA"}


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="ignore")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    precision: str = "approximate"


class NormalizedRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    request_id: UUID
    country_code: str
    original_language: str
    transcript_original: Optional[str] = None
    translation_working: str
    category: str
    subcategory: Optional[str] = None
    summary: str = Field(min_length=3, max_length=500)
    problem_description: str = ""
    requested_outcome: str = ""
    urgency: Literal["low", "medium", "high", "critical"]
    affected_scope: str
    location_mentions: list[str] = Field(default_factory=list)
    location: Optional[Coordinates] = None
    administrative_id: Optional[str] = None
    evidence_types: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    pii_flags: list[str] = Field(default_factory=list)
    needs_human_review: bool
    review_reason: Optional[str] = None
    model: str
    prompt_version: str
    schema_version: Literal["normalized-request-1.0.0"]

    @model_validator(mode="before")
    @classmethod
    def reject_raw_pii_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            forbidden = {"phone", "phone_number", "email", "email_address", "exact_address", "home_address"}
            present = sorted(forbidden.intersection(value))
            if present:
                raise ValueError(f"forbidden raw PII fields: {', '.join(present)}")
        return value

    @field_validator("country_code")
    @classmethod
    def validate_country(cls, value: str) -> str:
        value = value.upper()
        if value not in SUPPORTED_COUNTRIES:
            raise ValueError("unsupported country")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        value = value.lower()
        if value not in ALLOWED_CATEGORIES:
            raise ValueError("unsupported category")
        return value

    @field_validator("pii_flags")
    @classmethod
    def reject_forbidden_pii(cls, value: list[str]) -> list[str]:
        forbidden = {"raw_phone", "raw_email", "raw_address", "contact_information"}
        if forbidden.intersection(x.lower() for x in value):
            raise ValueError("analytical payload contains forbidden raw PII")
        return value

    @field_validator("location_mentions")
    @classmethod
    def usable_mentions(cls, value: list[str]) -> list[str]:
        return [x.strip() for x in value if x.strip()]


T = TypeVar("T")


class EventEnvelope(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="ignore")
    event_id: UUID
    event_type: str
    schema_version: Literal["1.0.0"]
    occurred_at: datetime
    producer: str
    trace_id: UUID
    data: T

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("occurred_at must include a timezone")
        return value.astimezone(timezone.utc)


class NormalizedRequestEvent(EventEnvelope[NormalizedRequest]):
    event_type: Literal["request.normalized.v1"]


class HotspotUpdatedData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hotspot_id: UUID
    country_code: str
    geography_id: str
    category: str
    request_count: int = Field(ge=0)
    unique_request_count: int = Field(ge=0)
    affected_population: int = Field(ge=0)
    trend_30d: float
    need_score: float = Field(ge=0, le=100)
    action_score: float = Field(ge=0, le=100)
    evidence_confidence: float = Field(ge=0, le=1)
    score_version: str
    evidence_bundle_id: str
    calculated_at: datetime


class HotspotUpdatedEvent(EventEnvelope[HotspotUpdatedData]):
    event_type: Literal["hotspot.updated.v1"]


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    reason: str


class ErrorBody(BaseModel):
    code: str
    message: str
    retryable: bool
    details: list[dict[str, Any]]
    trace_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorBody
