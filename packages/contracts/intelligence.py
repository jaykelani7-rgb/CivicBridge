from typing import Optional
from pydantic import BaseModel

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
