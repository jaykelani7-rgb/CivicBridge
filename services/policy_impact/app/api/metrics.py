from typing import List
from fastapi import APIRouter, HTTPException, status
from packages.contracts import ImpactMetric, ImpactMetricCreateRequest
from services.policy_impact.app.services.project_impact_service import ProjectImpactService

router = APIRouter(prefix="/v1/projects", tags=["Impact Metrics"])
service = ProjectImpactService()


@router.post("/{project_id}/metrics", response_model=ImpactMetric, status_code=status.HTTP_201_CREATED)
def add_impact_metric(project_id: str, req: ImpactMetricCreateRequest):
    try:
        return service.add_impact_metric(project_id, req)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "PROJECT_NOT_FOUND", "message": str(e)}},
        )


@router.get("/{project_id}/metrics", response_model=List[ImpactMetric])
def get_project_metrics(project_id: str):
    return service.get_project_metrics(project_id)
