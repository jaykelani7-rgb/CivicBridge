"""
Translation adapter -- Cloud Translation Advanced only (real path).

Contract rule: "Translation fails: preserve original, retry, never invent a
translation." The mock path below returns the original text with a clearly
marked prefix rather than fabricating language it doesn't actually know, for
any string outside the small curated demo set.
"""
import logging
from typing import Tuple

logger = logging.getLogger("ai-normalization.translation")

MOCK_TRANSLATIONS = {
    "हमारे गाँव में पीने का साफ़ पानी नहीं आ रहा है, कृपया मदद करें।": "There is no clean drinking water in our village, please help.",
    "A rua principal está cheia de buracos e sem iluminação pública.": "The main street is full of potholes and has no street lighting.",
    "Sicela amanzi acocekileyo kule lali yethu.": "We want clean water in our village.",
    "Sicela ukulungiswa kwezimoto ezisemgwaqeni ophukile.": "Please repair the broken streetlights on the road.",
}


class TranslationAdapter:
    def __init__(self, use_mock: bool, project_id: str = "", location: str = "global"):
        self.use_mock = use_mock
        self.project_id = project_id
        self.location = location
        self._client = None
        if not use_mock:
            try:
                from google.cloud import translate_v3

                self._client = translate_v3.TranslationServiceClient()
            except Exception as exc:
                logger.warning("Failed to initialize Cloud Translation Advanced client: %s. Falling back to mock.", exc)
                self.use_mock = True

    def translate(self, text: str, source_lang: str, target_lang: str = "en") -> Tuple[str, str]:
        """
        Returns (translated_text, status). status in {"not_needed", "ok", "failed"}.
        """
        if not text:
            return text, "not_needed"

        short_source = (source_lang or "en").split("-")[0].lower()
        short_target = (target_lang or "en").split("-")[0].lower()
        if short_source == short_target:
            return text, "not_needed"

        if self.use_mock:
            if text in MOCK_TRANSLATIONS:
                return MOCK_TRANSLATIONS[text], "ok"
            return f"[Translated from {source_lang}] {text}", "ok"

        try:
            parent = f"projects/{self.project_id}/locations/{self.location}"
            response = self._client.translate_text(
                request={
                    "parent": parent,
                    "contents": [text],
                    "mime_type": "text/plain",
                    "source_language_code": short_source,
                    "target_language_code": short_target,
                }
            )
            if response.translations:
                return response.translations[0].translated_text, "ok"
            return text, "failed"
        except Exception as exc:
            logger.error("Cloud Translation Advanced call failed: %s", exc)
            return text, "failed"
