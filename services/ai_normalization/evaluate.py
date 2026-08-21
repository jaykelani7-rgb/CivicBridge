"""
Runs the AI Normalization pipeline (extraction + deterministic validators +
PII scan) against the gold evaluation set in fixtures/normalization_eval_set.json
and reports the metrics contract.md Section 10 asks for:

  - Category extraction macro-F1               (target >= 0.85)
  - Urgency weighted F1                          (target >= 0.80)
  - Required-JSON-fields schema-valid rate       (target >= 99%)
  - needs_human_review precision/recall           (routing correctness)
  - PII flag detection precision/recall per type

IMPORTANT: with USE_MOCK_SERVICES=true (the default, and the only mode this
sandbox can run without Google Cloud credentials) this evaluates the
deterministic keyword-rule mock extractor, NOT Gemini. It exists so the
pipeline's wiring, schema validation, and review-routing logic are provably
correct end-to-end, and so the team has a ready-made harness to re-run against
real Vertex AI Gemini output before submission (set USE_MOCK_SERVICES=false
and GCP_PROJECT_ID, then re-run this script unchanged).

Usage:
    PYTHONPATH=. python services/ai_normalization/evaluate.py
"""
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packages.contracts.normalization import NormalizedRequestData  # noqa: E402

from services.ai_normalization.config import settings  # noqa: E402
from services.ai_normalization.pipeline.extraction import GeminiExtractionAdapter  # noqa: E402
from services.ai_normalization.pipeline.pii import merge_pii_flags, scan_and_mask  # noqa: E402
from services.ai_normalization.pipeline.validators import validate_and_normalize  # noqa: E402

FIXTURES_PATH = Path(__file__).resolve().parent / "fixtures" / "normalization_eval_set.json"
REPORT_PATH = ROOT / "docs" / "eval" / "ai_normalization_metrics.json"


def prf1(labels: Sequence[str], preds: Sequence[str], classes: Sequence[str]) -> Dict[str, Dict[str, float]]:
    per_class = {}
    for c in classes:
        tp = sum(1 for l, p in zip(labels, preds) if l == c and p == c)
        fp = sum(1 for l, p in zip(labels, preds) if l != c and p == c)
        fn = sum(1 for l, p in zip(labels, preds) if l == c and p != c)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_class[c] = {"precision": precision, "recall": recall, "f1": f1, "support": labels.count(c) if isinstance(labels, list) else sum(1 for l in labels if l == c)}
    return per_class


def macro_f1(per_class: Dict[str, Dict[str, float]]) -> float:
    present = [v for v in per_class.values() if v["support"] > 0]
    if not present:
        return 0.0
    return sum(v["f1"] for v in present) / len(present)


def weighted_f1(per_class: Dict[str, Dict[str, float]]) -> float:
    total_support = sum(v["support"] for v in per_class.values())
    if not total_support:
        return 0.0
    return sum(v["f1"] * v["support"] for v in per_class.values()) / total_support


def binary_prf1(labels: Sequence[bool], preds: Sequence[bool]) -> Dict[str, float]:
    tp = sum(1 for l, p in zip(labels, preds) if l and p)
    fp = sum(1 for l, p in zip(labels, preds) if (not l) and p)
    fn = sum(1 for l, p in zip(labels, preds) if l and (not p))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}


def flag_set_prf1(expected: List[List[str]], predicted: List[List[str]], flag_types: Sequence[str]) -> Dict[str, Dict[str, float]]:
    result = {}
    for flag in flag_types:
        exp_bool = [flag in e for e in expected]
        pred_bool = [flag in p for p in predicted]
        result[flag] = binary_prf1(exp_bool, pred_bool)
    return result


