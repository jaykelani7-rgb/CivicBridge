import logging
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
            message="All recommendation claim citations are valid and grounded in the evidence bundle.",
        )
