from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone

from app.domain.models import CanonicalDocument, EmbeddingRecord, ProviderMetadata
from app.services.similarity import content_hash, text_similarity


class LexicalSimilarityProvider:
    """Credential-free deterministic fallback preserving explainable lexical matching."""

    def __init__(
        self, dimension: int = 768, canonical_text_version: str = "v1"
    ) -> None:
        self._metadata = ProviderMetadata(
            provider="lexical",
            model="lexical-explainable-v1",
            dimension=dimension,
            canonical_text_version=canonical_text_version,
        )

    @property
    def metadata(self) -> ProviderMetadata:
        return self._metadata

    def embed_one(self, document: CanonicalDocument) -> EmbeddingRecord:
        return self.embed_many([document])[0]

    def embed_many(self, documents: list[CanonicalDocument]) -> list[EmbeddingRecord]:
        created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        result = []
        for document in documents:
            vector = [0.0] * self.metadata.dimension
            for token in document.text.casefold().split():
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                index = int.from_bytes(digest[:4], "big") % self.metadata.dimension
                vector[index] += 1.0 if digest[4] % 2 else -1.0
            norm = math.sqrt(sum(value * value for value in vector))
            if norm:
                vector = [value / norm for value in vector]
            result.append(
                EmbeddingRecord(
                    request_id=document.request_id,
                    content_hash=content_hash(
                        document.text,
                        document.version,
                        self.metadata.model,
                        self.metadata.dimension,
                    ),
                    embedding=vector,
                    embedding_model=self.metadata.model,
                    embedding_dimension=self.metadata.dimension,
                    canonical_text_version=document.version,
                    provider=self.metadata.provider,
                    created_at=created_at,
                    canonical_text=document.text,
                )
            )
        return result

    def similarity(self, left: EmbeddingRecord, right: EmbeddingRecord) -> float:
        left_fields = self._fields(left.canonical_text)
        right_fields = self._fields(right.canonical_text)
        if left_fields.get("summary") and right_fields.get("summary"):
            summary = text_similarity(left_fields["summary"], right_fields["summary"])
            outcome = text_similarity(
                left_fields.get("requested_outcome", ""),
                right_fields.get("requested_outcome", ""),
            )
            return round(0.8 * summary + 0.2 * outcome, 6)
        return text_similarity(left.canonical_text, right.canonical_text)

    @staticmethod
    def _fields(value: str) -> dict[str, str]:
        result = {}
        for line in value.splitlines():
            name, separator, content = line.partition(": ")
            if separator:
                result[name] = content
        return result
