import json
import os
import sys
from pathlib import Path

# Force UTF-8 output encoding for Windows terminals
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root to path
root_dir = Path(__file__).resolve().parents[1]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from packages.contracts import (
    ImpactMetricCreateRequest,
    MilestoneCreateRequest,
    PolicyAction,
    PolicyDecisionCreateRequest,
    ProjectCreateRequest,
    RecommendationCreateRequest,
)
from services.policy_impact.app.database import get_repository
from services.policy_impact.app.services.policy_service import PolicyService
from services.policy_impact.app.services.project_impact_service import ProjectImpactService
from services.policy_impact.app.services.recommendation_service import RecommendationService


def seed_demo_data():
    print("🌱 Seeding CivicBridge AI Policy + Impact Demo Data...")
    fixtures_dir = root_dir / "packages" / "test_fixtures"
    if not fixtures_dir.exists():
        fixtures_dir = root_dir / "packages" / "test-fixtures"

    rec_service = RecommendationService()
    policy_service = PolicyService()
    project_service = ProjectImpactService()

    fixtures_files = [
        "india_jaipur_fixtures.json",
        "brazil_rio_fixtures.json",
        "south_africa_capetown_fixtures.json",
    ]

    for fname in fixtures_files:
        fpath = fixtures_dir / fname
        if not fpath.exists():
            print(f"[!] Fixture file {fname} not found at {fpath}. Skipping.")
            continue

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        hs = data["hotspot"]
        eb = data["evidence_bundle"]
        rec_seed = data["recommendation_seed"]

        print(f"\n[+] Seeding {data['city']}, {data['country_code']}...")

        # 1. Create recommendation
        req_rec = RecommendationCreateRequest(
            hotspot_id=hs["hotspot_id"],
            evidence_bundle_id=eb["evidence_bundle_id"],
            title=rec_seed["title"],
            override_draft=True,
            manual_fields=rec_seed,
        )
        rec = rec_service.create_recommendation(req_rec)
        print(f"  ✓ Created Recommendation: {rec.title} (ID: {rec.recommendation_id[:8]})")

        # 2. Record human policy decision (Approve for assessment)
        req_dec = PolicyDecisionCreateRequest(
            action=PolicyAction.APPROVE_FOR_ASSESSMENT,
            reason=f"Evidence threshold met with confidence {hs['evidence_confidence']}. Approved for engineering feasibility.",
            actor_id=f"demo-{data['country_code'].lower()}-reviewer",
            actor_role="decision_maker",
        )
        decision, approved_rec = policy_service.record_decision(rec.recommendation_id, req_dec)
        print(f"  ✓ Recorded Human Policy Decision: {decision.action.value} by {decision.actor_id}")

        # 3. Create Project Candidate
        req_proj = ProjectCreateRequest(
            recommendation_id=rec.recommendation_id,
            title=f"{data['city']} {hs['category'].capitalize()} Infrastructure Rehabilitation",
            assigned_department=f"{data['city']} Public Works & Infrastructure Bureau",
        )
        project = project_service.create_project(req_proj)
        print(f"  ✓ Created Project Candidate: {project.title} (ID: {project.project_id[:8]})")

        # 4. Add Milestones
        m1 = project_service.add_milestone(
            project.project_id,
            MilestoneCreateRequest(
                title="Environmental & Structural Feasibility Assessment",
                target_date="2026-09-15T00:00:00Z",
                notes="Topographical survey and sub-surface load testing",
            ),
        )
        m2 = project_service.add_milestone(
            project.project_id,
            MilestoneCreateRequest(
                title="Tender Allocation & Contractor Onboarding",
                target_date="2026-10-30T00:00:00Z",
            ),
        )
        print(f"  ✓ Added {len(project.milestones)} Milestones")

        # 5. Add Impact Metric
        metric = project_service.add_impact_metric(
            project.project_id,
            ImpactMetricCreateRequest(
                metric_code=f"{hs['category']}_disruption_rate",
                baseline=18.5,
                target=4.0,
                current=11.2,
                unit="requests_per_10000_citizens_per_month",
                source_id="civicbridge_validated_requests",
                measured_at="2026-11-20T00:00:00Z",
                confidence=0.86,
            ),
        )
        print(f"  ✓ Added Impact Metric: {metric.metric_code} (Baseline: {metric.baseline} -> Current: {metric.current} -> Target: {metric.target})")

    print("\n[OK] Seed completed successfully! All 3 BRICS demo regions are loaded.")


if __name__ == "__main__":
    seed_demo_data()
