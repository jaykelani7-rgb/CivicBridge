import logging
import re
from typing import List, Tuple

logger = logging.getLogger("evidence-validator")


class EvidenceValidationResult:
    def __init__(self, is_valid: bool, invalid_ids: List[str], message: str):
        self.is_valid = is_valid
        self.invalid_ids = invalid_ids
        self.message = message


class EvidenceValidator:
    """
    Validates that every claim citation in a recommendation draft
    corresponds to a valid, verified source ID from the upstream evidence bundle.
    """

    @staticmethod
    def validate_citations(
        supporting_evidence_ids: List[str],
        valid_bundle_evidence_ids: List[str],
    ) -> EvidenceValidationResult:
        if not supporting_evidence_ids:
            return EvidenceValidationResult(
                is_valid=False,
                invalid_ids=[],
                message="Recommendation draft must cite at least one supporting evidence ID.",
            )

        invalid_ids = [
            eid for eid in supporting_evidence_ids if eid not in valid_bundle_evidence_ids
        ]

        if invalid_ids:
            logger.warning(
                f"[EvidenceValidator] Rejected draft. Invalid citations: {invalid_ids}"
            )
            return EvidenceValidationResult(
                is_valid=False,
                invalid_ids=invalid_ids,
                message=f"Recommendation cites unsupported or unverified evidence IDs: {invalid_ids}",
            )

        return EvidenceValidationResult(
            is_valid=True,
            invalid_ids=[],
            message="Citation IDs belong to the evidence bundle; factual claims still require review.",
        )

    @staticmethod
    def require_supported_numbers(draft: dict, bundle: dict) -> list[dict]:
        """Reject untraceable quantities and return source-field traces for copied values."""
        source_values: dict[float, list[tuple[str, str]]] = {}

        def collect(value, path: str, source_id: str):
            if isinstance(value, bool):
                return
            if isinstance(value, (int, float)):
                source_values.setdefault(float(value), []).append((path, source_id))
            elif isinstance(value, dict):
                current_id = str(value.get("source_id") or source_id)
                for name, nested in value.items():
                    if name not in {"reference_year", "dataset_version", "bundle_version"}:
                        collect(nested, f"{path}.{name}", current_id)
            elif isinstance(value, list):
                for index, nested in enumerate(value):
                    collect(nested, f"{path}[{index}]", source_id)

        for key in ("demographic_indicators", "demographic_features", "infrastructure_gap", "infrastructure_gap_records", "investment_plan_records", "hotspot_snapshot", "score_components", "score_explanation"):
            collect(bundle.get(key), key, str(bundle.get("evidence_bundle_id") or "evidence_bundle"))
        traces: list[dict] = []

        def require(value: float, claim_field: str):
            matches = source_values.get(float(value), [])
            if not matches:
                raise ValueError(f"Unsupported numerical claim in {claim_field}: {value:g}")
            source_field, source_id = matches[0]
            traces.append({"claim_field": claim_field, "value": value, "source_field": source_field, "source_id": source_id, "calculation": "copied from source field"})

        beneficiaries = draft.get("intended_beneficiaries")
        if beneficiaries is not None:
            require(float(beneficiaries), "intended_beneficiaries")
        for field in ("problem", "proposed_intervention"):
            claim = re.sub(r"\b(?:ward|district|zone|block|sector)\s+\d+\b", "", str(draft.get(field) or ""), flags=re.IGNORECASE)
            for raw in re.findall(r"(?<![\w])\d[\d,]*(?:\.\d+)?(?![\w])", claim):
                require(float(raw.replace(",", "")), field)
        return traces
