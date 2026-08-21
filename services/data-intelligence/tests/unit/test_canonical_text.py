from app.domain.models import Geography
from app.schemas.events import NormalizedRequest
from app.services.canonical_text import build_canonical_text, canonical_request
from tests.conftest import event_payload


def test_canonical_text_has_stable_order_and_omits_missing_fields():
    text = build_canonical_text(
        requested_outcome="  Repair   it ",
        country="IN",
        category="water",
        summary=" Pump broken ",
        subcategory=None,
    )
    assert text.splitlines() == [
        "country: IN",
        "category: water",
        "summary: Pump broken",
        "requested_outcome: Repair it",
    ]


def test_canonical_text_preserves_multilingual_content_and_is_deterministic():
    fields = {
        "country": "BR",
        "category": "waste",
        "summary": "Água बंद है",
        "problem_description": "Sem água",
    }
    assert build_canonical_text(**fields) == build_canonical_text(**fields)
    assert "Água बंद है" in build_canonical_text(**fields)


def test_canonical_text_redacts_contacts_and_excludes_unapproved_fields():
    text = build_canonical_text(
        country="IN",
        category="water",
        summary="Call +91 98765 43210 or me@example.com",
        citizen_name="Private Name",
        authentication_id="secret",
        exact_address="Private home",
    )
    assert "98765" not in text and "me@example.com" not in text
    assert (
        "Private Name" not in text
        and "secret" not in text
        and "Private home" not in text
    )


def test_normalized_request_canonical_form_uses_approved_contract_fields():
    request = NormalizedRequest.model_validate(event_payload("IN")["data"])
    geography = Geography(
        "IN-RJ-JPR-W42",
        "IN",
        "Rajasthan",
        "Jaipur",
        "Ward 42",
        "cell",
        0,
        0,
        0.9,
        "src",
        "v",
    )
    document = canonical_request(request, geography)
    assert document.version == "v1"
    assert "administrative_area: IN-RJ-JPR-W42" in document.text
    assert str(request.request_id) not in document.text
