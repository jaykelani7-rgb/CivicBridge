from __future__ import annotations

import re
from typing import Any

from app.domain.models import CanonicalDocument, Geography
from app.schemas.events import NormalizedRequest

CANONICAL_TEXT_VERSION = "v1"
EMAIL = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
PHONE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
WHITESPACE = re.compile(r"\s+")
FIELD_ORDER = (
    "country",
    "administrative_area",
    "category",
    "subcategory",
    "summary",
    "problem_description",
    "requested_outcome",
)


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    normalized = WHITESPACE.sub(" ", str(value)).strip()
    return PHONE.sub("[redacted phone]", EMAIL.sub("[redacted email]", normalized))


def build_canonical_text(**fields: Any) -> str:
    """Build stable, PII-reduced text without identifiers or timestamps."""
    lines = []
    for name in FIELD_ORDER:
        value = _safe_text(fields.get(name))
        if value:
            lines.append(f"{name}: {value}")
    return "\n".join(lines)


def canonical_request(
    request: NormalizedRequest, geography: Geography
) -> CanonicalDocument:
    return CanonicalDocument(
        request_id=str(request.request_id),
        version=CANONICAL_TEXT_VERSION,
        text=build_canonical_text(
            country=request.country_code,
            administrative_area=geography.geography_id,
            category=request.category,
            subcategory=request.subcategory,
            summary=request.summary,
            problem_description=request.problem_description,
            requested_outcome=request.requested_outcome,
        ),
    )


def canonical_candidate(row: dict[str, Any]) -> CanonicalDocument:
    return CanonicalDocument(
        request_id=str(row["request_id"]),
        version=CANONICAL_TEXT_VERSION,
        text=build_canonical_text(
            country=row.get("country_code"),
            administrative_area=row.get("geography_id"),
            category=row.get("category"),
            subcategory=row.get("subcategory"),
            summary=row.get("summary"),
            problem_description=row.get("problem_description"),
            requested_outcome=row.get("requested_outcome"),
        ),
    )
