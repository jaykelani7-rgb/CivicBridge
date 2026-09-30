"""Idempotent, clearly synthetic policy-review baseline for ephemeral demo storage."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from packages.contracts import Recommendation, RecommendationStatus
from services.policy_impact.app.database import PolicyImpactRepository

logger = logging.getLogger("policy-impact.demo-baseline")
FIXTURE_NAMES = (
    "india_jaipur_fixtures.json",
    "brazil_rio_fixtures.json",
    "south_africa_capetown_fixtures.json",
)
BASELINE_TIMESTAMP = "2026-08-22T00:00:00+00:00"
SYNTHETIC_LIMITATION = "Synthetic demo baseline; live evidence and feasibility require human verification."


def restore_demo_recommendations(
    repository: PolicyImpactRepository,
    fixture_dir: Path | None = None,
) -> int:
    """Restore only under-review recommendations; never decisions, projects, or metrics."""
    root = Path(__file__).resolve().parents[3]
    directory = fixture_dir or root / "packages" / "test_fixtures"
    restored = 0
    for name in FIXTURE_NAMES:
        payload = json.loads((directory / name).read_text(encoding="utf-8"))
        seed = dict(payload["recommendation_seed"])
        recommendation_id = seed["recommendation_id"]
        if repository.get_recommendation(recommendation_id):
            continue
        limitations = list(seed.get("missing_information", []))
        if SYNTHETIC_LIMITATION not in limitations:
            limitations.append(SYNTHETIC_LIMITATION)
        repository.save_recommendation(Recommendation(**{
            **seed,
            "status": RecommendationStatus.UNDER_REVIEW,
            "human_approved": False,
            "missing_information": limitations,
            "created_at": BASELINE_TIMESTAMP,
            "updated_at": BASELINE_TIMESTAMP,
        }))
        restored += 1
    logger.info("Synthetic under-review baseline ready: restored=%s total=%s", restored, len(FIXTURE_NAMES))
    return restored
