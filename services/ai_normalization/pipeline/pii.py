"""
Deterministic PII detection and masking.

This is intentionally NOT an AI call. Per contract.md Section 12 ("Privacy and
security rules") and the hackathon blueprint's scope rule ("do not build a
custom predictive model merely to say ML"), PII flagging is a transparent,
regex-based guardrail that runs on both the original transcript and the
working-language translation before either is persisted or published on the
event bus.
"""
import re
from typing import List, Set, Tuple

# A "phone-like" run: starts and ends with a digit, with only digits/space/dot/dash/paren
# in between, and at least 7 actual digit characters overall -- so we don't flag a ward
# or house number ("Ward 42", "house no. 42B") as a phone number.
_DIGIT_RUN_RE = re.compile(r"\+?\(?\d[\d\s().-]{4,}\d")

EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

NAME_HINT_RE = re.compile(
    r"\b(my name is|i am mr\.?|i am mrs\.?|i am ms\.?|mr\.|mrs\.|ms\.|dr\.)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)",
    re.IGNORECASE,
)

HOME_HINT_RE = re.compile(
    r"\b(house no\.?|h\.?no\.?|door no\.?|flat no\.?|plot no\.?)\s*[:#-]?\s*\d+[a-zA-Z0-9/-]*",
    re.IGNORECASE,
)

ALLOWED_PII_FLAGS = {"phone", "email", "person_name", "exact_home", "none"}


def scan_and_mask(text: str) -> Tuple[str, Set[str]]:
    """
    Scans `text` for PII, replaces matches with redaction tokens, and returns
    (masked_text, flags). Never invents or removes non-PII content.
    """
    if not text:
        return text, set()

    flags: Set[str] = set()
    masked = text

    if EMAIL_RE.search(masked):
        flags.add("email")
        masked = EMAIL_RE.sub("[REDACTED_EMAIL]", masked)

    for match in list(_DIGIT_RUN_RE.finditer(masked)):
        digit_count = sum(1 for ch in match.group() if ch.isdigit())
        if digit_count >= 7:
            flags.add("phone")
    if "phone" in flags:
        def _mask_if_phone(m: "re.Match") -> str:
            return "[REDACTED_PHONE]" if sum(1 for ch in m.group() if ch.isdigit()) >= 7 else m.group()

        masked = _DIGIT_RUN_RE.sub(_mask_if_phone, masked)

    if NAME_HINT_RE.search(masked):
        flags.add("person_name")
        masked = NAME_HINT_RE.sub(lambda m: f"{m.group(1)} [REDACTED_NAME]", masked)

    if HOME_HINT_RE.search(masked):
        flags.add("exact_home")
        masked = HOME_HINT_RE.sub("[REDACTED_HOME_REF]", masked)

    return masked, flags


def merge_pii_flags(*flag_sets: List[str]) -> List[str]:
    """Combine PII flag lists from multiple sources into a clean, sorted list."""
    combined: Set[str] = set()
    for flags in flag_sets:
        for f in flags or []:
            if f in ALLOWED_PII_FLAGS:
                combined.add(f)
    combined.discard("none")
    if not combined:
        return ["none"]
    return sorted(combined)
