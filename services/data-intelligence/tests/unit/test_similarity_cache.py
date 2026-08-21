import logging
from pathlib import Path

from app.adapters.similarity.lexical import LexicalSimilarityProvider
from app.domain.errors import TransientSimilarityProviderError
from app.domain.models import CanonicalDocument, ProviderMetadata
from app.services.similarity import CachedSimilarityService


class CountingLexical(LexicalSimilarityProvider):
    def __init__(self, model="lexical-explainable-v1"):
        super().__init__(32)
        self._metadata = ProviderMetadata("lexical", model, 32, "v1")
        self.calls = 0

    def embed_many(self, documents):
        self.calls += 1
        return super().embed_many(documents)


class FailingVertex:
    metadata = ProviderMetadata("vertex", "gemini-embedding-001", 32, "v1")

    def embed_many(self, documents):
        raise TransientSimilarityProviderError("temporary")

    def similarity(self, left, right):
        raise AssertionError("not reached")


def service(repository, primary, fallback=None):
    return CachedSimilarityService(repository, primary, fallback or primary, 0.88, 0.78)


def documents():
    return CanonicalDocument("a", "water pump broken"), [
        CanonicalDocument("b", "water pump damaged")
    ]


def test_cache_hit_avoids_provider_request(app):
    provider = CountingLexical()
    similarity = service(app.state.repository, provider)
    query, candidates = documents()
    similarity.compare_many(query, candidates, log_context={})
    similarity.compare_many(query, candidates, log_context={})
    assert provider.calls == 1


def test_cached_content_is_reused_for_a_different_request_id(app):
    provider = CountingLexical()
    similarity = service(app.state.repository, provider)
    first = CanonicalDocument("first", "same canonical content")
    similarity.compare_many(
        first, [CanonicalDocument("candidate", "other")], log_context={}
    )
    result = similarity.compare_many(
        CanonicalDocument("second", "same canonical content"),
        [CanonicalDocument("candidate-two", "other")],
        log_context={},
    )
    assert "candidate-two" in result.measurements
    assert provider.calls == 1


def test_model_change_invalidates_cache(app):
    query, candidates = documents()
    first, second = CountingLexical("model-v1"), CountingLexical("model-v2")
    service(app.state.repository, first).compare_many(query, candidates, log_context={})
    service(app.state.repository, second).compare_many(
        query, candidates, log_context={}
    )
    assert first.calls == second.calls == 1
    count = app.state.repository.connection.execute(
        "SELECT COUNT(*) FROM request_embeddings"
    ).fetchone()[0]
    assert count == 4


def test_vertex_failure_invokes_logged_lexical_fallback(app, caplog):
    fallback = CountingLexical()
    similarity = service(app.state.repository, FailingVertex(), fallback)
    query, candidates = documents()
    with caplog.at_level(logging.WARNING):
        result = similarity.compare_many(
            query, candidates, log_context={"request_id": "safe-id"}
        )
    assert result.degraded is True and result.provider == "lexical"
    assert fallback.calls == 1
    assert "similarity_provider_fallback" in caplog.text


def test_vertex_success_does_not_invoke_fallback(app):
    primary, fallback = (
        CountingLexical("primary-model"),
        CountingLexical("fallback-model"),
    )
    result = service(app.state.repository, primary, fallback).compare_many(
        *documents(), log_context={}
    )
    assert result.degraded is False
    assert primary.calls == 1 and fallback.calls == 0


def test_embedding_migration_is_reversible(app):
    migration = (
        Path(__file__).resolve().parents[2]
        / "migrations"
        / "down"
        / "002_semantic_embeddings.sql"
    )
    app.state.repository.connection.executescript(migration.read_text(encoding="utf-8"))
    tables = app.state.repository.connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='request_embeddings'"
    ).fetchall()
    columns = {
        row[1]
        for row in app.state.repository.connection.execute(
            "PRAGMA table_info(duplicate_candidates)"
        )
    }
    assert not tables
    assert "similarity_provider" not in columns
