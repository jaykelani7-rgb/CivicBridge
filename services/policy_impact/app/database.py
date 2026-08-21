import sqlite3
import json
import logging
from typing import Dict, List, Optional
from packages.contracts import (
    Recommendation,
    PolicyDecision,
    Project,
    Milestone,
    ImpactMetric,
)

logger = logging.getLogger("policy-impact-db")


class PolicyImpactRepository:
    def __init__(self, db_path: str = "policy_impact.db"):
        self.db_path = db_path
        self._in_memory_recommendations: Dict[str, dict] = {}
        self._in_memory_decisions: Dict[str, dict] = {}
        self._in_memory_projects: Dict[str, dict] = {}
        self._in_memory_milestones: Dict[str, List[dict]] = {}
        self._in_memory_metrics: Dict[str, List[dict]] = {}
        self._init_db()

    def _execute_write(self, query: str, params: tuple):
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
        except Exception as e:
            logger.warning(f"SQLite write error: {e}")
        finally:
            if conn:
                conn.close()

    def _execute_read_one(self, query: str, params: tuple) -> Optional[tuple]:
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(query, params)
            row = cursor.fetchone()
            return row
        except Exception as e:
            logger.warning(f"SQLite read error: {e}")
            return None
        finally:
            if conn:
                conn.close()

    def _init_db(self):
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recommendations (
                    recommendation_id TEXT PRIMARY KEY,
                    hotspot_id TEXT NOT NULL,
                    evidence_bundle_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS policy_decisions (
                    decision_id TEXT PRIMARY KEY,
                    recommendation_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    decided_at TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    project_id TEXT PRIMARY KEY,
                    recommendation_id TEXT NOT NULL,
                    hotspot_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS milestones (
                    milestone_id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data_json TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS impact_metrics (
                    metric_id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    metric_code TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    recorded_at TEXT NOT NULL
                )
            """)
            conn.commit()
            logger.info("Database initialized successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize SQLite database ({e}). Using in-memory store.")
        finally:
            if conn:
                conn.close()

    # --- Recommendations ---
    def save_recommendation(self, recommendation: Recommendation) -> Recommendation:
        data_dict = recommendation.model_dump()
        self._in_memory_recommendations[recommendation.recommendation_id] = data_dict
        query = """
            INSERT INTO recommendations (recommendation_id, hotspot_id, evidence_bundle_id, title, data_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(recommendation_id) DO UPDATE SET
                status = excluded.status,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
        """
        params = (
            recommendation.recommendation_id,
            recommendation.hotspot_id,
            recommendation.evidence_bundle_id,
            recommendation.title,
            json.dumps(data_dict),
            recommendation.status.value,
            recommendation.created_at,
            recommendation.updated_at,
        )
        self._execute_write(query, params)
        return recommendation

    def get_recommendation(self, recommendation_id: str) -> Optional[Recommendation]:
        if recommendation_id in self._in_memory_recommendations:
            return Recommendation(**self._in_memory_recommendations[recommendation_id])
        
        row = self._execute_read_one(
            "SELECT data_json FROM recommendations WHERE recommendation_id = ?",
            (recommendation_id,),
        )
        if row:
            data = json.loads(row[0])
            self._in_memory_recommendations[recommendation_id] = data
            return Recommendation(**data)
        return None

    def list_recommendations(self, hotspot_id: Optional[str] = None, status: Optional[str] = None) -> List[Recommendation]:
        results = []
        for rec in self._in_memory_recommendations.values():
            if hotspot_id and rec.get("hotspot_id") != hotspot_id:
                continue
            if status and rec.get("status") != status:
                continue
            results.append(Recommendation(**rec))
        return results

    # --- Policy Decisions ---
    def save_decision(self, decision: PolicyDecision) -> PolicyDecision:
        data_dict = decision.model_dump()
        self._in_memory_decisions[decision.decision_id] = data_dict
        query = """
            INSERT INTO policy_decisions (decision_id, recommendation_id, action, actor_id, data_json, decided_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (
            decision.decision_id,
            decision.recommendation_id,
            decision.action.value,
            decision.actor_id,
            json.dumps(data_dict),
            decision.decided_at,
        )
        self._execute_write(query, params)
        return decision

    def list_decisions_for_recommendation(self, recommendation_id: str) -> List[PolicyDecision]:
        return [
            PolicyDecision(**d)
            for d in self._in_memory_decisions.values()
            if d.get("recommendation_id") == recommendation_id
        ]

    # --- Projects ---
    def save_project(self, project: Project) -> Project:
        data_dict = project.model_dump()
        self._in_memory_projects[project.project_id] = data_dict
        query = """
            INSERT INTO projects (project_id, recommendation_id, hotspot_id, title, status, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                status = excluded.status,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
        """
        params = (
            project.project_id,
            project.recommendation_id,
            project.hotspot_id,
            project.title,
            project.status.value,
            json.dumps(data_dict),
            project.created_at,
            project.updated_at,
        )
        self._execute_write(query, params)
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        if project_id in self._in_memory_projects:
            return Project(**self._in_memory_projects[project_id])
        
        row = self._execute_read_one(
            "SELECT data_json FROM projects WHERE project_id = ?",
            (project_id,),
        )
        if row:
            data = json.loads(row[0])
            self._in_memory_projects[project_id] = data
            return Project(**data)
        return None

    def list_projects(self, status: Optional[str] = None) -> List[Project]:
        results = []
        for proj in self._in_memory_projects.values():
            if status and proj.get("status") != status:
                continue
            results.append(Project(**proj))
        return results

    # --- Milestones & Metrics ---
    def add_milestone(self, milestone: Milestone) -> Milestone:
        data_dict = milestone.model_dump()
        if milestone.project_id not in self._in_memory_milestones:
            self._in_memory_milestones[milestone.project_id] = []
        self._in_memory_milestones[milestone.project_id].append(data_dict)
        
        query = """
            INSERT INTO milestones (milestone_id, project_id, title, status, data_json)
            VALUES (?, ?, ?, ?, ?)
        """
        params = (
            milestone.milestone_id,
            milestone.project_id,
            milestone.title,
            milestone.status,
            json.dumps(data_dict),
        )
        self._execute_write(query, params)
        return milestone

    def get_milestones(self, project_id: str) -> List[Milestone]:
        return [Milestone(**m) for m in self._in_memory_milestones.get(project_id, [])]

    def add_metric(self, metric: ImpactMetric) -> ImpactMetric:
        data_dict = metric.model_dump()
        if metric.project_id not in self._in_memory_metrics:
            self._in_memory_metrics[metric.project_id] = []
        self._in_memory_metrics[metric.project_id].append(data_dict)
        
        query = """
            INSERT INTO impact_metrics (metric_id, project_id, metric_code, data_json, recorded_at)
            VALUES (?, ?, ?, ?, ?)
        """
        params = (
            metric.metric_id,
            metric.project_id,
            metric.metric_code,
            json.dumps(data_dict),
            metric.recorded_at,
        )
        self._execute_write(query, params)
        return metric

    def get_metrics(self, project_id: str) -> List[ImpactMetric]:
        return [ImpactMetric(**m) for m in self._in_memory_metrics.get(project_id, [])]

    def clear(self):
        self._in_memory_recommendations.clear()
        self._in_memory_decisions.clear()
        self._in_memory_projects.clear()
        self._in_memory_milestones.clear()
        self._in_memory_metrics.clear()


repository = PolicyImpactRepository()


def get_repository() -> PolicyImpactRepository:
    return repository
