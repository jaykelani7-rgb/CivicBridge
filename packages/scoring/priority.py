import math
from typing import List, Dict, Any, Optional

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in meters.
    """
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # haversine formula 
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 # Radius of earth in meters.
    return c * r

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """
    Compute the cosine similarity between two embedding vectors.
    """
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)

def calculate_need_score(
    demand_rate: float,             # Normalized 0-100 (reports per 100k plus persistence)
    infrastructure_gap: float,      # Normalized 0-100 (distance from service-access target)
    severity: float,                # Normalized 0-100 (disruption level from sector rubric)
    equity_vulnerability: float,    # Normalized 0-100 (area-level socio-economic indicators)
    affected_population: float,     # Normalized 0-100 (capped log scale of population in service area)
    recent_trend: float,            # Normalized 0-100 (rate change from trailing baseline)
    evidence_confidence: float      # Normalized 0-100 (source diversity, confirmation levels)
) -> Dict[str, Any]:
    """
    Computes explainable NeedScore based on the blueprint formula:
    NeedScore = 0.25 * DemandRate + 0.20 * InfrastructureGap + 0.15 * Severity + 
                0.15 * EquityAndVulnerability + 0.10 * AffectedPopulation + 
                0.10 * RecentTrend + 0.05 * EvidenceConfidence
    """
    components = {
        "DemandRate": float(demand_rate),
        "InfrastructureGap": float(infrastructure_gap),
        "Severity": float(severity),
        "EquityAndVulnerability": float(equity_vulnerability),
        "AffectedPopulation": float(affected_population),
        "RecentTrend": float(recent_trend),
        "EvidenceConfidence": float(evidence_confidence)
    }
    
    score = (
        0.25 * components["DemandRate"] +
        0.20 * components["InfrastructureGap"] +
        0.15 * components["Severity"] +
        0.15 * components["EquityAndVulnerability"] +
        0.10 * components["AffectedPopulation"] +
        0.10 * components["RecentTrend"] +
        0.05 * components["EvidenceConfidence"]
    )
    
    # Bound score between 0.0 and 100.0
    score = max(0.0, min(100.0, score))
    
    return {
        "score": round(score, 2),
        "components": components,
        "formula": "0.25 * DemandRate + 0.20 * InfrastructureGap + 0.15 * Severity + 0.15 * EquityAndVulnerability + 0.10 * AffectedPopulation + 0.10 * RecentTrend + 0.05 * EvidenceConfidence"
    }

def calculate_action_score(
    need_score: float,              # Calculated NeedScore (0-100)
    strategic_alignment: float,     # Normalized 0-100 (alignment to active priorities/plans)
    delivery_readiness: float,      # Normalized 0-100 (land/budget availability/complexity)
    data_confidence: float,         # Normalized 0-100 (source validation completeness)
    existing_coverage_penalty: float # Deducted directly (e.g. overlap with recently funded project)
) -> Dict[str, Any]:
    """
    Computes explainable ActionScore based on the blueprint formula:
    ActionScore = 0.60 * NeedScore + 0.20 * StrategicAlignment + 0.10 * DeliveryReadiness + 
                  0.10 * DataConfidence - ExistingCoveragePenalty
    """
    components = {
        "NeedScore": float(need_score),
        "StrategicAlignment": float(strategic_alignment),
        "DeliveryReadiness": float(delivery_readiness),
        "DataConfidence": float(data_confidence),
        "ExistingCoveragePenalty": float(existing_coverage_penalty)
    }
    
    score = (
        0.60 * components["NeedScore"] +
        0.20 * components["StrategicAlignment"] +
        0.10 * components["DeliveryReadiness"] +
        0.10 * components["DataConfidence"] -
        components["ExistingCoveragePenalty"]
    )
    
    # Bound score between 0.0 and 100.0
    score = max(0.0, min(100.0, score))
    
    return {
        "score": round(score, 2),
        "components": components,
        "formula": "0.60 * NeedScore + 0.20 * StrategicAlignment + 0.10 * DeliveryReadiness + 0.10 * DataConfidence - ExistingCoveragePenalty"
    }

def check_duplicate_candidate(
    req1: Dict[str, Any], 
    req2: Dict[str, Any], 
    similarity_threshold: float = 0.82,
    time_window_days: int = 30,
    distance_threshold_m: float = 500.0
) -> Dict[str, Any]:
    """
    Two-stage rule duplicate detection checker.
    Returns details on whether two requests are duplicate candidates.
    """
    # Stage 1: Cheap filters (Country, Category/Sector, Time Window, Basic Location overlap)
    if req1.get("tenant_country") != req2.get("tenant_country"):
        return {"is_duplicate": False, "reason": "different_countries"}
        
    if req1.get("category") != req2.get("category"):
        # Allow compatible sectors if defined, but default to strict category check
        return {"is_duplicate": False, "reason": "different_categories"}
        
    # Time delta check
    created_at1 = req1.get("created_at") # Datetime objects
    created_at2 = req2.get("created_at")
    if created_at1 and created_at2:
        time_diff = abs((created_at1 - created_at2).total_seconds()) / 86400.0
        if time_diff > time_window_days:
            return {"is_duplicate": False, "reason": "outside_time_window", "value": time_diff}
    else:
        time_diff = 0.0

    # Distance check
    loc1 = req1.get("location") # dict with "lat", "lon"
    loc2 = req2.get("location")
    if loc1 and loc2 and loc1.get("lat") is not None and loc2.get("lat") is not None:
        dist = haversine_distance(loc1["lat"], loc1["lon"], loc2["lat"], loc2["lon"])
        if dist > distance_threshold_m:
            return {"is_duplicate": False, "reason": "outside_distance_threshold", "value": dist}
    else:
        # If coordinates are missing but administrative areas match, continue to semantic checks
        if req1.get("admin_id") != req2.get("admin_id"):
            return {"is_duplicate": False, "reason": "different_admin_areas"}
        dist = None

    # Stage 2: Semantic similarity (via embeddings)
    emb1 = req1.get("embedding")
    emb2 = req2.get("embedding")
    if emb1 and emb2:
        sim = cosine_similarity(emb1, emb2)
        if sim < similarity_threshold:
            return {"is_duplicate": False, "reason": "low_semantic_similarity", "value": sim}
    else:
        # Fallback to text similarity or assume not a duplicate if embeddings missing
        sim = 0.0
        return {"is_duplicate": False, "reason": "missing_embeddings"}

    return {
        "is_duplicate": True, 
        "reason": "duplicate_criteria_met",
        "details": {
            "time_diff_days": round(time_diff, 2),
            "distance_meters": round(dist, 1) if dist is not None else None,
            "semantic_similarity": round(sim, 3)
        }
    }
