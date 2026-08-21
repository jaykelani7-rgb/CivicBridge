from types import SimpleNamespace

import pytest

from app.adapters.similarity.vertex import VertexEmbeddingProvider
from app.domain.errors import (
    InvalidEmbeddingError,
    PermanentSimilarityProviderError,
    TransientSimilarityProviderError,
)
from app.domain.models import CanonicalDocument


class FakeModels:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def embed_content(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class FakeError(Exception):
    def __init__(self, code):
        super().__init__(str(code))
        self.code = code


def response(*vectors):
    return SimpleNamespace(
        embeddings=[SimpleNamespace(values=list(vector)) for vector in vectors]
    )


def provider(responses, **overrides):
    models = FakeModels(responses)
    values = {
        "project": "project",
        "location": "us-central1",
        "dimension": 3,
        "client": SimpleNamespace(models=models),
        "sleeper": lambda _: None,
        "jitter": lambda: 0,
        "max_retries": 2,
        "batch_size": 2,
    }
    values.update(overrides)
    return VertexEmbeddingProvider(**values), models


def test_vertex_successful_single_embedding_and_configured_dimension():
    adapter, models = provider([response([1, 0, 0])])
    record = adapter.embed_one(CanonicalDocument("r1", "water pump"))
    assert record.embedding == [1.0, 0.0, 0.0]
    assert record.embedding_dimension == 3 and record.provider == "vertex"
    assert models.calls[0]["config"]["output_dimensionality"] == 3


def test_vertex_batch_splits_deterministically():
    adapter, models = provider([response([1, 0, 0], [0, 1, 0]), response([0, 0, 1])])
    records = adapter.embed_many(
        [CanonicalDocument(str(i), f"text {i}") for i in range(3)]
    )
    assert [record.request_id for record in records] == ["0", "1", "2"]
    assert [len(call["contents"]) for call in models.calls] == [2, 1]


def test_vertex_retries_transient_errors_only():
    adapter, models = provider([FakeError(429), FakeError(503), response([1, 0, 0])])
    assert adapter.embed_one(CanonicalDocument("r", "text")).embedding[0] == 1
    assert len(models.calls) == 3


def test_vertex_permanent_error_is_not_retried():
    adapter, models = provider([FakeError(403)])
    with pytest.raises(PermanentSimilarityProviderError):
        adapter.embed_one(CanonicalDocument("r", "text"))
    assert len(models.calls) == 1


def test_vertex_malformed_response_is_rejected():
    adapter, _ = provider([SimpleNamespace(embeddings=[])])
    with pytest.raises(InvalidEmbeddingError, match="malformed"):
        adapter.embed_one(CanonicalDocument("r", "text"))


def test_vertex_timeout_exhausts_bounded_retries():
    adapter, models = provider([TimeoutError(), TimeoutError(), TimeoutError()])
    with pytest.raises(TransientSimilarityProviderError):
        adapter.embed_one(CanonicalDocument("r", "text"))
    assert len(models.calls) == 3
