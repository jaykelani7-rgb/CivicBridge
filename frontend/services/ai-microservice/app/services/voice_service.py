from app.models.common import ExplainabilityEvidence
from app.models.voice import (
    NeedCandidate,
    NeedExtractionRequest,
    NeedExtractionResponse,
    VoiceTranscriptionRequest,
    VoiceTranscriptionResponse,
)


def transcribe_audio(payload: VoiceTranscriptionRequest) -> VoiceTranscriptionResponse:
    return VoiceTranscriptionResponse(
        transcript="Need water support and ORS near the temporary school shelter.",
        detected_language=payload.language_hint or "en",
        confidence_score=0.94,
        media_duration_seconds=payload.duration_seconds or 38,
    )


def extract_need_candidate(
    payload: NeedExtractionRequest,
) -> NeedExtractionResponse:
    candidate = NeedCandidate(
        title="Water and hydration support needed",
        summary="Shelter request mentions water access and ORS shortage.",
        category="Water Access",
        urgency_score=88,
        beneficiary_count_hint=65,
        tags=["hydration", "shelter", "verified-pending"],
        location=payload.location_hint,
    )

    explainability = ExplainabilityEvidence(
        summary="Repeated urgency and hydration signals were detected in the transcript.",
        data_points=[
            "Keywords matched water shortage and illness support.",
            "Urgency-weighted phrases increased extraction confidence.",
            "Beneficiary hint was inferred from transcript context.",
        ],
    )

    return NeedExtractionResponse(
        normalized_text=payload.transcript.strip(),
        needs_review=False,
        confidence_score=0.91,
        candidate=candidate,
        explainability=explainability,
    )
