from fastapi import APIRouter, HTTPException, status
from packages.contracts import Milestone, MilestoneCreateRequest
from services.policy_impact.app.services.project_impact_service import ProjectImpactService

router = APIRouter(prefix="/v1/projects", tags=["Project Milestones"])
service = ProjectImpactService()


@router.post("/{project_id}/milestones", response_model=Milestone, status_code=status.HTTP_201_CREATED)
def add_milestone(project_id: str, req: MilestoneCreateRequest):
    try:
        return service.add_milestone(project_id, req)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "PROJECT_NOT_FOUND", "message": str(e)}},
        )
