from typing import List, Optional
from pydantic import BaseModel, Field


class TranslationMetadata(BaseModel):
    performed: bool
    provider: Optional[str] = None
    confidence: Optional[float] = None

class NormalizedRequestData(BaseModel):
    request_id: str
    country_code: str
    original_language: str
    working_language: str = "en"
    anonymized_original_summary: Optional[str] = None
    translation: Optional[TranslationMetadata] = None
    transcript_original: str
    translation_working: str
    category: str = Field(..., description="water, sanitation, roads, drainage, electricity, connectivity, transport, health, education, waste, housing, environment, other")
    subcategory: str
    summary: str
    problem_description: str
    requested_outcome: str
    urgency: str
    affected_scope: str
    location_mentions: List[str] = Field(default_factory=list)
    evidence_types: List[str] = Field(default_factory=list)
    confidence: float
    pii_flags: List[str] = Field(default_factory=list)
    needs_human_review: bool = False
    review_reason: Optional[str] = None
    model: str = "gemini-1.5-flash"
    prompt_version: str = "normalize-1.0.0"
    schema_version: str = "normalized-request-1.0.0"
