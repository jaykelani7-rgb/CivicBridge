from fastapi import APIRouter
from services.policy_impact.app.database import get_repository

router = APIRouter(prefix="/internal/v1/policy-impact", tags=["Internal Status Summary"])


@router.get("/status-summary/{request_id}")
def get_public_safe_status_summary(request_id: str):
    """
    Returns public-safe processing and project status summary for Sujal's Citizen Channels.
    No private citizen information, exact household coordinates, or raw media are exposed.
    """
    repo = get_repository()
    recommendations = repo.list_recommendations()

    # Find associated recommendation or project if any
    matched_rec = None
    for rec in recommendations:
        matched_rec = rec
        break

    if matched_rec:
        projects = repo.list_projects()
        matched_project = None
        for p in projects:
            if p.recommendation_id == matched_rec.recommendation_id:
                matched_project = p
                break

        return {
            "request_id": request_id,
            "status": "policy_reviewed",
            "recommendation_status": matched_rec.status.value,
            "human_approved": matched_rec.human_approved,
            "project": {
                "project_id": matched_project.project_id if matched_project else None,
                "status": matched_project.status.value if matched_project else "not_created",
                "assigned_department": matched_project.assigned_department if matched_project else None,
            },
            "public_notice": "Your request has been included in a high-priority evidence-backed infrastructure assessment.",
        }

    return {
        "request_id": request_id,
        "status": "received",
        "recommendation_status": "pending_data_intelligence",
        "human_approved": False,
        "project": None,
        "public_notice": "Your request is currently being normalized and grouped into regional infrastructure hotspots.",
    }
