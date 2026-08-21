"""
Deterministic validators for Gemini's structured extraction output.

Per contract.md Section 3 (Shreyank's ownership): "Field validation, confidence
values, and human-review flags" and Section 6 failure rules ("Gemini returns
invalid JSON -> retry once under same schema, then human review"). This module
is the guardrail that runs AFTER the model call and decides whether a record
is safe to publish as request.normalized.v1 or must be routed to
request.needs_review.v1 for an analyst.

Nothing here calls an external API -- it is pure, deterministic Python so the
routing decision is auditable and reproducible, matching the "transparent
scoring engine, not a black box" principle used for the priority score.
"""
from typing import Any, Dict, List, Optional, Tuple

from packages.country_packs import COUNTRY_PACKS

ALLOWED_URGENCY = {"low", "medium", "high", "critical"}
ALLOWED_AFFECTED_SCOPE = {"individual", "household", "street", "community", "unknown"}
ALLOWED_EVIDENCE_TYPES = {"voice", "text", "photo", "repeat_report", "service_outage"}

PROMPT_INJECTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "ignore the above",
    "disregard previous",
    "you are now",
    "system:",
    "###system",
    "act as",
    "new instructions:",
    "override your instructions",
)


def _default_country_pack(country_code: str) -> Dict[str, Any]:
    return COUNTRY_PACKS.get(country_code, COUNTRY_PACKS["IN"])


_REASON_PRIORITY = ("possible_prompt_injection_attempt", "critical_urgency_requires_review", "pii_detected")


def build_review_reason(reasons: List[str]) -> Optional[str]:
    """
    Turns a list of internal reason codes into the short, controlled explanation
    the schema's review_reason field expects, surfacing the most
    safety/security-relevant reason first regardless of check order.
    """
    if not reasons:
        return None
    ordered = sorted(reasons, key=lambda r: next((i for i, p in enumerate(_REASON_PRIORITY) if r.startswith(p)), len(_REASON_PRIORITY)))
    return ordered[0] if len(ordered) == 1 else f"{ordered[0]} (+{len(ordered) - 1} more)"


def detect_prompt_injection(original_text: str) -> bool:
    if not original_text:
        return False
    lowered = original_text.lower()
    return any(marker in lowered for marker in PROMPT_INJECTION_MARKERS)


def validate_and_normalize(
    extraction: Dict[str, Any],
    country_code: str,
    original_text: str,
    confidence_review_threshold: float,
) -> Tuple[Dict[str, Any], bool, List[str]]:
    """
    Validates and coerces a raw extraction dict into schema-safe values.

    Returns (cleaned_fields, needs_human_review, review_reasons).
    Never raises -- unrecoverable/ambiguous fields degrade to safe defaults
    and are flagged for review instead of failing the whole request.
    """
    reasons: List[str] = []
    cleaned = dict(extraction)
    country_pack = _default_country_pack(country_code)
    taxonomy = country_pack["taxonomy"]
    allowed_categories = set(taxonomy["categories"])
    subcategory_map = taxonomy.get("subcategories", {})

    # --- category / subcategory enum validation ---
    category = cleaned.get("category")
    if category not in allowed_categories:
        reasons.append(f"category_out_of_taxonomy:{category}")
        category = "other"
    cleaned["category"] = category

    allowed_subcategories = set(subcategory_map.get(category, []))
    subcategory = cleaned.get("subcategory")
    if allowed_subcategories and subcategory not in allowed_subcategories:
        reasons.append(f"subcategory_not_in_taxonomy:{subcategory}")
    cleaned["subcategory"] = subcategory or "miscellaneous"

    # --- urgency ---
    urgency = cleaned.get("urgency")
    if urgency not in ALLOWED_URGENCY:
        reasons.append(f"urgency_invalid:{urgency}")
        urgency = "medium"
    cleaned["urgency"] = urgency
    # contract.md Section 5: "Low-confidence, ambiguous-location, high-urgency, or
    # policy-sensitive cases enter an analyst review queue" -- high AND critical both
    # route to review, not only critical.
    if urgency in ("high", "critical"):
        reasons.append(f"{urgency}_urgency_requires_review")

    # --- affected_scope ---
    affected_scope = cleaned.get("affected_scope")
    if affected_scope not in ALLOWED_AFFECTED_SCOPE:
        reasons.append(f"affected_scope_invalid:{affected_scope}")
        affected_scope = "unknown"
    cleaned["affected_scope"] = affected_scope

    # --- evidence_types ---
    evidence_types = [e for e in (cleaned.get("evidence_types") or []) if e in ALLOWED_EVIDENCE_TYPES]
    cleaned["evidence_types"] = evidence_types or ["text"]

    # --- location ambiguity ---
    location_mentions = cleaned.get("location_mentions") or []
    cleaned["location_mentions"] = location_mentions
    if not location_mentions and affected_scope == "unknown":
        reasons.append("ambiguous_location")

    # --- confidence ---
    try:
        confidence = float(cleaned.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
        reasons.append("confidence_unparseable")
    confidence = max(0.0, min(1.0, confidence))
    cleaned["confidence"] = confidence
    if confidence < confidence_review_threshold:
        reasons.append(f"low_confidence:{confidence:.2f}<{confidence_review_threshold:.2f}")

    # --- prompt-injection style content (defense in depth; Gemini system
    # instructions already tell the model to treat citizen text as untrusted
    # data, this is the deterministic second check) ---
    if detect_prompt_injection(original_text):
        reasons.append("possible_prompt_injection_attempt")

    # needs_human_review is the union of the model's own flag and every
    # deterministic trigger found above.
    needs_review = bool(cleaned.get("needs_human_review")) or bool(reasons)

    review_reason = build_review_reason(reasons) if reasons else cleaned.get("review_reason")

    cleaned["needs_human_review"] = needs_review
    cleaned["review_reason"] = review_reason

    return cleaned, needs_review, reasons
