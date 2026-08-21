from __future__ import annotations

import hashlib
import logging
import math
import re
from difflib import SequenceMatcher
from typing import Any

from app.domain.errors import InvalidEmbeddingError, SimilarityProviderError
from app.domain.models import (
    CanonicalDocument,
    EmbeddingRecord,
    SimilarityBatchResult,
    SimilarityMeasurement,
)

TOKEN = re.compile(r"[^\W_]+", re.UNICODE)
logger = logging.getLogger("civicbridge.data_intelligence")


def _tokens(value: str) -> set[str]:
    return {token.casefold() for token in TOKEN.findall(value) if len(token) > 2}


def text_similarity(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    jaccard = len(a & b) / len(a | b) if a | b else 0.0
    sequence = SequenceMatcher(None, left.casefold(), right.casefold()).ratio()
    return round(0.65 * jaccard + 0.35 * sequence, 6)


def content_hash(text: str, version: str, model: str, dimension: int) -> str:
    payload = "\x1f".join((version, model, str(dimension), text))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def cosine_similarity(
    left: list[float], right: list[float], *, expected_dimension: int
) -> float:
    if len(left) != expected_dimension or len(right) != expected_dimension:
        raise InvalidEmbeddingError(
            f"Embedding dimension mismatch; expected {expected_dimension}, got {len(left)} and {len(right)}."
        )
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    value = sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)
    return round(max(-1.0, min(1.0, value)), 6)


def classify_similarity(
    score: float, duplicate_threshold: float, related_threshold: float
) -> str:
    if score >= duplicate_threshold:
        return "probable_duplicate"
    if score >= related_threshold:
        return "related_request"
    return "separate_request"


class CachedSimilarityService:
    """Cache provider embeddings and transparently expose explicit lexical degradation."""

    def __init__(
        self,
        repository: Any,
        primary: Any,
        fallback: Any,
        duplicate_threshold: float,
        related_threshold: float,
    ) -> None:
        self.repository = repository
        self.primary = primary
        self.fallback = fallback
        self.duplicate_threshold = duplicate_threshold
        self.related_threshold = related_threshold

    @property
    def metadata(self):
        return self.primary.metadata

    def compare_many(
        self,
        query: CanonicalDocument,
        candidates: list[CanonicalDocument],
        *,
        log_context: dict[str, Any],
    ) -> SimilarityBatchResult:
        documents = [query, *candidates]
        try:
            return self._compare_with(self.primary, documents, degraded=False)
        except SimilarityProviderError as exc:
            if self.primary.metadata.provider == self.fallback.metadata.provider:
                raise
            logger.warning(
                "similarity_provider_fallback",
                extra={
                    **log_context,
                    "error_code": exc.code,
                    "result": "fallback",
                    "similarity_provider": self.fallback.metadata.provider,
                    "embedding_model": self.fallback.metadata.model,
                    "degraded": True,
                },
            )
            return self._compare_with(self.fallback, documents, degraded=True)

    def _compare_with(
        self, provider: Any, documents: list[CanonicalDocument], *, degraded: bool
    ) -> SimilarityBatchResult:
        records = self._records(provider, documents)
        query = records[0]
        measurements: dict[str, SimilarityMeasurement] = {}
        for record in records[1:]:
            score = provider.similarity(query, record)
            measurements[record.request_id] = SimilarityMeasurement(
                score=score,
                classification=classify_similarity(
                    score, self.duplicate_threshold, self.related_threshold
                ),
                provider=provider.metadata.provider,
                model=provider.metadata.model,
                dimension=provider.metadata.dimension,
                canonical_text_version=provider.metadata.canonical_text_version,
                degraded=degraded,
            )
        metadata = provider.metadata
        return SimilarityBatchResult(
            measurements=measurements,
            provider=metadata.provider,
            model=metadata.model,
            dimension=metadata.dimension,
            canonical_text_version=metadata.canonical_text_version,
            degraded=degraded,
        )

    def _records(
        self, provider: Any, documents: list[CanonicalDocument]
    ) -> list[EmbeddingRecord]:
        records: dict[str, EmbeddingRecord] = {}
        missing: list[CanonicalDocument] = []
        metadata = provider.metadata
        for document in documents:
            digest = content_hash(
                document.text, document.version, metadata.model, metadata.dimension
            )
            cached = self.repository.get_embedding(digest)
            if cached:
                cached = {**cached, "request_id": document.request_id}
                records[document.request_id] = EmbeddingRecord(
                    **cached, canonical_text=document.text
                )
            else:
                missing.append(document)
        if missing:
            generated = provider.embed_many(missing)
            if len(generated) != len(missing):
                raise InvalidEmbeddingError(
                    "The similarity provider returned an unexpected embedding count."
                )
            for record in generated:
                self.repository.save_embedding(record)
                records[record.request_id] = record
        return [records[document.request_id] for document in documents]
