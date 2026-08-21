from __future__ import annotations

import json
from pathlib import Path

from app.adapters.geospatial.local import stable_grid_cell
from app.repositories.sqlite import SQLiteRepository


def load_fixtures(repository: SQLiteRepository, fixture_dir: Path, countries: tuple[str, ...]) -> dict[str, int]:
    mapping = {"IN": "india", "BR": "brazil", "ZA": "south_africa"}
    loaded = {"countries": 0, "admin_units": 0, "sources": 0, "seed_requests": 0}
    with repository.transaction():
        for code in countries:
            pack_path = fixture_dir / mapping[code] / "pack.json"
            pack = json.loads(pack_path.read_text(encoding="utf-8"))
            for row in pack["admin_units"]:
                repository.upsert_admin_unit({**row, "country_code": code})
                loaded["admin_units"] += 1
            for row in pack["sources"]:
                repository.upsert_source({**row, "country_code": code})
                loaded["sources"] += 1
            for row in pack["demographics"]:
                repository.upsert_demographic(row)
            for row in pack["infrastructure"]:
                repository.upsert_infrastructure(row)
            for row in pack["projects"]:
                repository.upsert_project(row)
            for seed in pack["seed_requests"]:
                repository.create_seed_cluster(
                    {**seed, "country_code": code},
                    stable_grid_cell(seed["latitude"], seed["longitude"], 3),
                )
                loaded["seed_requests"] += 1
            loaded["countries"] += 1
    return loaded
