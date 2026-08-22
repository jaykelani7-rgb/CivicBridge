from app.core.config import get_settings
from app.models.decay import (
    DecayNeedUpdate,
    DecayRecalculationRequest,
    DecayRecalculationResponse,
)


def recalculate_heat_scores(
    payload: DecayRecalculationRequest,
) -> DecayRecalculationResponse:
    settings = get_settings()
    updates = [
        DecayNeedUpdate(
            need_id="need-1",
            previous_heat_score=98,
            recalculated_heat_score=95,
            decay_state="fresh",
            severity_weight=1.4,
            elapsed_minutes=15,
        ),
        DecayNeedUpdate(
            need_id="need-2",
            previous_heat_score=74,
            recalculated_heat_score=67,
            decay_state="warming",
            severity_weight=1.1,
            elapsed_minutes=42,
        ),
    ]

    if payload.open_need_ids:
        updates = [update for update in updates if update.need_id in payload.open_need_ids]

    return DecayRecalculationResponse(
        processed_count=len(updates),
        interval_minutes=settings.decay_interval_minutes,
        updates=updates,
    )
