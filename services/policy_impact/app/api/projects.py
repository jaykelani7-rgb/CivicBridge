from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from packages.contracts import (
    Project,
    ProjectCreateRequest,
    StandardErrorResponse,
)
from services.policy_impact.app.services.project_impact_service import ProjectImpactService

router = APIRouter(prefix="/v1/projects", tags=["Projects"])
service = ProjectImpactService()


@router.post(
    "",
    response_model=Project,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": StandardErrorResponse, "description": "Unapproved Recommendation Error"},
        404: {"model": StandardErrorResponse, "description": "Recommendation Not Found"},
    },
)
def create_project(req: ProjectCreateRequest):
    try:
        return service.create_project(req)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "PROJECT_CREATION_FAILED", "message": str(e)}},
        )


@router.get("", response_model=List[Project])
def list_projects(status_filter: Optional[str] = Query(None, alias="status")):
    return service.list_projects(status=status_filter)


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str):
    project = service.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "PROJECT_NOT_FOUND", "message": f"Project {project_id} not found."}},
        )
    return project
