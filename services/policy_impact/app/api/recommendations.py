from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from packages.contracts import (
    Recommendation,
    RecommendationCreateRequest,
    StandardErrorResponse,
)
from services.policy_impact.app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/v1/recommendations", tags=["Recommendations"])
service = RecommendationService()


@router.post(
    "",
    response_model=Recommendation,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": StandardErrorResponse, "description": "Validation or Grounding Error"},
        404: {"model": StandardErrorResponse, "description": "Evidence Bundle Not Found"},
    },
)
def create_recommendation(req: RecommendationCreateRequest):
    try:
        return service.create_recommendation(req)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "RECOMMENDATION_GROUNDING_FAILED", "message": str(e), "retryable": True}},
        )


@router.get("", response_model=List[Recommendation])
def list_recommendations(
    hotspot_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    return service.list_recommendations(hotspot_id=hotspot_id, status=status_filter)


@router.get("/{recommendation_id}", response_model=Recommendation)
def get_recommendation(recommendation_id: str):
    rec = service.get_recommendation(recommendation_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECOMMENDATION_NOT_FOUND", "message": f"Recommendation {recommendation_id} not found."}},
        )
    return rec
