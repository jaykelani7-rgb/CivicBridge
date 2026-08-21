from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="CivicBridge AI - AI Normalization Stub (Shreyank)")


class PolicyBriefDraftRequest(BaseModel):
    hotspot_id: str
    evidence_bundle_id: str
    evidence_bundle: dict


@app.post("/internal/v1/policy-briefs/draft")
def generate_policy_brief_draft(req: PolicyBriefDraftRequest):
    valid_ids = req.evidence_bundle.get("valid_evidence_ids", ["src_population_42", "cluster_drainage_42"])
    return {
        "title": f"Infrastructure rehabilitation assessment for {req.hotspot_id[:8]}",
        "problem": req.evidence_bundle.get("summary", "Recurring road flooding and stormwater backlog."),
        "proposed_intervention": "Conduct feasibility study for stormwater drain upgrade and network expansion.",
        "intended_beneficiaries": 12400,
        "supporting_evidence_ids": valid_ids,
        "risks": ["Current drain capacity survey requires sub-surface validation."],
        "missing_information": ["Detailed engineering design and soil load analysis"],
        "confidence": 0.86,
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "ai-normalization-stub"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
