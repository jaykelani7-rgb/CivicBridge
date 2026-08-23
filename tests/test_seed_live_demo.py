from uuid import uuid4

from scripts.seed_live_demo import build_events, main


def test_seed_dry_run_is_safe_and_canonical(capsys):
    run_id = str(uuid4())
    assert main(["--run-id", run_id, "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "DRY RUN" in output and "Published" not in output
    events = build_events(run_id)
    assert len(events) == 16
    assert {event["data"]["category"] for event in events} == {"drainage", "roads", "sanitation", "water"}
    assert all(event["event_type"] == "request.normalized.v1" for event in events)


def test_seed_requires_exact_project_confirmation(capsys):
    assert main(["--run-id", str(uuid4()), "--confirm-project=wrong-project"]) == 2
    assert "must exactly equal civicbridge-1" in capsys.readouterr().err


def test_same_run_is_idempotent_and_new_run_changes_ids():
    first, second, third = build_events(str(uuid4())), None, build_events(str(uuid4()))
    second = build_events(first[0]["data"]["fixture_provenance"]["seed_run_id"])
    assert [item["event_id"] for item in first] == [item["event_id"] for item in second]
    assert [item["event_id"] for item in first] != [item["event_id"] for item in third]
