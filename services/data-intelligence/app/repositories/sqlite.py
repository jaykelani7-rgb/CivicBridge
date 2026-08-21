from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional


class SQLiteRepository:
    """Operational local/demo store with an atomic pipeline and outbox."""

    def __init__(self, database_path: str, migration_path: Path) -> None:
        if database_path != ":memory:":
            Path(database_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(database_path, check_same_thread=False, isolation_level=None)
        self.connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self.connection.executescript(migration_path.read_text(encoding="utf-8"))

    @contextmanager
    def transaction(self) -> Iterator[None]:
        with self._lock:
            self.connection.execute("BEGIN IMMEDIATE")
            try:
                yield
            except Exception:
                self.connection.rollback()
                raise
            else:
                self.connection.commit()

    def close(self) -> None:
        self.connection.close()

    def ping(self) -> bool:
        return self.connection.execute("SELECT 1").fetchone()[0] == 1

    @staticmethod
    def _dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def get_processed_event(self, event_id: str) -> Optional[dict[str, Any]]:
        return self._dict(self.connection.execute("SELECT * FROM processed_events WHERE event_id=?", (event_id,)).fetchone())

    def start_event(self, event_id: str, event_type: str, trace_id: str, now: str) -> None:
        existing = self.get_processed_event(event_id)
        if existing and existing["status"] == "failed" and existing["error_code"] in {"DEPENDENCY_UNAVAILABLE", "DUPLICATE_CHECK_FAILED"}:
            self.connection.execute(
                "UPDATE processed_events SET status='processing', error_code=NULL, processed_at=? WHERE event_id=?",
                (now, event_id),
            )
            return
        self.connection.execute(
            "INSERT INTO processed_events(event_id,event_type,processed_at,status,trace_id) VALUES(?,?,?,?,?)",
            (event_id, event_type, now, "processing", trace_id),
        )

    def complete_event(self, event_id: str, result_entity_id: str, now: str) -> None:
        self.connection.execute(
            "UPDATE processed_events SET status='completed', result_entity_id=?, processed_at=?, error_code=NULL WHERE event_id=?",
            (result_entity_id, now, event_id),
        )

    def fail_event(self, event_id: str, event_type: str, trace_id: str, code: str, now: str) -> None:
        self.connection.execute(
            "INSERT INTO processed_events(event_id,event_type,processed_at,status,error_code,trace_id) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(event_id) DO UPDATE SET processed_at=excluded.processed_at,status='failed',error_code=excluded.error_code",
            (event_id, event_type, now, "failed", code, trace_id),
        )

    def upsert_admin_unit(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO admin_units VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(geography_id) DO UPDATE SET "
            "admin1=excluded.admin1,admin2=excluded.admin2,locality=excluded.locality,centroid_lat=excluded.centroid_lat,"
            "centroid_lon=excluded.centroid_lon,polygon_json=excluded.polygon_json,aliases_json=excluded.aliases_json,"
            "boundary_source=excluded.boundary_source,boundary_version=excluded.boundary_version",
            (row["geography_id"], row["country_code"], row["admin1"], row["admin2"], row["locality"], row["centroid_lat"],
             row["centroid_lon"], json.dumps(row["polygon"]), json.dumps(row["aliases"]), row["boundary_source"], row["boundary_version"]),
        )

    def list_admin_units(self, country_code: str) -> list[dict[str, Any]]:
        rows = self.connection.execute("SELECT * FROM admin_units WHERE country_code=? ORDER BY geography_id", (country_code,)).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["polygon"] = json.loads(item.pop("polygon_json"))
            item["aliases"] = json.loads(item.pop("aliases_json"))
            result.append(item)
        return result

    def get_admin_unit(self, geography_id: str) -> Optional[dict[str, Any]]:
        row = self._dict(self.connection.execute("SELECT * FROM admin_units WHERE geography_id=?", (geography_id,)).fetchone())
        if row:
            row["polygon"] = json.loads(row.pop("polygon_json"))
            row["aliases"] = json.loads(row.pop("aliases_json"))
        return row

    def upsert_source(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO data_sources VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET "
            "publisher=excluded.publisher,dataset_title=excluded.dataset_title,retrieved_at=excluded.retrieved_at,"
            "confidence=excluded.confidence,freshness_status=excluded.freshness_status",
            (row["source_id"], row["publisher"], row["dataset_title"], row["country_code"], row["geographic_coverage"],
             row["time_coverage"], row["retrieved_at"], row.get("license"), row["transformation_notes"], row["confidence"],
             row["freshness_status"], int(row.get("synthetic", False))),
        )

    def upsert_demographic(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO demographic_features VALUES(?,?,?,?,?,?) ON CONFLICT(feature_id) DO UPDATE SET "
            "population=excluded.population,equity_vulnerability=excluded.equity_vulnerability,reference_year=excluded.reference_year,source_id=excluded.source_id",
            (row["feature_id"], row["geography_id"], row.get("population"), row.get("equity_vulnerability"), row["reference_year"], row["source_id"]),
        )

    def upsert_infrastructure(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO infrastructure_indices VALUES(?,?,?,?,?,?,?) ON CONFLICT(feature_id) DO UPDATE SET "
            "infrastructure_gap=excluded.infrastructure_gap,existing_facility_coverage=excluded.existing_facility_coverage,"
            "reference_year=excluded.reference_year,source_id=excluded.source_id",
            (row["feature_id"], row["geography_id"], row["category"], row.get("infrastructure_gap"),
             row.get("existing_facility_coverage"), row["reference_year"], row["source_id"]),
        )

    def upsert_project(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO investment_projects VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET "
            "status=excluded.status,strategic_alignment=excluded.strategic_alignment,delivery_readiness=excluded.delivery_readiness,"
            "existing_coverage_penalty=excluded.existing_coverage_penalty,source_id=excluded.source_id",
            (row["project_id"], row["geography_id"], row["category"], row["name"], row["status"],
             row.get("strategic_alignment"), row.get("delivery_readiness"), row.get("existing_coverage_penalty"), row["source_id"]),
        )

    def get_enrichment(self, geography_id: str, category: str) -> dict[str, Any]:
        demographic = self._dict(self.connection.execute(
            "SELECT * FROM demographic_features WHERE geography_id=? ORDER BY reference_year DESC LIMIT 1", (geography_id,)
        ).fetchone())
        infrastructure = self._dict(self.connection.execute(
            "SELECT * FROM infrastructure_indices WHERE geography_id=? AND category=? ORDER BY reference_year DESC LIMIT 1",
            (geography_id, category),
        ).fetchone())
        projects = [dict(x) for x in self.connection.execute(
            "SELECT * FROM investment_projects WHERE geography_id=? AND category=? ORDER BY project_id", (geography_id, category)
        ).fetchall()]
        source_ids = sorted({x["source_id"] for x in [demographic, infrastructure, *projects] if x})
        sources = [dict(x) for x in self.connection.execute(
            f"SELECT * FROM data_sources WHERE source_id IN ({','.join('?' for _ in source_ids)}) ORDER BY source_id", source_ids
        ).fetchall()] if source_ids else []
        return {"demographic": demographic, "infrastructure": infrastructure, "projects": projects, "sources": sources}

    def create_seed_cluster(self, seed: dict[str, Any], spatial_cell: str) -> None:
        self.connection.execute(
            "INSERT OR IGNORE INTO issue_clusters VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (seed["cluster_id"], seed["country_code"], seed["geography_id"], spatial_cell, seed["category"], seed.get("subcategory"),
             seed["summary"], seed["occurred_at"], seed["occurred_at"], 1, 0, "active", "fixture_seed", 1, seed["latitude"], seed["longitude"]),
        )
        self.connection.execute(
            "INSERT OR IGNORE INTO cluster_members VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (seed["request_id"], seed["cluster_id"], "fixture:" + seed["request_id"], seed["summary"], seed["requested_outcome"],
             seed["urgency"], seed["confidence"], 1.0, seed["occurred_at"], 1, json.dumps(["fixture:" + seed["request_id"]])),
        )

    def list_candidate_members(self, country_code: str, category: str, occurred_after: str) -> list[dict[str, Any]]:
        rows = self.connection.execute(
            "SELECT m.*, c.country_code,c.geography_id,c.category,c.subcategory,c.centroid_lat,c.centroid_lon "
            "FROM cluster_members m JOIN issue_clusters c ON c.cluster_id=m.cluster_id "
            "WHERE c.country_code=? AND c.category=? AND m.active=1 AND m.occurred_at>=? ORDER BY m.occurred_at DESC",
            (country_code, category, occurred_after),
        ).fetchall()
        return [dict(x) for x in rows]

    def get_cluster(self, cluster_id: str) -> Optional[dict[str, Any]]:
        return self._dict(self.connection.execute("SELECT * FROM issue_clusters WHERE cluster_id=?", (cluster_id,)).fetchone())

    def create_cluster(self, row: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO issue_clusters VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (row["cluster_id"], row["country_code"], row["geography_id"], row["spatial_cell"], row["category"], row.get("subcategory"),
             row["canonical_summary"], row["first_seen"], row["last_seen"], 0, 0, "active", row["duplicate_method"], 1,
             row["centroid_lat"], row["centroid_lon"]),
        )

    def add_cluster_member(self, row: dict[str, Any]) -> bool:
        before = self.connection.total_changes
        self.connection.execute(
            "INSERT OR IGNORE INTO cluster_members VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (row["request_id"], row["cluster_id"], row["event_id"], row["summary"], row["requested_outcome"], row["urgency"],
             row["request_confidence"], row["location_confidence"], row["occurred_at"], 1, json.dumps(row["evidence_refs"])),
        )
        inserted = self.connection.total_changes > before
        if inserted:
            self.connection.execute(
                "UPDATE issue_clusters SET unique_request_count=unique_request_count+1,corroboration_count=CASE WHEN unique_request_count>=1 THEN corroboration_count+1 ELSE corroboration_count END,"
                "last_seen=MAX(last_seen,?),cluster_version=cluster_version+1 WHERE cluster_id=?",
                (row["occurred_at"], row["cluster_id"]),
            )
        return inserted

    def save_duplicate_candidates(self, request_id: str, candidates: list[dict[str, Any]], now: str) -> None:
        for candidate in candidates:
            self.connection.execute(
                "INSERT OR REPLACE INTO duplicate_candidates VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (candidate["id"], request_id, candidate["candidate_request_id"], candidate["candidate_cluster_id"],
                 candidate["final_similarity"], candidate["semantic_similarity"], candidate["spatial_similarity"],
                 candidate["temporal_similarity"], candidate["taxonomy_similarity"], candidate["distance_km"],
                 candidate["time_difference_days"], candidate["match_reason"], candidate["suggested_action"], now),
            )

    def get_cluster_members(self, cluster_id: str) -> list[dict[str, Any]]:
        return [dict(x) for x in self.connection.execute(
            "SELECT * FROM cluster_members WHERE cluster_id=? AND active=1 ORDER BY occurred_at", (cluster_id,)
        ).fetchall()]

    def get_or_create_hotspot_id(self, cluster_id: str, proposed_id: str) -> str:
        row = self.connection.execute("SELECT hotspot_id FROM hotspots_daily WHERE cluster_id=?", (cluster_id,)).fetchone()
        return row[0] if row else proposed_id

    def next_hotspot_version(self, hotspot_id: str) -> int:
        row = self.connection.execute("SELECT COALESCE(MAX(version),0)+1 FROM hotspot_versions WHERE hotspot_id=?", (hotspot_id,)).fetchone()
        return int(row[0])

    def upsert_hotspot(self, row: dict[str, Any]) -> None:
        values = (
            row["hotspot_id"],row["cluster_id"],row["country_code"],row["geography_id"],row["spatial_cell"],row["category"],
            row["calculation_date"],row["request_count"],row["unique_request_count"],row["corroboration_count"],row["suspected_duplicates"],
            row["pending_review_count"],row["excluded_count"],row["request_rate"],row["affected_population"],row["trend_30d"],
            row.get("infrastructure_gap"),row.get("equity_vulnerability"),row["evidence_confidence"],row["need_score"],row["action_score"],
            row["score_version"],row.get("evidence_bundle_id"),row["calculated_at"],row["status"],json.dumps(row["warnings"]),
        )
        self.connection.execute(
            "INSERT INTO hotspots_daily VALUES(" + ",".join("?" for _ in values) + ") ON CONFLICT(hotspot_id) DO UPDATE SET "
            "calculation_date=excluded.calculation_date,request_count=excluded.request_count,unique_request_count=excluded.unique_request_count,"
            "corroboration_count=excluded.corroboration_count,suspected_duplicates=excluded.suspected_duplicates,request_rate=excluded.request_rate,"
            "affected_population=excluded.affected_population,trend_30d=excluded.trend_30d,infrastructure_gap=excluded.infrastructure_gap,"
            "equity_vulnerability=excluded.equity_vulnerability,evidence_confidence=excluded.evidence_confidence,need_score=excluded.need_score,"
            "action_score=excluded.action_score,score_version=excluded.score_version,evidence_bundle_id=excluded.evidence_bundle_id,"
            "calculated_at=excluded.calculated_at,warnings_json=excluded.warnings_json,status=excluded.status",
            values,
        )

    def save_score_components(self, hotspot_id: str, version: int, components: list[dict[str, Any]]) -> None:
        for c in components:
            self.connection.execute(
                "INSERT INTO score_components VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (c["id"],hotspot_id,version,c["name"],c["raw_value"],c["normalized_value"],c["weight"],c["weighted_contribution"],
                 json.dumps(c["source_ids"]),int(c["missing"]),c["fallback_used"],c["confidence"],c["formula_version"],c["calculated_at"]),
            )

    def save_hotspot_version(self, hotspot_id: str, version: int, snapshot: dict[str, Any], reason: str, idempotency_key: Optional[str], trace_id: str, now: str) -> None:
        self.connection.execute(
            "INSERT INTO hotspot_versions VALUES(?,?,?,?,?,?,?,?)",
            (f"{hotspot_id}:v{version}",hotspot_id,version,json.dumps(snapshot,sort_keys=True),reason,idempotency_key,trace_id,now),
        )

    def get_recalculation_by_key(self, hotspot_id: str, key: str) -> Optional[dict[str, Any]]:
        row = self.connection.execute(
            "SELECT snapshot_json FROM hotspot_versions WHERE hotspot_id=? AND idempotency_key=?", (hotspot_id,key)
        ).fetchone()
        return json.loads(row[0]) if row else None

    def save_evidence_bundle(self, bundle_id: str, hotspot_id: str, version: int, bundle: dict[str, Any], bundle_hash: str, now: str) -> None:
        self.connection.execute(
            "INSERT INTO evidence_bundles VALUES(?,?,?,?,?,?)", (bundle_id,hotspot_id,version,json.dumps(bundle,sort_keys=True),bundle_hash,now)
        )

    def set_hotspot_bundle(self, hotspot_id: str, bundle_id: str) -> None:
        self.connection.execute("UPDATE hotspots_daily SET evidence_bundle_id=? WHERE hotspot_id=?", (bundle_id,hotspot_id))

    def enqueue_outbox(self, event_id: str, event_type: str, payload: dict[str, Any], trace_id: str, now: str) -> None:
        self.connection.execute(
            "INSERT INTO outbox_events(event_id,event_type,payload_json,trace_id,created_at) VALUES(?,?,?,?,?)",
            (event_id,event_type,json.dumps(payload,sort_keys=True),trace_id,now),
        )

    def pending_outbox(self) -> list[dict[str, Any]]:
        return [dict(x) for x in self.connection.execute(
            "SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at"
        ).fetchall()]

    def mark_outbox_published(self, event_id: str, now: str) -> None:
        self.connection.execute("UPDATE outbox_events SET published_at=?,attempt_count=attempt_count+1,last_error=NULL WHERE event_id=?", (now,event_id))

    def mark_outbox_failed(self, event_id: str, error: str) -> None:
        self.connection.execute("UPDATE outbox_events SET attempt_count=attempt_count+1,last_error=? WHERE event_id=?", (error[:300],event_id))

    def save_review(self, request_id: str, event_id: str, country_code: str, reason: str, trace_id: str, now: str) -> None:
        self.connection.execute(
            "INSERT OR IGNORE INTO review_requests VALUES(?,?,?,?,?,?,?)",
            (request_id,event_id,country_code,reason,trace_id,now,"pending_review"),
        )

    def count_reviews(self, country_code: str, geography_id: Optional[str] = None) -> int:
        return int(self.connection.execute("SELECT COUNT(*) FROM review_requests WHERE country_code=? AND status='pending_review'", (country_code,)).fetchone()[0])

    def get_hotspot(self, hotspot_id: str) -> Optional[dict[str, Any]]:
        row = self._dict(self.connection.execute("SELECT * FROM hotspots_daily WHERE hotspot_id=?", (hotspot_id,)).fetchone())
        if row:
            row["warnings"] = json.loads(row.pop("warnings_json"))
        return row

    def get_latest_score(self, hotspot_id: str) -> tuple[Optional[dict[str, Any]], list[dict[str, Any]]]:
        hotspot = self.get_hotspot(hotspot_id)
        if not hotspot:
            return None, []
        version_row = self.connection.execute("SELECT MAX(version) FROM hotspot_versions WHERE hotspot_id=?", (hotspot_id,)).fetchone()
        version = int(version_row[0] or 0)
        components = []
        for row in self.connection.execute(
            "SELECT * FROM score_components WHERE hotspot_id=? AND hotspot_version=? ORDER BY component_name", (hotspot_id,version)
        ).fetchall():
            item = dict(row)
            item["source_ids"] = json.loads(item.pop("source_ids_json"))
            item["missing"] = bool(item["missing"])
            components.append(item)
        return hotspot, components

    def get_evidence(self, hotspot_id: str) -> Optional[dict[str, Any]]:
        row = self.connection.execute(
            "SELECT bundle_json FROM evidence_bundles WHERE hotspot_id=? ORDER BY bundle_version DESC LIMIT 1", (hotspot_id,)
        ).fetchone()
        return json.loads(row[0]) if row else None

    def list_hotspots(self, filters: dict[str, Any], page: int, page_size: int) -> tuple[list[dict[str, Any]], int]:
        clauses, values = [], []
        mapping = {
            "country_code": "country_code=?", "category": "category=?", "geography_id": "geography_id=?", "status": "status=?",
            "date_from": "calculation_date>=?", "date_to": "calculation_date<=?", "min_need_score": "need_score>=?",
            "min_action_score": "action_score>=?", "min_confidence": "evidence_confidence>=?",
        }
        for key, sql in mapping.items():
            if filters.get(key) is not None:
                clauses.append(sql)
                values.append(filters[key])
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        total = int(self.connection.execute("SELECT COUNT(*) FROM hotspots_daily" + where, values).fetchone()[0])
        rows = self.connection.execute(
            "SELECT * FROM hotspots_daily" + where + " ORDER BY action_score DESC,hotspot_id LIMIT ? OFFSET ?",
            (*values,page_size,(page-1)*page_size),
        ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["warnings"] = json.loads(item.pop("warnings_json"))
            result.append(item)
        return result,total

    def dataset_counts(self) -> dict[str, int]:
        tables = ["admin_units","data_sources","demographic_features","infrastructure_indices","investment_projects"]
        return {table:int(self.connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]) for table in tables}
