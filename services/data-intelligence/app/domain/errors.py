from __future__ import annotations

from typing import Any, Optional


class DomainError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: Optional[list[dict[str, Any]]] = None,
        http_status: int = 422,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or []
        self.http_status = http_status


class NotFoundError(DomainError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, http_status=404)


class DependencyError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__("DEPENDENCY_UNAVAILABLE", message, retryable=True, http_status=503)


class SimilarityProviderError(DomainError):
    def __init__(self, code: str, message: str, *, retryable: bool) -> None:
        super().__init__(code, message, retryable=retryable, http_status=503 if retryable else 422)


class TransientSimilarityProviderError(SimilarityProviderError):
    def __init__(self, message: str) -> None:
        super().__init__("SIMILARITY_PROVIDER_TRANSIENT", message, retryable=True)


class PermanentSimilarityProviderError(SimilarityProviderError):
    def __init__(self, message: str) -> None:
        super().__init__("SIMILARITY_PROVIDER_PERMANENT", message, retryable=False)


class InvalidEmbeddingError(SimilarityProviderError):
    def __init__(self, message: str) -> None:
        super().__init__("EMBEDDING_INVALID", message, retryable=False)
