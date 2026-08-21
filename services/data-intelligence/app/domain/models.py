from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass(frozen=True)
class Geography:
    geography_id: str
    country_code: str
    admin1: str
    admin2: str
    locality: str
    spatial_cell: str
    latitude: float
    longitude: float
    confidence: float
    boundary_source: str
    boundary_version: str


@dataclass(frozen=True)
class DuplicateCandidate:
    candidate_request_id: str
    candidate_cluster_id: str
    final_similarity: float
    semantic_similarity: float
    spatial_similarity: float
    temporal_similarity: float
    taxonomy_similarity: float
    distance_km: float
    time_difference_days: float
    match_reason: str
    suggested_action: str
    similarity_classification: str
    similarity_provider: str
    embedding_model: str
    embedding_dimension: int
    canonical_text_version: str
    degraded_similarity: bool


@dataclass(frozen=True)
class CanonicalDocument:
    request_id: str
    text: str
    version: str = "v1"


@dataclass(frozen=True)
class ProviderMetadata:
    provider: str
    model: str
    dimension: int
    canonical_text_version: str = "v1"


@dataclass(frozen=True)
class EmbeddingRecord:
    request_id: str
    content_hash: str
    embedding: list[float]
    embedding_model: str
    embedding_dimension: int
    canonical_text_version: str
    provider: str
    created_at: str
    canonical_text: str = field(default="", repr=False, compare=False)


@dataclass(frozen=True)
class SimilarityMeasurement:
    score: float
    classification: str
    provider: str
    model: str
    dimension: int
    canonical_text_version: str
    degraded: bool


@dataclass(frozen=True)
class SimilarityBatchResult:
    measurements: dict[str, SimilarityMeasurement]
    provider: str
    model: str
    dimension: int
    canonical_text_version: str
    degraded: bool


@dataclass(frozen=True)
class Component:
    name: str
    raw_value: Optional[float]
    normalized_value: float
    weight: float
    weighted_contribution: float
    source_ids: list[str]
    missing: bool
    fallback_used: Optional[float]
    confidence: float
    formula_version: str
    calculated_at: str


@dataclass(frozen=True)
class ScoreResult:
    need_score: float
    action_score: float
    evidence_confidence: float
    data_confidence: float
    components: list[Component]
    warnings: list[str]
    version: str
    calculated_at: str


@dataclass
class Metrics:
    counters: dict[str, int] = field(default_factory=dict)
    stage_durations_ms: dict[str, list[float]] = field(default_factory=dict)

    def increment(self, name: str) -> None:
        self.counters[name] = self.counters.get(name, 0) + 1

    def observe(self, name: str, duration_ms: float) -> None:
        self.stage_durations_ms.setdefault(name, []).append(round(duration_ms, 3))
