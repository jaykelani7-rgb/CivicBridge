import sqlite3
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional
from packages.contracts import (
    EventEnvelope,
    Recommendation,
    PolicyDecision,
    Project,
    Milestone,
    ImpactMetric,
)
from packages.durable_outbox import dispatch, enqueue, ensure_outbox, pending_count

logger = logging.getLogger("policy-impact-db")


class PolicyImpactRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.getenv("POLICY_DATABASE_URL") or os.getenv("DATABASE_PATH", "data/policy_impact.db")
        self._postgres = self.db_path.startswith(("postgres://", "postgresql://"))
        if os.getenv("ENVIRONMENT", "development").lower() == "production" and not self._postgres:
            raise RuntimeError("Production policy storage requires POLICY_DATABASE_URL (PostgreSQL)")
        if not self._postgres and self.db_path != ":memory:":
            Path(self.db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self._in_memory_recommendations: Dict[str, dict] = {}
        self._in_memory_decisions: Dict[str, dict] = {}
        self._in_memory_projects: Dict[str, dict] = {}
        self._in_memory_milestones: Dict[str, List[dict]] = {}
        self._in_memory_metrics: Dict[str, List[dict]] = {}
        self._init_db()

    def _connect(self):
        if self._postgres:
            import psycopg
            return psycopg.connect(self.db_path)
        return sqlite3.connect(self.db_path, timeout=30)

    def _query(self, query: str) -> str:
        return query.replace("?", "%s") if self._postgres else query

    def _execute_write(self, query: str, params: tuple, event: Optional[EventEnvelope] = None):
        conn = None
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute(self._query(query), params)
            if event is not None:
                enqueue(cursor, event, self._postgres)
            conn.commit()
        except Exception as e:
            logger.exception("Policy database write failed")
            raise
        finally:
            if conn:
                conn.close()

    def _execute_read_one(self, query: str, params: tuple) -> Optional[tuple]:
        conn = None
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute(self._query(query), params)
            row = cursor.fetchone()
            return row
        except Exception as e:
            logger.exception("Policy database read failed")
            raise
        finally:
            if conn:
                conn.close()

    def _execute_read_all(self, query: str, params: tuple = ()) -> List[tuple]:
        conn = None
        try:
            conn = self._connect()
            cursor = conn.cursor()
            cursor.execute(self._query(query), params)
            return cursor.fetchall()
        except Exception as e:
            logger.exception("Policy database read failed")
            raise
        finally:
            if conn:
                conn.close()

    def _init_db(self):
        conn = None
        try:
            conn = self._connect()
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
            # Keep legacy duplicate rows intact. The key reserves one canonical
            # project for each recommendation and serializes future creation.
            cursor.execute("""CREATE TABLE IF NOT EXISTS project_creation_keys (
                recommendation_id TEXT PRIMARY KEY, project_id TEXT NOT NULL
            )""")
            cursor.execute("""INSERT INTO project_creation_keys(recommendation_id,project_id)
                SELECT recommendation_id,MIN(project_id) FROM projects
                WHERE 1=1 GROUP BY recommendation_id
                ON CONFLICT(recommendation_id) DO NOTHING""")
            ensure_outbox(cursor)
            cursor.execute("""CREATE TABLE IF NOT EXISTS inbound_event_receipts (
                event_id TEXT PRIMARY KEY, recommendation_id TEXT NOT NULL, received_at TEXT NOT NULL
            )""")
            conn.commit()
            logger.info("Database initialized successfully.")
        except Exception as e:
            logger.exception("Policy database initialization failed")
            raise
        finally:
            if conn:
                conn.close()

    # --- Recommendations ---
    def save_recommendation(self, recommendation: Recommendation, event: Optional[EventEnvelope] = None) -> Recommendation:
        data_dict = recommendation.model_dump()
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
        self._execute_write(query, params, event)
        self._in_memory_recommendations[recommendation.recommendation_id] = data_dict
        return recommendation

    def get_recommendation(self, recommendation_id: str) -> Optional[Recommendation]:
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
        for row in self._execute_read_all("SELECT data_json FROM recommendations"):
            rec = json.loads(row[0])
            if hotspot_id and rec.get("hotspot_id") != hotspot_id:
                continue
            if status and rec.get("status") != status:
                continue
            results.append(Recommendation(**rec))
        return results

    def get_recommendation_for_inbound_event(self, event_id: str) -> Optional[Recommendation]:
        row = self._execute_read_one(
            "SELECT recommendation_id FROM inbound_event_receipts WHERE event_id=?", (event_id,)
        )
        return self.get_recommendation(row[0]) if row else None

    def create_recommendation_once(
        self, recommendation: Recommendation, event: EventEnvelope, inbound_event_id: str
    ) -> tuple[Recommendation, bool]:
        """Atomically consume an inbound event and queue its recommendation event."""
        conn = self._connect()
        try:
            if not self._postgres:
                conn.execute("BEGIN IMMEDIATE")
            cursor = conn.cursor()
            cursor.execute(self._query("""
                INSERT INTO inbound_event_receipts(event_id,recommendation_id,received_at)
                VALUES(?,?,?) ON CONFLICT(event_id) DO NOTHING
            """), (inbound_event_id, recommendation.recommendation_id, recommendation.created_at))
            created = cursor.rowcount == 1
            if created:
                cursor.execute(self._query("""
                    INSERT INTO recommendations(recommendation_id,hotspot_id,evidence_bundle_id,title,data_json,status,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?)
                """), (
                    recommendation.recommendation_id, recommendation.hotspot_id,
                    recommendation.evidence_bundle_id, recommendation.title,
                    json.dumps(recommendation.model_dump()), recommendation.status.value,
                    recommendation.created_at, recommendation.updated_at,
                ))
                enqueue(cursor, event, self._postgres)
                result = recommendation
            else:
                cursor.execute(self._query("""
                    SELECT r.data_json FROM recommendations r
                    JOIN inbound_event_receipts i ON i.recommendation_id=r.recommendation_id
                    WHERE i.event_id=?
                """), (inbound_event_id,))
                row = cursor.fetchone()
                if not row:
                    raise RuntimeError("Inbound event receipt lacks its recommendation")
                result = Recommendation(**json.loads(row[0]))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        if created:
            self._in_memory_recommendations[recommendation.recommendation_id] = recommendation.model_dump()
        return result, created

    # --- Policy Decisions ---
    def save_decision(self, decision: PolicyDecision) -> PolicyDecision:
        data_dict = decision.model_dump()
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
        self._in_memory_decisions[decision.decision_id] = data_dict
        return decision

    def record_decision_with_recommendation(
        self, recommendation: Recommendation, decision: PolicyDecision, event: EventEnvelope
    ) -> None:
        """Commit the status, human decision receipt and event as one unit."""
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(self._query("""
                UPDATE recommendations SET status=?, data_json=?, updated_at=?
                WHERE recommendation_id=?
            """), (
                recommendation.status.value, json.dumps(recommendation.model_dump()),
                recommendation.updated_at, recommendation.recommendation_id,
            ))
            if cursor.rowcount != 1:
                raise ValueError(f"Recommendation {recommendation.recommendation_id} not found.")
            cursor.execute(self._query("""
                INSERT INTO policy_decisions(decision_id,recommendation_id,action,actor_id,data_json,decided_at)
                VALUES(?,?,?,?,?,?)
            """), (
                decision.decision_id, decision.recommendation_id, decision.action.value,
                decision.actor_id, json.dumps(decision.model_dump()), decision.decided_at,
            ))
            enqueue(cursor, event, self._postgres)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        self._in_memory_recommendations[recommendation.recommendation_id] = recommendation.model_dump()
        self._in_memory_decisions[decision.decision_id] = decision.model_dump()

    def list_decisions_for_recommendation(self, recommendation_id: str) -> List[PolicyDecision]:
        return [PolicyDecision(**json.loads(row[0])) for row in self._execute_read_all(
            "SELECT data_json FROM policy_decisions WHERE recommendation_id = ?",
            (recommendation_id,),
        )]

    # --- Projects ---
    def save_project(self, project: Project, event: Optional[EventEnvelope] = None) -> Project:
        data_dict = project.model_dump()
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
        self._execute_write(query, params, event)
        self._in_memory_projects[project.project_id] = data_dict
        return project

    def get_project_by_recommendation(self, recommendation_id: str) -> Optional[Project]:
        row = self._execute_read_one(
            """SELECT p.data_json FROM projects p
               JOIN project_creation_keys k ON k.project_id=p.project_id
               WHERE k.recommendation_id = ?""", (recommendation_id,)
        )
        return Project(**json.loads(row[0])) if row else None

    def create_project_once(self, project: Project, event: EventEnvelope) -> tuple[Project, bool]:
        """One project per recommendation, including concurrent/retried requests."""
        conn = self._connect()
        try:
            if not self._postgres:
                conn.execute("BEGIN IMMEDIATE")
            cursor = conn.cursor()
            cursor.execute(self._query("""
                INSERT INTO project_creation_keys(recommendation_id,project_id)
                VALUES(?,?) ON CONFLICT(recommendation_id) DO NOTHING
            """), (project.recommendation_id, project.project_id))
            created = cursor.rowcount == 1
            if created:
                cursor.execute(self._query("""
                    INSERT INTO projects(project_id,recommendation_id,hotspot_id,title,status,data_json,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?)
                """), (
                    project.project_id, project.recommendation_id, project.hotspot_id, project.title,
                    project.status.value, json.dumps(project.model_dump()), project.created_at, project.updated_at,
                ))
                enqueue(cursor, event, self._postgres)
                result = project
            else:
                cursor.execute(self._query(
                    """SELECT p.data_json FROM projects p
                       JOIN project_creation_keys k ON k.project_id=p.project_id
                       WHERE k.recommendation_id=?"""
                ), (project.recommendation_id,))
                row = cursor.fetchone()
                if not row:
                    raise RuntimeError("Project uniqueness conflict could not be resolved")
                result = Project(**json.loads(row[0]))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        if created:
            self._in_memory_projects[project.project_id] = project.model_dump()
        return result, created

    def get_project(self, project_id: str) -> Optional[Project]:
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
        for row in self._execute_read_all("SELECT data_json FROM projects"):
            proj = json.loads(row[0])
            if status and proj.get("status") != status:
                continue
            results.append(Project(**proj))
        return results

    # --- Milestones & Metrics ---
    def add_milestone(self, milestone: Milestone) -> Milestone:
        data_dict = milestone.model_dump()
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
        self._in_memory_milestones.setdefault(milestone.project_id, []).append(data_dict)
        return milestone

    def get_milestones(self, project_id: str) -> List[Milestone]:
        persisted = [json.loads(row[0]) for row in self._execute_read_all(
            "SELECT data_json FROM milestones WHERE project_id = ?", (project_id,)
        )]
        return [Milestone(**m) for m in persisted]

    def add_metric(self, metric: ImpactMetric, event: Optional[EventEnvelope] = None) -> ImpactMetric:
        data_dict = metric.model_dump()
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
        self._execute_write(query, params, event)
        self._in_memory_metrics.setdefault(metric.project_id, []).append(data_dict)
        return metric

    def get_metrics(self, project_id: str) -> List[ImpactMetric]:
        persisted = [json.loads(row[0]) for row in self._execute_read_all(
            "SELECT data_json FROM impact_metrics WHERE project_id = ?", (project_id,)
        )]
        return [ImpactMetric(**m) for m in persisted]

    def dispatch_pending(self, publisher, *, fail_on_error: bool = False) -> List[str]:
        try:
            return dispatch(self._connect, self._postgres, publisher)
        except Exception:
            logger.exception("Policy event dispatch failed; committed events remain pending for replay")
            if fail_on_error:
                raise
            return []

    def pending_event_count(self) -> int:
        return pending_count(self._connect)

    def clear(self):
        self._in_memory_recommendations.clear()
        self._in_memory_decisions.clear()
        self._in_memory_projects.clear()
        self._in_memory_milestones.clear()
        self._in_memory_metrics.clear()
        for table in ("project_creation_keys", "inbound_event_receipts", "outbox_events", "impact_metrics", "milestones", "projects", "policy_decisions", "recommendations"):
            self._execute_write(f"DELETE FROM {table}", ())


repository = PolicyImpactRepository()


def get_repository() -> PolicyImpactRepository:
    return repository
