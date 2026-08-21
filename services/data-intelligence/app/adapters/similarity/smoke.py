from __future__ import annotations

import json
from pathlib import Path

from app.adapters.similarity.factory import build_similarity_service
from app.config.settings import Settings
from app.domain.models import CanonicalDocument
from app.repositories.sqlite import SQLiteRepository
from app.services.canonical_text import build_canonical_text

REPORTS = {
    "A": (
        "water",
        "A village water pump has stopped working and residents have no reliable drinking-water supply.",
    ),
    "B": (
        "water",
        "The community borewell is broken, leaving local households without access to drinking water.",
    ),
    "C": (
        "roads",
        "A major road contains deep potholes and requires urgent surface repairs.",
    ),
}


def _document(identifier: str) -> CanonicalDocument:
    category, summary = REPORTS[identifier]
    return CanonicalDocument(
        request_id=identifier,
        text=build_canonical_text(
            country="IN",
            administrative_area="IN-DEMO-AREA",
            category=category,
            summary=summary,
        ),
    )


def run() -> dict:
    settings = Settings.from_env()
    service_dir = Path(__file__).resolve().parents[3]
    repository = SQLiteRepository(":memory:", service_dir / "migrations")
    try:
        service = build_similarity_service(settings, repository)
        result = service.compare_many(
            _document("A"),
            [_document("B"), _document("C")],
            log_context={"request_id": "smoke"},
        )
        water = result.measurements["B"].score
        road = result.measurements["C"].score
        passed = water > road
        return {
            "provider": result.provider,
            "model": result.model,
            "embedding_dimension": result.dimension,
            "similarity_water_reports": water,
            "similarity_water_vs_road": road,
            "assertion_passed": passed,
            "degraded": result.degraded,
        }
    finally:
        repository.close()


def main() -> None:
    result = run()
    print(json.dumps(result, sort_keys=True))
    if not result["assertion_passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
