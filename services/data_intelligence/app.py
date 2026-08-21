from fastapi import FastAPI

app = FastAPI(title="CivicBridge AI - Data Intelligence Stub (Jay)")


@app.get("/v1/hotspots/{hotspot_id}/evidence")
def get_evidence_bundle(hotspot_id: str):
    return {
        "evidence_bundle_id": f"evb_bundle_{hotspot_id[:8]}",
        "hotspot_id": hotspot_id,
        "valid_evidence_ids": [
            "src_population_42",
            "cluster_drainage_42",
            "src_infra_gap_42",
            "src_investment_plan_2025",
        ],
        "summary": "Ward 42 drainage infrastructure demand hotspot evidence bundle.",
        "citizen_summaries": [
            "Recurring road flooding is blocking access during monsoon rains.",
            "Stormwater drain overflow near Ward 42 main road."
        ],
        "demographic_indicators": {
            "affected_population": 12400,
            "source_id": "src_population_42",
        },
        "infrastructure_gap": {
            "gap_score": 82.5,
            "source_id": "src_infra_gap_42",
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "data-intelligence-stub"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)