def run_evaluation() -> Dict:
    data = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    items = data["items"]

    extractor = GeminiExtractionAdapter(settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION, settings.GEMINI_MODEL_NAME)

    category_labels, category_preds = [], []
    urgency_labels, urgency_preds = [], []
    review_labels, review_preds = [], []
    pii_expected, pii_predicted = [], []
    schema_valid_count = 0
    rows = []

    for item in items:
        raw, extraction_status = extractor.extract(item["working_text"], item["country_code"])
        cleaned, needs_review, reasons = validate_and_normalize(
            raw,
            country_code=item["country_code"],
            original_text=item["original_text"],
            confidence_review_threshold=settings.CONFIDENCE_REVIEW_THRESHOLD,
        )
        masked_original, orig_pii = scan_and_mask(item["original_text"])
        masked_working, work_pii = scan_and_mask(item["working_text"])
        pii_flags = merge_pii_flags(cleaned.get("pii_flags", []), list(orig_pii), list(work_pii))
        if pii_flags != ["none"]:
            needs_review = True

        try:
            NormalizedRequestData(
                request_id=item["id"],
                country_code=item["country_code"],
                original_language=item["language_code"],
                transcript_original=masked_original,
                translation_working=masked_working,
                category=cleaned["category"],
                subcategory=cleaned["subcategory"],
                summary=cleaned["summary"],
                problem_description=cleaned["problem_description"],
                requested_outcome=cleaned["requested_outcome"],
                urgency=cleaned["urgency"],
                affected_scope=cleaned["affected_scope"],
                location_mentions=cleaned["location_mentions"],
                evidence_types=cleaned["evidence_types"],
                confidence=cleaned["confidence"],
                pii_flags=pii_flags,
                needs_human_review=needs_review,
                review_reason=cleaned.get("review_reason"),
                model="mock-rule-engine" if settings.USE_MOCK_SERVICES else settings.GEMINI_MODEL_NAME,
                prompt_version=settings.PROMPT_VERSION,
                schema_version=settings.SCHEMA_VERSION,
            )
            schema_valid_count += 1
            schema_ok = True
        except Exception as exc:  # noqa: BLE001
            schema_ok = False
            print(f"[SCHEMA INVALID] {item['id']}: {exc}")

        category_labels.append(item["expected_category"])
        category_preds.append(cleaned["category"])
        urgency_labels.append(item["expected_urgency"])
        urgency_preds.append(cleaned["urgency"])
        review_labels.append(item["expected_needs_review"])
        review_preds.append(needs_review)
        pii_expected.append(item["expected_pii_flags"])
        pii_predicted.append(pii_flags)

        rows.append(
            {
                "id": item["id"],
                "tags": item["tags"],
                "category": {"expected": item["expected_category"], "predicted": cleaned["category"], "match": item["expected_category"] == cleaned["category"]},
                "urgency": {"expected": item["expected_urgency"], "predicted": cleaned["urgency"], "match": item["expected_urgency"] == cleaned["urgency"]},
                "needs_human_review": {"expected": item["expected_needs_review"], "predicted": needs_review, "match": item["expected_needs_review"] == needs_review},
                "pii_flags": {"expected": item["expected_pii_flags"], "predicted": pii_flags},
                "schema_valid": schema_ok,
                "extraction_status": extraction_status,
            }
        )

    category_classes = sorted(set(category_labels) | set(category_preds))
    urgency_classes = sorted(set(urgency_labels) | set(urgency_preds))

    category_per_class = prf1(category_labels, category_preds, category_classes)
    urgency_per_class = prf1(urgency_labels, urgency_preds, urgency_classes)

    report = {
        "fixture_count": len(items),
        "is_mock_run": settings.USE_MOCK_SERVICES,
        "note": (
            "USE_MOCK_SERVICES=true: these metrics describe the deterministic mock "
            "rule engine, used to prove the pipeline/schema/routing logic is correct. "
            "Re-run with USE_MOCK_SERVICES=false and GCP_PROJECT_ID set against real "
            "Vertex AI Gemini before relying on these numbers for the submission."
        ) if settings.USE_MOCK_SERVICES else "Live Vertex AI Gemini evaluation run.",
        "category_extraction": {
            "macro_f1": macro_f1(category_per_class),
            "target": 0.85,
            "per_class": category_per_class,
        },
        "urgency": {
            "weighted_f1": weighted_f1(urgency_per_class),
            "target": 0.80,
            "per_class": urgency_per_class,
        },
        "schema_valid_rate": schema_valid_count / len(items),
        "schema_valid_target": 0.99,
        "needs_human_review_routing": binary_prf1(review_labels, review_preds),
        "pii_detection": flag_set_prf1(pii_expected, pii_predicted, ["phone", "email", "person_name", "exact_home"]),
        "rows": rows,
    }
    return report


def print_summary(report: Dict) -> None:
    print(f"\nAI Normalization evaluation -- {report['fixture_count']} fixtures ({'MOCK' if report['is_mock_run'] else 'LIVE GEMINI'})")
    print(f"  {report['note']}\n")
    print(f"  Category macro-F1:        {report['category_extraction']['macro_f1']:.3f}  (target >= {report['category_extraction']['target']})")
    print(f"  Urgency weighted-F1:      {report['urgency']['weighted_f1']:.3f}  (target >= {report['urgency']['target']})")
    print(f"  Schema-valid rate:        {report['schema_valid_rate']:.3f}  (target >= {report['schema_valid_target']})")
    rr = report["needs_human_review_routing"]
    print(f"  needs_human_review P/R/F1: {rr['precision']:.2f} / {rr['recall']:.2f} / {rr['f1']:.2f}")
    print("  PII detection (precision/recall/f1):")
    for flag, m in report["pii_detection"].items():
        print(f"    {flag:<12} {m['precision']:.2f} / {m['recall']:.2f} / {m['f1']:.2f}")

    mismatches = [r for r in report["rows"] if not r["category"]["match"] or not r["urgency"]["match"] or not r["needs_human_review"]["match"]]
    if mismatches:
        print(f"\n  {len(mismatches)} item(s) with at least one mismatch:")
        for r in mismatches:
            print(f"    {r['id']}: category {r['category']['expected']}->{r['category']['predicted']}, "
                  f"urgency {r['urgency']['expected']}->{r['urgency']['predicted']}, "
                  f"review {r['needs_human_review']['expected']}->{r['needs_human_review']['predicted']}")


if __name__ == "__main__":
    report = run_evaluation()
    print_summary(report)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nFull report written to {REPORT_PATH.relative_to(ROOT)}")
