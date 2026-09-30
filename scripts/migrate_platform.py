"""Apply additive CivicBridge SQL migrations to one service database."""
import argparse
import datetime
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = {
    "citizen": ROOT / "services/citizen_channels/migrations",
    "normalization": ROOT / "services/ai_normalization/migrations",
    "policy": ROOT / "services/policy_impact/migrations",
}


def migrate(service: str, database_url: str) -> list[str]:
    if service not in DIRECTORIES:
        raise ValueError(f"Unknown service: {service}")
    postgres = database_url.startswith(("postgres://", "postgresql://"))
    if not postgres:
        Path(database_url).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    if postgres:
        import psycopg
        connection = psycopg.connect(database_url)
    else:
        connection = sqlite3.connect(database_url, timeout=30)
    applied = []
    try:
        cursor = connection.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
        for migration in sorted(DIRECTORIES[service].glob("[0-9][0-9][0-9]_*.sql")):
            query = "SELECT 1 FROM schema_migrations WHERE version = %s" if postgres else "SELECT 1 FROM schema_migrations WHERE version = ?"
            if cursor.execute(query, (migration.stem,)).fetchone():
                continue
            for statement in migration.read_text().split(";"):
                if statement.strip():
                    cursor.execute(statement)
            insert = "INSERT INTO schema_migrations(version,applied_at) VALUES(%s,%s)" if postgres else "INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)"
            cursor.execute(insert, (migration.stem, datetime.datetime.now(datetime.timezone.utc).isoformat()))
            applied.append(migration.stem)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return applied


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", choices=sorted(DIRECTORIES), required=True)
    parser.add_argument("--database-url", required=True)
    arguments = parser.parse_args()
    print({"service": arguments.service, "applied": migrate(arguments.service, arguments.database_url)})


if __name__ == "__main__":
    main()
