import json
from pathlib import Path

from services.policy_impact.app.database import PolicyImpactRepository
from services.policy_impact.app.demo_baseline import FIXTURE_NAMES, SYNTHETIC_LIMITATION, restore_demo_recommendations


def test_demo_baseline_is_idempotent_and_never_fabricates_approval(tmp_path: Path):
    fixture_dir = Path(__file__).resolve().parents[1] / "packages" / "test_fixtures"
    repository = PolicyImpactRepository(str(tmp_path / "policy.db"))

    assert restore_demo_recommendations(repository, fixture_dir) == 3
    assert restore_demo_recommendations(repository, fixture_dir) == 0
    recommendations = repository.list_recommendations()

    assert len(recommendations) == 3
    assert all(item.status.value == "under_review" for item in recommendations)
    assert all(item.human_approved is False for item in recommendations)
    assert all(SYNTHETIC_LIMITATION in item.missing_information for item in recommendations)
    assert repository.list_projects() == []


def test_repository_reloads_persisted_recommendations_after_process_restart(tmp_path: Path):
    fixture_dir = Path(__file__).resolve().parents[1] / "packages" / "test_fixtures"
    database = tmp_path / "policy.db"
    first = PolicyImpactRepository(str(database))
    restore_demo_recommendations(first, fixture_dir)

    restarted = PolicyImpactRepository(str(database))
    assert {item.recommendation_id for item in restarted.list_recommendations()} == {
        json.loads((fixture_dir / name).read_text(encoding="utf-8"))["recommendation_seed"]["recommendation_id"]
        for name in FIXTURE_NAMES
    }
