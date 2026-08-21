from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.adapters.geospatial.local import haversine_km
from app.domain.models import DuplicateCandidate, Geography, SimilarityBatchResult
from app.schemas.events import NormalizedRequest
from app.services.canonical_text import canonical_candidate, canonical_request
from app.services.similarity import text_similarity


class DuplicateDetector:
    WEIGHTS = {"semantic": 0.50, "spatial": 0.25, "temporal": 0.15, "taxonomy": 0.10}

    def __init__(self, repository: Any, distance_km: float, time_window_days: int, high: float, review: float,
                 similarity_service: Any) -> None:
        self.repository = repository
        self.distance_km = distance_km
        self.time_window_days = time_window_days
        self.high = high
        self.review = review
        self.similarity_service = similarity_service

    def find(self, request: NormalizedRequest, geography: Geography, occurred_at: datetime) -> list[DuplicateCandidate]:
        return self.find_with_metadata(request, geography, occurred_at)[0]

    def find_with_metadata(self, request: NormalizedRequest, geography: Geography,
                           occurred_at: datetime) -> tuple[list[DuplicateCandidate], SimilarityBatchResult]:
        after = (occurred_at - timedelta(days=self.time_window_days)).isoformat().replace("+00:00", "Z")
        candidates = self.repository.list_candidate_members(request.country_code, request.category, after)
        comparison = self.similarity_service.compare_many(
            canonical_request(request, geography),
            [canonical_candidate(row) for row in candidates],
            log_context={"request_id": str(request.request_id)},
        )
        result: list[DuplicateCandidate] = []
        for row in candidates:
            distance = haversine_km(geography.latitude, geography.longitude, row["centroid_lat"], row["centroid_lon"])
            if distance > self.distance_km:
                continue
            previous_at = datetime.fromisoformat(row["occurred_at"].replace("Z", "+00:00"))
            days = abs((occurred_at - previous_at).total_seconds()) / 86400
            measurement = comparison.measurements[row["request_id"]]
            semantic = measurement.score
            spatial = max(0.0, 1.0 - distance / self.distance_km)
            temporal = max(0.0, 1.0 - days / self.time_window_days)
            taxonomy = 1.0 if request.subcategory and request.subcategory == row["subcategory"] else 0.7
            final = (0.50 * semantic + 0.25 * spatial + 0.15 * temporal + 0.10 * taxonomy)
            if final >= self.high:
                action, reason = "auto_attach", "High similarity with compatible taxonomy and nearby geography."
            elif final >= self.review:
                action, reason = "manual_review", "Moderate similarity; an analyst must decide whether to merge."
            else:
                action, reason = "separate", "Similarity is below the configured review threshold."
            result.append(DuplicateCandidate(
                candidate_request_id=row["request_id"], candidate_cluster_id=row["cluster_id"],
                final_similarity=round(final, 6), semantic_similarity=round(semantic, 6),
                spatial_similarity=round(spatial, 6), temporal_similarity=round(temporal, 6),
                taxonomy_similarity=round(taxonomy, 6), distance_km=round(distance, 3),
                time_difference_days=round(days, 3), match_reason=reason, suggested_action=action,
                similarity_classification=measurement.classification,
                similarity_provider=measurement.provider, embedding_model=measurement.model,
                embedding_dimension=measurement.dimension,
                canonical_text_version=measurement.canonical_text_version,
                degraded_similarity=measurement.degraded,
            ))
        return sorted(result, key=lambda x: (-x.final_similarity, x.candidate_request_id)), comparison

    @staticmethod
    def stored(candidate: DuplicateCandidate, request_id: str) -> dict[str, Any]:
        row = candidate.__dict__.copy()
        row["id"] = str(uuid5(NAMESPACE_URL, f"duplicate:{request_id}:{candidate.candidate_request_id}"))
        return row
