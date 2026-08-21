"""
Orchestrates the full AI Normalization pipeline (contract.md Section 5,
"AI normalization and validation"):

  1. Transcribe (if audio) via Speech-to-Text.
  2. Translate to the working language, preserving the original.
  3. Extract structured fields via Gemini under a strict response schema.
  4. Run deterministic field/enum/confidence validators and PII masking.
  5. Persist a versioned NormalizedRequestData record.
  6. Publish request.normalized.v1 or request.needs_review.v1.

This is the module both the HTTP routes and the event-bus consumer call into,
so "normalize now via API" and "normalize automatically when
request.created.v1 fires" always run identical logic.
"""
import logging
from typing import Optional, Tuple

from packages.contracts.envelope import EventEnvelope
from packages.contracts.normalization import NormalizedRequestData
from packages.event_bus.bus import EventBus

from services.ai_normalization.clients.citizen_channels_client import CitizenChannelsClient
from services.ai_normalization.config import Settings
from services.ai_normalization.database import NormalizationRecord, NormalizationRepository
from services.ai_normalization.pipeline.extraction import GeminiExtractionAdapter
from services.ai_normalization.pipeline.pii import merge_pii_flags, scan_and_mask
from services.ai_normalization.pipeline.speech import SpeechToTextAdapter
from services.ai_normalization.pipeline.translation import TranslationAdapter
from services.ai_normalization.pipeline.validators import build_review_reason, validate_and_normalize

logger = logging.getLogger("ai-normalization.service")


class RequestNotFoundError(Exception):
    """Raised when the source citizen request cannot be found anywhere (mock or real)."""


class NormalizationNeverRunError(Exception):
    """Raised by retry() when a request has never been normalized before."""


class NormalizationService:
    def __init__(
        self,
        settings: Settings,
        repository: NormalizationRepository,
        event_bus: EventBus,
        citizen_client: Optional[CitizenChannelsClient] = None,
        stt: Optional[SpeechToTextAdapter] = None,
        translator: Optional[TranslationAdapter] = None,
        extractor: Optional[GeminiExtractionAdapter] = None,
    ):
        self.settings = settings
        self.repo = repository
        self.event_bus = event_bus
        self.citizen_client = citizen_client or CitizenChannelsClient(
            base_url=settings.CITIZEN_CHANNELS_URL, timeout=settings.CITIZEN_CHANNELS_TIMEOUT_SECONDS
        )
        self.stt = stt or SpeechToTextAdapter(settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION)
        self.translator = translator or TranslationAdapter(settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION)
        self.extractor = extractor or GeminiExtractionAdapter(
            settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION, settings.GEMINI_MODEL_NAME
        )

    def get(self, request_id: str) -> Optional[NormalizationRecord]:
        return self.repo.get(request_id)

    def normalize_request(
        self,
        request_id: str,
        force: bool = False,
        trace_id: Optional[str] = None,
        location_hints: Optional[list[str]] = None,
    ) -> Tuple[NormalizationRecord, bool]:
        """
        Runs (or returns the cached result of) the full pipeline for one
        request. Returns (record, was_newly_processed).
        """
        existing = self.repo.get(request_id)
        if existing and not force:
            return existing, False

        content = self.citizen_client.get_content(request_id)
        if not content:
            raise RequestNotFoundError(request_id)

        country_code = content.get("country_code", "IN")
        language_hint = content.get("language_hint", "en")

        transcript_original, stt_status = self.stt.transcribe(
            media_ref=content.get("media_ref"),
            media_type=content.get("media_type"),
            language_code=language_hint,
            fallback_text=content.get("text"),
        )

        translation_working, translation_status = self.translator.translate(
            transcript_original, source_lang=language_hint, target_lang="en"
        )

        extraction, extraction_status = self.extractor.extract(translation_working, country_code)
        if location_hints:
            extraction["location_mentions"] = list(dict.fromkeys([
                *extraction.get("location_mentions", []),
                *(hint for hint in location_hints if hint),
            ]))

        # PII scan runs on BOTH the preserved original and the working translation,
        # per contract.md Section 12: mask before analytics, never overwrite the original meaning.
        masked_original, original_pii_flags = scan_and_mask(transcript_original)
        masked_translation, translation_pii_flags = scan_and_mask(translation_working)

        cleaned, needs_review, reasons = validate_and_normalize(
            extraction,
            country_code=country_code,
            original_text=transcript_original,
            confidence_review_threshold=self.settings.CONFIDENCE_REVIEW_THRESHOLD,
        )

        pii_flags = merge_pii_flags(
            cleaned.get("pii_flags", []),
            list(original_pii_flags),
            list(translation_pii_flags),
        )
        if pii_flags != ["none"]:
            needs_review = True
            reasons = reasons + [f"pii_detected:{','.join(pii_flags)}"]
            cleaned["review_reason"] = build_review_reason(reasons)

        if stt_status == "failed":
            needs_review = True
            cleaned["review_reason"] = cleaned.get("review_reason") or "speech_to_text_failed"

        model_name = self.settings.GEMINI_MODEL_NAME if not self.settings.USE_MOCK_SERVICES else "mock-rule-engine"

        result = NormalizedRequestData(
            request_id=request_id,
            country_code=country_code,
            original_language=language_hint,
            transcript_original=masked_original,
            translation_working=masked_translation,
            category=cleaned["category"],
            subcategory=cleaned["subcategory"],
            summary=cleaned["summary"],
            problem_description=cleaned["problem_description"],
            requested_outcome=cleaned["requested_outcome"],
            urgency=cleaned["urgency"],
            affected_scope=cleaned["affected_scope"],
            location_mentions=cleaned["location_mentions"],
            evidence_types=cleaned["evidence_types"],
            confidence=cleaned["confidence"],
            pii_flags=pii_flags,
            needs_human_review=needs_review,
            review_reason=cleaned.get("review_reason"),
            model=model_name,
            prompt_version=self.settings.PROMPT_VERSION,
            schema_version=self.settings.SCHEMA_VERSION,
        )

        status = "needs_review" if needs_review else "normalized"
        record = self.repo.save(request_id, result, status)

        event_type = "request.needs_review.v1" if needs_review else "request.normalized.v1"
        event = EventEnvelope(
            event_type=event_type,
            producer="ai-normalization",
            data=result.model_dump(),
            **({"trace_id": trace_id} if trace_id else {}),
        )
        self.event_bus.publish(event)

        logger.info(
            "Normalized request %s -> %s (category=%s, confidence=%.2f, stt=%s, translation=%s, extraction=%s)",
            request_id,
            event_type,
            result.category,
            result.confidence,
            stt_status,
            translation_status,
            extraction_status,
        )

        return record, True

    def retry(self, request_id: str) -> NormalizationRecord:
        if not self.repo.exists(request_id):
            raise NormalizationNeverRunError(request_id)
        record, _ = self.normalize_request(request_id, force=True)
        return record
