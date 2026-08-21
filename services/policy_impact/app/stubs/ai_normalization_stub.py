import logging
from typing import Any, Dict, Optional
import httpx
from packages.cloud_runtime import cloud_run_headers

logger = logging.getLogger("ai-normalization-stub")


class AINormalizationClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8001", enable_mock: bool = True, authenticate_cloud_run: bool = False):
        self.base_url = base_url
        self.enable_mock = enable_mock
        self.authenticate_cloud_run = authenticate_cloud_run

    def generate_policy_brief_draft(
        self, hotspot_id: str, evidence_bundle_id: str, evidence_bundle: dict
    ) -> dict:
        if not self.enable_mock:
            try:
                payload = {
                    "hotspot_id": hotspot_id,
                    "evidence_bundle_id": evidence_bundle_id,
                    "evidence_bundle": evidence_bundle,
                }
                resp = httpx.post(
                    f"{self.base_url}/internal/v1/policy-briefs/draft",
                    json=payload,
                    headers=cloud_run_headers(self.base_url, self.authenticate_cloud_run),
                    timeout=30.0,
                )
                if resp.status_code == 200:
                    return resp.json()
                raise RuntimeError(f"AI Normalization returned HTTP {resp.status_code}")
            except Exception as e:
                logger.warning("AI Normalization dependency failed (%s).", type(e).__name__)
                raise

        # Default fallback AI draft engine
        valid_ids = evidence_bundle.get("valid_evidence_ids", ["src_population_42", "cluster_drainage_42"])
        summary = evidence_bundle.get("summary", "Infrastructure improvement demand hotspot.")

        return {
            "title": f"Infrastructure rehabilitation brief for {hotspot_id[:8]}",
            "problem": summary,
            "proposed_intervention": "Conduct an engineering feasibility study and construct upgraded infrastructure capacity.",
            "intended_beneficiaries": 12400,
            "supporting_evidence_ids": valid_ids,
            "risks": ["Current capacity survey requires detailed field validation."],
            "missing_information": ["Detailed engineering design and soil load analysis"],
            "confidence": 0.85,
        }
