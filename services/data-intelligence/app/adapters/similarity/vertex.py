from __future__ import annotations

import random
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from app.domain.errors import (
    InvalidEmbeddingError,
    PermanentSimilarityProviderError,
    TransientSimilarityProviderError,
)
from app.domain.models import CanonicalDocument, EmbeddingRecord, ProviderMetadata
from app.services.similarity import content_hash, cosine_similarity

TRANSIENT_STATUS_CODES = {408, 429, 500, 502, 503, 504}


class VertexEmbeddingProvider:
    """Google Gen AI SDK adapter using Vertex AI and Application Default Credentials."""

    def __init__(
        self,
        project: str,
        location: str,
        model: str = "gemini-embedding-001",
        dimension: int = 768,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        batch_size: int = 20,
        *,
        client: Any | None = None,
        sleeper: Callable[[float], None] = time.sleep,
        jitter: Callable[[], float] = lambda: random.uniform(0.0, 0.25),
    ) -> None:
        if not project:
            raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex embeddings")
        if not location:
            raise ValueError("GOOGLE_CLOUD_LOCATION is required for Vertex embeddings")
        if (
            not model
            or dimension < 1
            or timeout_seconds <= 0
            or not 1 <= batch_size <= 100
        ):
            raise ValueError(
                "Vertex embedding model, dimension, timeout, or batch size is invalid"
            )
        self._metadata = ProviderMetadata("vertex", model, dimension, "v1")
        self.max_retries = max_retries
        self.batch_size = batch_size
        self.sleeper = sleeper
        self.jitter = jitter
        if client is None:
            try:
                from google import genai
                from google.genai import types
            except ImportError as exc:
                raise PermanentSimilarityProviderError(
                    "Install google-genai to use Vertex semantic embeddings."
                ) from exc
            try:
                client = genai.Client(
                    vertexai=True,
                    project=project,
                    location=location,
                    http_options=types.HttpOptions(
                        api_version="v1", timeout=int(timeout_seconds * 1000)
                    ),
                )
            except Exception as exc:
                raise PermanentSimilarityProviderError(
                    "Vertex client initialization failed; configure Application Default Credentials, project, and region."
                ) from exc
        self.client = client

    @property
    def metadata(self) -> ProviderMetadata:
        return self._metadata

    def embed_one(self, document: CanonicalDocument) -> EmbeddingRecord:
        return self.embed_many([document])[0]

    def embed_many(self, documents: list[CanonicalDocument]) -> list[EmbeddingRecord]:
        records: list[EmbeddingRecord] = []
        for start in range(0, len(documents), self.batch_size):
            batch = documents[start : start + self.batch_size]
            response = self._request([document.text for document in batch])
            embeddings = getattr(response, "embeddings", None)
            if not embeddings or len(embeddings) != len(batch):
                raise InvalidEmbeddingError(
                    "Vertex returned a malformed embedding response."
                )
            created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            for document, item in zip(batch, embeddings):
                values = getattr(item, "values", None)
                if values is None and isinstance(item, dict):
                    values = item.get("values")
                if values is None or len(values) != self.metadata.dimension:
                    raise InvalidEmbeddingError(
                        f"Vertex embedding dimension did not match configured dimension {self.metadata.dimension}."
                    )
                records.append(
                    EmbeddingRecord(
                        request_id=document.request_id,
                        content_hash=content_hash(
                            document.text,
                            document.version,
                            self.metadata.model,
                            self.metadata.dimension,
                        ),
                        embedding=[float(value) for value in values],
                        embedding_model=self.metadata.model,
                        embedding_dimension=self.metadata.dimension,
                        canonical_text_version=document.version,
                        provider=self.metadata.provider,
                        created_at=created_at,
                        canonical_text=document.text,
                    )
                )
        return records

    def similarity(self, left: EmbeddingRecord, right: EmbeddingRecord) -> float:
        return cosine_similarity(
            left.embedding, right.embedding, expected_dimension=self.metadata.dimension
        )

    def _request(self, contents: list[str]):
        for attempt in range(self.max_retries + 1):
            try:
                return self.client.models.embed_content(
                    model=self.metadata.model,
                    contents=contents,
                    config={
                        "task_type": "SEMANTIC_SIMILARITY",
                        "output_dimensionality": self.metadata.dimension,
                    },
                )
            except Exception as exc:
                transient = self._is_transient(exc)
                if not transient:
                    raise PermanentSimilarityProviderError(
                        "Vertex rejected the embedding request; check input, ADC, IAM, project, and region."
                    ) from exc
                if attempt >= self.max_retries:
                    raise TransientSimilarityProviderError(
                        "Vertex embeddings remained unavailable after bounded retries."
                    ) from exc
                delay = min(4.0, 0.25 * (2**attempt)) + self.jitter()
                self.sleeper(delay)
        raise TransientSimilarityProviderError(
            "Vertex embeddings are temporarily unavailable."
        )

    @staticmethod
    def _is_transient(exc: Exception) -> bool:
        code = getattr(exc, "code", None)
        if callable(code):
            code = code()
        status_code = getattr(exc, "status_code", None)
        response = getattr(exc, "response", None)
        response_status = getattr(response, "status_code", None)
        if (
            code in TRANSIENT_STATUS_CODES
            or status_code in TRANSIENT_STATUS_CODES
            or response_status in TRANSIENT_STATUS_CODES
        ):
            return True
        return isinstance(exc, (TimeoutError, ConnectionError)) or type(
            exc
        ).__name__ in {
            "TimeoutException",
            "ConnectError",
            "ReadError",
            "RemoteProtocolError",
        }
