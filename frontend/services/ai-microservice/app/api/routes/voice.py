from fastapi import APIRouter

from app.models.voice import (
    NeedExtractionRequest,
    NeedExtractionResponse,
    VoiceTranscriptionRequest,
    VoiceTranscriptionResponse,
)
from app.services.voice_service import extract_need_candidate, transcribe_audio

router = APIRouter()


@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice_note(
    payload: VoiceTranscriptionRequest,
) -> VoiceTranscriptionResponse:
    return transcribe_audio(payload)


@router.post("/extract", response_model=NeedExtractionResponse)
async def extract_need_from_voice_or_text(
    payload: NeedExtractionRequest,
) -> NeedExtractionResponse:
    return extract_need_candidate(payload)
