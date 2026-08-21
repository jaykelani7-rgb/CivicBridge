from __future__ import annotations

import math
import re
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from app.adapters.geospatial.local import haversine_km
from app.domain.models import DuplicateCandidate, Geography
from app.schemas.events import NormalizedRequest


TOKEN = re.compile(r"[\wÀ-ÿ]+", re.UNICODE)


def _tokens(value: str) -> set[str]:
    return {x.casefold() for x in TOKEN.findall(value) if len(x) > 2}


def text_similarity(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    jaccard = len(a & b) / len(a | b) if a | b else 0.0
    sequence = SequenceMatcher(None, left.casefold(), right.casefold()).ratio()
    return round(0.65 * jaccard + 0.35 * sequence, 6)


class DuplicateDetector:
    WEIGHTS = {"semantic": 0.50, "spatial": 0.25, "temporal": 0.15, "taxonomy": 0.10}

    def __init__(self, repository: Any, distance_km: float, time_window_days: int, high: float, review: float) -> None:
        self.repository = repository
        self.distance_km = distance_km
        self.time_window_days = time_window_days
        self.high = high
        self.review = review

    def find(self, request: NormalizedRequest, geography: Geography, occurred_at: datetime) -> list[DuplicateCandidate]:
        after = (occurred_at - timedelta(days=self.time_window_days)).isoformat().replace("+00:00", "Z")
        candidates = self.repository.list_candidate_members(request.country_code, request.category, after)
        result: list[DuplicateCandidate] = []
        for row in candidates:
            distance = haversine_km(geography.latitude, geography.longitude, row["centroid_lat"], row["centroid_lon"])
            if distance > self.distance_km:
                continue
            previous_at = datetime.fromisoformat(row["occurred_at"].replace("Z", "+00:00"))
            days = abs((occurred_at - previous_at).total_seconds()) / 86400
            semantic = 0.8 * text_similarity(request.summary, row["summary"]) + 0.2 * text_similarity(request.requested_outcome, row["requested_outcome"])
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
            ))
        return sorted(result, key=lambda x: (-x.final_similarity, x.candidate_request_id))

    @staticmethod
    def stored(candidate: DuplicateCandidate, request_id: str) -> dict[str, Any]:
        row = candidate.__dict__.copy()
        row["id"] = str(uuid5(NAMESPACE_URL, f"duplicate:{request_id}:{candidate.candidate_request_id}"))
        return row
