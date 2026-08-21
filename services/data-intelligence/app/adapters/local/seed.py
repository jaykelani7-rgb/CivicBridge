from __future__ import annotations

from pathlib import Path

from app.adapters.local.fixtures import load_fixtures
from app.config.settings import Settings
from app.repositories.sqlite import SQLiteRepository


def main() -> None:
    settings=Settings.from_env()
    service_dir=Path(__file__).resolve().parents[3]
    repository=SQLiteRepository(settings.database_path,service_dir/"migrations")
    try:
        print(load_fixtures(repository,settings.resolved_fixture_dir(),settings.country_packs))
    finally:
        repository.close()


if __name__ == "__main__":
    main()
