"""
HTTP client to Sujal's Citizen Channels service.

Mirrors the resilience pattern already used by Sharmad's
services/policy_impact/app/stubs/{ai_normalization_stub,data_intelligence_stub}.py:
try the real internal endpoint first, and fall back to a deterministic mock
record if the dependency is unreachable, so this service stays independently
runnable and testable.
"""
import hashlib
import logging
from typing import Any, Dict, Optional

import httpx

from services.ai_normalization.config import settings
from packages.cloud_runtime import cloud_run_headers

logger = logging.getLogger("ai-normalization.citizen-channels-client")


class CitizenChannelsClient:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None, allow_mock: Optional[bool] = None, internal_token: Optional[str] = None):
        self.base_url = base_url or settings.CITIZEN_CHANNELS_URL
        self.timeout = timeout if timeout is not None else settings.CITIZEN_CHANNELS_TIMEOUT_SECONDS
        self.allow_mock = settings.USE_MOCK_SERVICES if allow_mock is None else allow_mock
        self.internal_token = internal_token if internal_token is not None else settings.CITIZEN_INTERNAL_TOKEN

    def _headers(self):
        headers = cloud_run_headers(self.base_url, settings.AUTHENTICATE_CLOUD_RUN)
        if self.internal_token:
            headers["X-Internal-Token"] = self.internal_token
        return headers

    def get_content(self, request_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve the citizen-safe internal content record for a request.

        Returns a dict with: request_id, channel, language_hint, country_code,
        text, media_ref, media_type, submitted_at -- matching Sujal's
        ContentRetrievalResponse contract -- or None if the request truly does
        not exist anywhere (mock or real).
        """
        try:
            resp = httpx.get(
                f"{self.base_url}/internal/v1/requests/{request_id}/content",
                headers=self._headers(),
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 404:
                return None
            if not self.allow_mock:
                raise RuntimeError(f"Citizen content retrieval returned HTTP {resp.status_code}")
        except Exception as exc:
            if not self.allow_mock:
                raise RuntimeError("Citizen content retrieval failed") from exc
            logger.warning("Citizen service unreachable in explicit demo mode (%s)", exc)

        return self._mock_content(request_id)

    def get_audio(self, request_id: str, media_ref: str) -> bytes:
        response = httpx.get(
            f"{self.base_url}/internal/v1/requests/{request_id}/media",
            params={"media_ref": media_ref}, headers=self._headers(), timeout=self.timeout,
        )
        response.raise_for_status()
        if not response.headers.get("content-type", "").startswith("audio/"):
            raise ValueError("Internal media response was not audio")
        if not response.content or len(response.content) > 10 * 1024 * 1024:
            raise ValueError("Internal audio is empty or too large")
        return response.content

    @staticmethod
    def _mock_content(request_id: str) -> Dict[str, Any]:
        """
        Deterministic fallback content, keyed off the request_id, used only when
        Sujal's real service cannot be reached (standalone demo/tests).
        """
        digest = int(hashlib.sha256(request_id.encode("utf-8")).hexdigest(), 16)
        samples = [
            {
                "country_code": "IN",
                "language_hint": "hi-IN",
                "channel": "web_voice",
                "text": None,
                "media_ref": f"private://citizen-media/{request_id}.wav",
                "media_type": "audio/wav",
            },
            {
                "country_code": "BR",
                "language_hint": "pt-BR",
                "channel": "web_text",
                "text": "A rua principal está cheia de buracos e sem iluminação pública.",
                "media_ref": None,
                "media_type": None,
            },
            {
                "country_code": "ZA",
                "language_hint": "en-ZA",
                "channel": "mobile_text",
                "text": "The streetlights on Main Road have been broken for a week.",
                "media_ref": None,
                "media_type": None,
            },
        ]
        chosen = samples[digest % len(samples)]
        return {
            "request_id": request_id,
            "channel": chosen["channel"],
            "language_hint": chosen["language_hint"],
            "country_code": chosen["country_code"],
            "text": chosen["text"],
            "media_ref": chosen["media_ref"],
            "media_type": chosen["media_type"],
            "submitted_at": "2026-08-20T10:30:00Z",
        }


_client = CitizenChannelsClient()


def get_citizen_channels_client() -> CitizenChannelsClient:
    return _client
