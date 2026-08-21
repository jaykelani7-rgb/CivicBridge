import os

import pytest

from app.adapters.similarity.vertex import VertexEmbeddingProvider
from app.domain.models import CanonicalDocument

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_VERTEX_INTEGRATION_TESTS", "false").lower() != "true",
    reason="Set RUN_VERTEX_INTEGRATION_TESTS=true and configure ADC to run live Vertex tests.",
)


def test_live_vertex_semantic_ordering():
    provider = VertexEmbeddingProvider(
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        model=os.getenv("VERTEX_EMBEDDING_MODEL", "gemini-embedding-001"),
        dimension=int(os.getenv("EMBEDDING_DIMENSION", "768")),
    )
    records = provider.embed_many(
        [
            CanonicalDocument("a", "Village drinking water pump is broken."),
            CanonicalDocument(
                "b", "Community borewell failure has stopped drinking water access."
            ),
            CanonicalDocument(
                "c", "A road has deep potholes and needs surface repair."
            ),
        ]
    )
    assert provider.similarity(records[0], records[1]) > provider.similarity(
        records[0], records[2]
    )
