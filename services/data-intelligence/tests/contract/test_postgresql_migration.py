from pathlib import Path

import pytest

from app.config.settings import Settings


MIGRATION = Path(__file__).resolve().parents[2] / "migrations" / "postgresql" / "001_initial.sql"


def test_postgresql_migration_covers_operational_contract_and_constraints():
    sql = MIGRATION.read_text(encoding="utf-8").lower()
    for table in (
        "processed_events", "normalized_requests", "request_embeddings", "duplicate_candidates",
        "issue_clusters", "cluster_members", "hotspots_daily", "score_components",
        "hotspot_versions", "evidence_bundles", "outbox_events",
    ):
        assert f"create table {table}" in sql
    assert "unique(cluster_id, request_id)" in sql
    assert "event_id text not null unique" in sql
    assert "references issue_clusters" in sql
    assert "references hotspots_daily" in sql


def test_postgresql_backend_requires_url_and_valid_pool_bounds():
    with pytest.raises(ValueError, match="CB_DATABASE_URL"):
        Settings.from_env({"CB_STORAGE_BACKEND":"postgresql"})
    settings = Settings.from_env({
        "CB_STORAGE_BACKEND":"postgresql", "CB_DATABASE_URL":"postgresql://localhost/civicbridge",
        "CB_DATABASE_POOL_MIN_SIZE":"2", "CB_DATABASE_POOL_MAX_SIZE":"8",
    })
    assert settings.storage_backend == "postgresql"
    assert settings.database_pool_min_size == 2 and settings.database_pool_max_size == 8
