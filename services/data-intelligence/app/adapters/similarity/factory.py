from __future__ import annotations

from app.adapters.similarity.lexical import LexicalSimilarityProvider
from app.adapters.similarity.vertex import VertexEmbeddingProvider
from app.services.similarity import CachedSimilarityService


def build_similarity_service(settings, repository) -> CachedSimilarityService:
    lexical = LexicalSimilarityProvider(settings.embedding_dimension)
    primary = lexical
    if settings.similarity_provider == "vertex":
        primary = VertexEmbeddingProvider(
            project=settings.google_cloud_project or "",
            location=settings.google_cloud_location,
            model=settings.vertex_embedding_model,
            dimension=settings.embedding_dimension,
            timeout_seconds=settings.vertex_timeout_seconds,
            max_retries=settings.vertex_max_retries,
            batch_size=settings.vertex_batch_size,
        )
    return CachedSimilarityService(
        repository,
        primary,
        lexical,
        settings.duplicate_similarity_threshold,
        settings.related_similarity_threshold,
    )
