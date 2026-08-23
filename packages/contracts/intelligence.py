from typing import Literal, Optional
from pydantic import BaseModel


class RankingScope(BaseModel):
    country_code: str
    category: Optional[str] = None


class PriorityMetadata(BaseModel):
    rank: Optional[int] = None
    total_ranked: int
    band: Literal["critical", "high", "medium", "low", "insufficient_evidence"]
    band_reason_code: str
    ranking_scope: RankingScope
    ranked_at: str
    methodology_version: str


class EvidenceReadiness(BaseModel):
    state: Literal["ready_for_human_review", "review_with_caution", "insufficient_evidence"]
    reason_codes: list[str]
    assessed_at: str
    ruleset_version: str

class HotspotSnapshotData(BaseModel):
    hotspot_id: str
    country_code: str
    geography_id: str
    category: str
    request_count: int
    unique_request_count: int
    affected_population: int
    trend_30d: float
    need_score: float
    action_score: float
    evidence_confidence: float
    score_version: str = "priority-1.0.0"
    evidence_bundle_id: str
    calculated_at: str
