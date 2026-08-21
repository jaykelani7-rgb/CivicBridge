"""
Speech-to-Text adapter.

Real path uses Google Cloud Speech-to-Text V2 exclusively (per the hackathon's
mandatory-Google-AI requirement and the stack table in the blueprint). Mock
path returns canned transcripts so the whole backend runs with
USE_MOCK_SERVICES=true and zero GCP credentials, matching every other service
in this repo.
"""
import logging
from typing import Optional, Tuple

logger = logging.getLogger("ai-normalization.speech")

# Representative canned transcripts for the pilot languages, used only in mock
# mode. Real audio bytes are not available cross-process in the hackathon demo
# (Sujal's service stores media privately); production would add an
# authenticated internal media-bytes endpoint on Citizen Channels for this
# adapter to call before invoking Speech-to-Text V2.
MOCK_TRANSCRIPTS = {
    "hi": "हमारे गाँव में पीने का साफ़ पानी नहीं आ रहा है, कृपया मदद करें।",
    "pt": "A rua principal está cheia de buracos e sem iluminação pública.",
    "en": "The streetlights on Main Road have been broken for a week.",
    "xh": "Sicela amanzi acocekileyo kule lali yethu.",
    "zu": "Sicela ukulungiswa kwezimoto ezisemgwaqeni ophukile.",
}


class SpeechToTextAdapter:
    def __init__(self, use_mock: bool, project_id: str = "", location: str = "us-central1"):
        self.use_mock = use_mock
        self.project_id = project_id
        self.location = location
        self._client = None
        if not use_mock:
            try:
                from google.cloud import speech_v2

                self._client = speech_v2.SpeechClient()
            except Exception as exc:
                logger.warning("Failed to initialize Cloud Speech-to-Text V2 client: %s. Falling back to mock.", exc)
                self.use_mock = True

    def transcribe(
        self,
        *,
        media_ref: Optional[str],
        media_type: Optional[str],
        language_code: str,
        fallback_text: Optional[str] = None,
        audio_content: Optional[bytes] = None,
    ) -> Tuple[str, str]:
        """
        Returns (transcript, status). status is one of:
          "skipped_no_audio" -- text channel, nothing to transcribe
          "ok"                -- transcription succeeded
          "failed"            -- transcription attempted but failed (contract:
                                  preserve audio, allow text fallback / retry)
        """
        if fallback_text:
            return fallback_text, "skipped_no_audio"

        if not media_ref:
            return "", "skipped_no_audio"

        short_lang = (language_code or "en").split("-")[0].lower()

        if self.use_mock:
            return MOCK_TRANSCRIPTS.get(short_lang, "Citizen voice request could not be matched to a mock transcript."), "ok"

        try:
            recognizer = f"projects/{self.project_id}/locations/{self.location}/recognizers/_"
            config = {
                "auto_decoding_config": {},
                "language_codes": [language_code],
                "model": "telephony",
            }
            if audio_content is None:
                logger.warning("No audio bytes available for %s; cannot call Speech-to-Text V2.", media_ref)
                return "", "failed"
            response = self._client.recognize(recognizer=recognizer, config=config, content=audio_content)
            if response.results:
                return response.results[0].alternatives[0].transcript, "ok"
            return "", "failed"
        except Exception as exc:
            logger.error("Cloud Speech-to-Text V2 transcription failed: %s", exc)
            return "", "failed"
