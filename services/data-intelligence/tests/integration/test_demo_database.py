from app.adapters.local.demo_database import seed_demo_hotspots


def test_demo_hotspots_rehydrate_idempotently_with_six_reports_each(app):
    fixture_dir = app.state.settings.resolved_fixture_dir()

    assert seed_demo_hotspots(app, fixture_dir) == 4
    first, first_total = app.state.repository.list_hotspots({}, 1, 100)
    assert first_total == 4
    assert {item["geography_id"] for item in first} == {
        "IN-RJ-JPR-W42",
        "IN-RJ-JPR-W18",
        "BR-SP-SAO-CAP",
        "ZA-GP-JHB-SOW",
    }
    assert all(item["request_count"] == 6 for item in first)

    assert seed_demo_hotspots(app, fixture_dir) == 4
    second, second_total = app.state.repository.list_hotspots({}, 1, 100)
    assert second_total == 4
    assert all(item["request_count"] == 6 for item in second)
