from pydantic import BaseModel, Field
from typing import List, Optional

class CitizenRequestAIResponse(BaseModel):
    category: str = Field(
        ..., 
        description="Must be one of: water, sanitation, roads, drainage, electricity, connectivity, transport, health, education, waste, other"
    )
    subcategory: str = Field(
        ..., 
        description="Country-pack controlled subcategory string matching taxonomy"
    )
    summary: str = Field(
        ..., 
        description="One neutral sentence summarizing the request"
    )
    problem_description: str = Field(
        ..., 
        description="Normalized description of the issue without introducing new facts"
    )
    requested_outcome: str = Field(
        ..., 
        description="What outcome the citizen explicitly wants changed or resolved"
    )
    urgency: str = Field(
        ..., 
        description="Priority urgency rating: low, medium, high, critical"
    )
    location_mentions: List[str] = Field(
        default_factory=list, 
        description="Place names, landmarks, or street names explicitly mentioned in the request text"
    )
    evidence_types: List[str] = Field(
        default_factory=list, 
        description="Types of evidence present: voice, text, photo, repeat_report, service_outage"
    )
    affected_scope: str = Field(
        ..., 
        description="Scope of impact: individual, household, street, community, unknown"
    )
    pii_flags: List[str] = Field(
        default_factory=list, 
        description="PII elements detected: phone, email, person_name, exact_home, none"
    )
    confidence: float = Field(
        ..., 
        description="Overall model confidence score from 0.0 to 1.0"
    )
    needs_human_review: bool = Field(
        ..., 
        description="True if output is ambiguous, highly urgent, contains flags, or has low confidence"
    )
    review_reason: Optional[str] = Field(
        None, 
        description="Short, controlled explanation of why human review is required"
    )
