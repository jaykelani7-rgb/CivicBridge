from pathlib import Path

from app.config.settings import Settings
from app.repositories.postgresql import PostgreSQLRepository
from app.repositories.sqlite import SQLiteRepository


def build_operational_repository(settings: Settings, migrations: Path):
    if settings.storage_backend == "postgresql":
        return PostgreSQLRepository(
            settings.database_url or "", migrations / "postgresql",
            min_size=settings.database_pool_min_size, max_size=settings.database_pool_max_size,
        )
    return SQLiteRepository(settings.database_path, migrations)
