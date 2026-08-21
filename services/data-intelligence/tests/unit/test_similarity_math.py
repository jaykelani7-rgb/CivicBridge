import pytest

from app.domain.errors import InvalidEmbeddingError
from app.services.similarity import classify_similarity, content_hash, cosine_similarity


def test_content_hash_is_deterministic_and_versioned():
    base = content_hash("same", "v1", "model-a", 768)
    assert base == content_hash("same", "v1", "model-a", 768)
    assert (
        len(
            {
                base,
                content_hash("changed", "v1", "model-a", 768),
                content_hash("same", "v1", "model-b", 768),
                content_hash("same", "v1", "model-a", 256),
                content_hash("same", "v2", "model-a", 768),
            }
        )
        == 5
    )


def test_cosine_similarity_vectors_and_safe_zero_handling():
    assert cosine_similarity([1, 0], [1, 0], expected_dimension=2) == 1
    assert cosine_similarity([1, 0], [0, 1], expected_dimension=2) == 0
    assert cosine_similarity([0, 0], [1, 0], expected_dimension=2) == 0
    with pytest.raises(InvalidEmbeddingError, match="dimension mismatch"):
        cosine_similarity([1], [1, 0], expected_dimension=2)


@pytest.mark.parametrize(
    "score,expected",
    [
        (0.88, "probable_duplicate"),
        (0.879999, "related_request"),
        (0.78, "related_request"),
        (0.779999, "separate_request"),
    ],
)
def test_similarity_threshold_boundaries(score, expected):
    assert classify_similarity(score, 0.88, 0.78) == expected
