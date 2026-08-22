from app.core.config import get_settings
from app.models.common import ExplainabilityEvidence
from app.models.ocr import (
    OCRExtractionRequest,
    OCRExtractionResponse,
    OCRField,
    OCRReviewRequest,
)


def extract_document_payload(
    payload: OCRExtractionRequest,
) -> OCRExtractionResponse:
    settings = get_settings()
    confidence_score = 0.81
    needs_review = confidence_score < settings.ocr_confidence_threshold

    return OCRExtractionResponse(
        engine="vision-ocr-pipeline",
        detected_language=payload.language_hint or "ta",
        confidence_score=confidence_score,
        needs_review=needs_review,
        extracted_text="Family size 5, requires sanitation kits and food assistance.",
        parsed_fields=[
            OCRField(name="family_size", value="5", confidence_score=0.86),
            OCRField(name="sanitation_kits", value="2", confidence_score=0.82),
            OCRField(name="food_assistance", value="required", confidence_score=0.78),
        ],
        explainability=ExplainabilityEvidence(
            summary="Confidence dropped because handwritten quantities overlapped the form grid.",
            data_points=[
                "Image blur reduced numeric field certainty.",
                "Regional script detection succeeded, but quantity cells were noisy.",
                "The extraction is routed to human review because the score is below threshold.",
            ],
        ),
    )


def review_ocr_result(payload: OCRReviewRequest) -> OCRExtractionResponse:
    return OCRExtractionResponse(
        engine="human-review",
        detected_language="ta",
        confidence_score=1.0 if payload.approved else 0.0,
        needs_review=False,
        extracted_text="Human review completed.",
        parsed_fields=[],
        explainability=ExplainabilityEvidence(
            summary="Coordinator review has overridden the automated OCR decision.",
            data_points=[
                f"Approved: {payload.approved}",
                f"Reviewer user id: {payload.reviewer_user_id}",
                payload.review_notes or "No additional notes supplied.",
            ],
        ),
    )
