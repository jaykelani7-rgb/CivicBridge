from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator
import datetime

class LocationApproximate(BaseModel):
    precision: str = "approximate"
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    admin_hint: Optional[str] = None

class ConsentPayload(BaseModel):
    accepted: bool
    version: str = "2026-08-01"

    @field_validator("accepted")
    def must_be_accepted(cls, v):
        if not v:
            raise ValueError("Citizen consent must be accepted before submitting.")
        return v

class CreateRequestPayload(BaseModel):
    channel: str = Field(..., description="web_text, web_voice, mobile_text, mobile_voice")
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 (e.g. IN, BR, ZA)")
    language_hint: str = Field(..., description="BCP 47 language code (e.g. hi-IN, pt-BR, en-ZA)")
    location: LocationApproximate
    consent: ConsentPayload
    text: Optional[str] = None

    @field_validator("country_code")
    def validate_country(cls, v):
        code = v.upper()
        if code not in ["IN", "BR", "ZA"]:
            raise ValueError(f"Unsupported country code: {code}. Must be IN, BR, or ZA.")
        return code

class RequestCreatedData(BaseModel):
    request_id: str
    channel: str
    country_code: str
    language_hint: str
    content_ref: str
    location: LocationApproximate
    consent: ConsentPayload
    submitted_at: str

class RequestConfirmedData(BaseModel):
    request_id: str
    confirmed_at: str
    location_confirmed: LocationApproximate
    citizen_notes: Optional[str] = None

class CitizenCorrectionPayload(BaseModel):
    reason: str
    suggested_category: Optional[str] = None
    notes: Optional[str] = None

class CitizenStatusResponse(BaseModel):
    request_id: str
    channel: str
    country_code: str
    submitted_at: str
    processing_stage: str = Field(
        ..., 
        description="submitted, normalizing, under_review, hotspot_aggregated, recommended, policy_approved, project_active"
    )
    public_summary: Optional[str] = None
    category: Optional[str] = None
    hotspot_score: Optional[float] = None
    project_title: Optional[str] = None
    project_status: Optional[str] = None
    pii_masked: bool = True

class ContentRetrievalResponse(BaseModel):
    request_id: str
    channel: str
    language_hint: str
    country_code: str
    text: Optional[str] = None
    media_ref: Optional[str] = None
    media_type: Optional[str] = None
    submitted_at: str
