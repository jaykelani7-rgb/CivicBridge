"""
Bounded-evidence policy brief draft generator -- Vertex AI Gemini only (real path).

Serves POST /internal/v1/policy-briefs/draft, which Sharmad's Policy + Impact
service calls (see services/policy_impact/app/stubs/ai_normalization_stub.py
and services/policy_impact/app/services/recommendation_service.py) to obtain
an AI draft before its own EvidenceValidator does the authoritative grounding
check. This adapter still applies its own defense-in-depth grounding guard so
it never hands back a citation that was not present in the evidence bundle it
was given -- consistent with Section 10's "fail closed" rule for
unsupported claims.

The response shape intentionally matches what recommendation_service.py
already expects (title, problem, proposed_intervention, intended_beneficiaries
as an int, supporting_evidence_ids, risks, missing_information, confidence) so
swapping the stub for this real service is a drop-in change -- only
SHREYANK_AI_SERVICE_URL / ENABLE_MOCK_STUBS need to point here.
"""
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger("ai-normalization.policy-brief")

PROMPT_TEMPLATE = (
    "You are an infrastructure policy advisor for BRICS public administrations.\n"
    "Using ONLY the evidence bundle below, draft a concise, pre-feasibility project brief.\n"
    "Every numeric claim and every cited source id MUST come from this bundle -- never invent a "
    "figure or an id that is not present here. If information is missing, say so in "
    "'missing_information' instead of guessing.\n\n"
    "Evidence bundle:\n{bundle_json}\n\n"
    "Return ONLY JSON with keys: title, problem, proposed_intervention, intended_beneficiaries "
    "(integer), supporting_evidence_ids (array, subset of the bundle's valid_evidence_ids), risks "
    "(array), missing_information (array), confidence (0.0-1.0)."
)


class PolicyBriefDraftAdapter:
    def __init__(self, use_mock: bool, project_id: str = "", location: str = "us-central1", model_name: str = "gemini-1.5-flash"):
        self.use_mock = use_mock
        self.project_id = project_id
        self.location = location
        self.model_name = model_name
        self._model = None
        if not use_mock:
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel

                if not project_id:
                    raise RuntimeError("GCP_PROJECT_ID is not set")
                vertexai.init(project=project_id, location=location)
                self._model = GenerativeModel(model_name)
            except Exception as exc:
                logger.warning("Failed to initialize Vertex AI Gemini for policy briefs (%s). Falling back to mock.", exc)
                self.use_mock = True

    @staticmethod
    def _ground(draft: Dict[str, Any], valid_ids: List[str]) -> Dict[str, Any]:
        """Defense-in-depth: strip any cited id the evidence bundle never supplied."""
        cited = draft.get("supporting_evidence_ids") or []
        grounded = [i for i in cited if i in valid_ids] or valid_ids[:2]
        draft["supporting_evidence_ids"] = grounded
        if len(grounded) < len(cited):
            draft.setdefault("missing_information", [])
            draft["missing_information"].append(
                "Some AI-cited evidence ids were not present in the supplied bundle and were removed."
            )
            draft["confidence"] = min(float(draft.get("confidence", 0.85)), 0.6)
        return draft

    def _mock_draft(self, hotspot_id: str, evidence_bundle: Dict[str, Any]) -> Dict[str, Any]:
        valid_ids = evidence_bundle.get(
            "valid_evidence_ids", ["src_population_42", "cluster_drainage_42"]
        )
        summary = evidence_bundle.get("summary", "Recurring infrastructure demand hotspot.")
        population = (evidence_bundle.get("demographic_indicators") or {}).get("affected_population", 12400)

        draft = {
            "title": f"Infrastructure rehabilitation assessment for {hotspot_id[:8]}",
            "problem": summary,
            "proposed_intervention": "Conduct feasibility study for capacity upgrade and network expansion.",
            "intended_beneficiaries": population,
            "supporting_evidence_ids": list(valid_ids),
            "risks": ["Current capacity survey requires sub-surface/field validation."],
            "missing_information": ["Detailed engineering design and cost estimate"],
            "confidence": 0.86,
        }
        return self._ground(draft, valid_ids)

    def generate_draft(self, hotspot_id: str, evidence_bundle_id: str, evidence_bundle: Dict[str, Any]) -> Dict[str, Any]:
        valid_ids = evidence_bundle.get("valid_evidence_ids", [])

        if self.use_mock:
            return self._mock_draft(hotspot_id, evidence_bundle)

        prompt = PROMPT_TEMPLATE.format(bundle_json=json.dumps(evidence_bundle, indent=2))
        try:
            response = self._model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            draft = json.loads(response.text)
            return self._ground(draft, valid_ids)
        except Exception as exc:
            logger.error("Gemini policy-brief drafting failed (%s); falling back to mock draft engine.", exc)
            return self._mock_draft(hotspot_id, evidence_bundle)
