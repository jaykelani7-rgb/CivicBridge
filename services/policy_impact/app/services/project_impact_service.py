from datetime import datetime, timezone
import logging
from typing import List, Optional
from uuid import uuid4

from packages.contracts import (
    EventEnvelope,
    ImpactMetric,
    ImpactMetricCreateRequest,
    Milestone,
    MilestoneCreateRequest,
    Project,
    ProjectCreateRequest,
    ProjectStatus,
    RecommendationStatus,
)
from packages.event_bus import get_event_bus
from services.policy_impact.app.database import PolicyImpactRepository, get_repository

logger = logging.getLogger("project-impact-service")


class ProjectImpactService:
    def __init__(self, repository: Optional[PolicyImpactRepository] = None):
        self.repo = repository or get_repository()
        self.event_bus = get_event_bus()

    def create_project(self, req: ProjectCreateRequest) -> Project:
        now_str = datetime.now(timezone.utc).isoformat()

        # 1. Verify recommendation exists and human policy approval was recorded
        rec = self.repo.get_recommendation(req.recommendation_id)
        if not rec:
            raise ValueError(f"Recommendation {req.recommendation_id} not found.")

        if not rec.human_approved and rec.status != RecommendationStatus.APPROVED_FOR_ASSESSMENT:
            raise ValueError(
                f"Cannot create project: Recommendation {req.recommendation_id} is in status '{rec.status.value}' and has not been approved by a human policymaker."
            )

        title = req.title or rec.title

        # 2. Construct Project entity
        project = Project(
            project_id=str(uuid4()),
            recommendation_id=rec.recommendation_id,
            hotspot_id=rec.hotspot_id,
            country_code="IN",
            title=title,
            sector="drainage",
            status=ProjectStatus.CANDIDATE,
            assigned_department=req.assigned_department or rec.assigned_department or "Public Works Department",
            milestones=[
                Milestone(
                    milestone_id=str(uuid4()),
                    project_id="",
                    title="Engineering Feasibility Assessment",
                    status="in_progress",
                    target_date=now_str,
                )
            ],
            created_at=now_str,
            updated_at=now_str,
        )

        for m in project.milestones:
            m.project_id = project.project_id
            self.repo.add_milestone(m)

        # 3. Save to database
        self.repo.save_project(project)

        # 4. Publish project.status.updated.v1 event
        event = EventEnvelope(
            event_type="project.status.updated.v1",
            producer="policy-impact",
            data=project.model_dump(),
        )
        self.event_bus.publish(event)

        logger.info(f"[ProjectImpactService] Created project {project.project_id} from recommendation {rec.recommendation_id}")
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        project = self.repo.get_project(project_id)
        if project:
            project.milestones = self.repo.get_milestones(project_id)
        return project

    def list_projects(self, status: Optional[str] = None) -> List[Project]:
        projects = self.repo.list_projects(status)
        for p in projects:
            p.milestones = self.repo.get_milestones(p.project_id)
        return projects

    def add_milestone(self, project_id: str, req: MilestoneCreateRequest) -> Milestone:
        project = self.repo.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found.")

        milestone = Milestone(
            milestone_id=str(uuid4()),
            project_id=project_id,
            title=req.title,
            status="pending",
            target_date=req.target_date,
            notes=req.notes,
        )
        self.repo.add_milestone(milestone)

        project.updated_at = datetime.now(timezone.utc).isoformat()
        self.repo.save_project(project)

        logger.info(f"[ProjectImpactService] Added milestone '{milestone.title}' to project {project_id}")
        return milestone

    def add_impact_metric(self, project_id: str, req: ImpactMetricCreateRequest) -> ImpactMetric:
        now_str = datetime.now(timezone.utc).isoformat()

        project = self.repo.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found.")

        # Determine outcome status
        outcome_status = "improving"
        if req.current <= req.target:
            outcome_status = "delivered"
        elif req.current == req.baseline:
            outcome_status = "unchanged"

        metric = ImpactMetric(
            metric_id=str(uuid4()),
            project_id=project_id,
            metric_code=req.metric_code,
            baseline=req.baseline,
            target=req.target,
            current=req.current,
            unit=req.unit,
            source_id=req.source_id,
            measured_at=req.measured_at or now_str,
            confidence=req.confidence,
            outcome_status=outcome_status,
            recorded_at=now_str,
        )

        self.repo.add_metric(metric)

        # Publish impact.metric.updated.v1 event
        event = EventEnvelope(
            event_type="impact.metric.updated.v1",
            producer="policy-impact",
            data=metric.model_dump(),
        )
        self.event_bus.publish(event)

        logger.info(
            f"[ProjectImpactService] Added impact metric {metric.metric_code} (status: {outcome_status}) to project {project_id}"
        )
        return metric

    def get_project_metrics(self, project_id: str) -> List[ImpactMetric]:
        return self.repo.get_metrics(project_id)
