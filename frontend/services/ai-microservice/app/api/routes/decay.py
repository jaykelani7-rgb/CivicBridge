from fastapi import APIRouter

from app.models.decay import DecayRecalculationRequest, DecayRecalculationResponse
from app.services.decay_service import recalculate_heat_scores

router = APIRouter()


@router.post("/recalculate", response_model=DecayRecalculationResponse)
async def recalculate_decay_scores(
    payload: DecayRecalculationRequest,
) -> DecayRecalculationResponse:
    return recalculate_heat_scores(payload)
