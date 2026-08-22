from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

from app.models.common import ExplainabilityEvidence, JobEnvelope


class OCRExtractionRequest(BaseModel):
    report_id: str | None = None
    image_url: HttpUrl
    language_hint: str | None = None
    script_hint: str | None = None
    source: Literal["WHATSAPP", "OCR", "MANUAL"] = "OCR"


class OCRField(BaseModel):
    name: str
    value: str
    confidence_score: float = Field(..., ge=0, le=1)


class OCRExtractionResponse(JobEnvelope):
    engine: str
    detected_language: str | None = None
    confidence_score: float = Field(..., ge=0, le=1)
    needs_review: bool
    extracted_text: str
    parsed_fields: list[OCRField] = Field(default_factory=list)
    explainability: ExplainabilityEvidence


class OCRReviewRequest(BaseModel):
    extraction_id: str
    approved: bool
    reviewer_user_id: str
    review_notes: str | None = None
