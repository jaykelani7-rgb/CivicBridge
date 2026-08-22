from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

from app.models.common import ExplainabilityEvidence, GeoPoint, JobEnvelope


class VoiceTranscriptionRequest(BaseModel):
    report_id: str | None = None
    media_url: HttpUrl
    language_hint: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    location_hint: GeoPoint | None = None
    source: Literal["WHATSAPP", "VOICE", "MANUAL"] = "VOICE"


class VoiceTranscriptionResponse(JobEnvelope):
    transcript: str
    detected_language: str
    confidence_score: float = Field(..., ge=0, le=1)
    source: Literal["WHISPER"] = "WHISPER"
    media_duration_seconds: int | None = None


class NeedExtractionRequest(BaseModel):
    report_id: str | None = None
    transcript: str
    language: str | None = None
    source: Literal["WHATSAPP", "VOICE", "MANUAL"] = "VOICE"
    location_hint: GeoPoint | None = None


class NeedCandidate(BaseModel):
    title: str
    summary: str
    category: str
    urgency_score: float = Field(..., ge=0, le=100)
    beneficiary_count_hint: int | None = Field(default=None, ge=0)
    tags: list[str] = Field(default_factory=list)
    location: GeoPoint | None = None


class NeedExtractionResponse(JobEnvelope):
    normalized_text: str
    needs_review: bool = False
    confidence_score: float = Field(..., ge=0, le=1)
    candidate: NeedCandidate
    explainability: ExplainabilityEvidence
