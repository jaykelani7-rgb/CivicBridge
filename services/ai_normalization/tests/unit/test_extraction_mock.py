import json
from pathlib import Path

import pytest

from services.ai_normalization.pipeline.extraction import GeminiExtractionAdapter

FIXTURES_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "normalization_eval_set.json"


@pytest.fixture(scope="module")
def fixtures():
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))["items"]


@pytest.fixture(scope="module")
def extractor():
    return GeminiExtractionAdapter(use_mock=True)


def test_mock_extractor_meets_category_macro_f1_target(extractor, fixtures):
    """
    Smoke-level regression guard for the metric evaluate.py reports in detail:
    category macro-F1 must clear contract.md Section 10's >= 0.85 target.
    """
    correct = 0
    for item in fixtures:
        raw, _ = extractor.extract(item["working_text"], item["country_code"])
        if raw["category"] == item["expected_category"]:
            correct += 1
    accuracy = correct / len(fixtures)
    assert accuracy >= 0.85, f"mock extractor category accuracy dropped to {accuracy:.2f}"


def test_mock_extractor_schema_valid_output(extractor):
    raw, status = extractor.extract("There is no clean drinking water in our village, please help.", "IN")
    assert status == "mock"
    assert raw["category"] == "water"
    assert 0.0 <= raw["confidence"] <= 1.0
    assert isinstance(raw["needs_human_review"], bool)


def test_subcategory_is_localized_per_country():
    extractor = GeminiExtractionAdapter(use_mock=True)
    text = "There has been no electricity for three days, the transformer is faulty."
    raw_in, _ = extractor.extract(text, "IN")
    raw_br, _ = extractor.extract("Falta energia ha tres dias.", "BR")
    assert raw_in["subcategory"] in {"power_cut"}
    # BR's country pack spells this subcategory in Portuguese -- never the English literal.
    assert raw_br["subcategory"] != raw_in["subcategory"] or raw_br["category"] != "electricity"


def test_ambiguous_text_falls_back_to_other_with_low_confidence():
    extractor = GeminiExtractionAdapter(use_mock=True)
    raw, _ = extractor.extract("Things have not been good around here lately.", "IN")
    assert raw["category"] == "other"
    assert raw["confidence"] < 0.6
    assert raw["needs_human_review"] is True
