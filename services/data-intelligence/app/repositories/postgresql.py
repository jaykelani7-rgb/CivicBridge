from __future__ import annotations

import re
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from app.repositories.sqlite import SQLiteRepository


class _HybridRow(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            return tuple(self.values())[key]
        return super().__getitem__(key)


class _Result:
    def __init__(self, rows: list[_HybridRow], rowcount: int) -> None:
        self.rows, self.rowcount = rows, rowcount

    def fetchone(self) -> Optional[_HybridRow]:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[_HybridRow]:
        return self.rows


class _ConnectionFacade:
    """Materialized DB-API facade used by the shared repository contract."""

    def __init__(self, pool, local: threading.local) -> None:
        self.pool, self.local = pool, local
        self.total_changes = 0
        self._counter_lock = threading.Lock()

    def execute(self, sql: str, params=()) -> _Result:
        sql = self._postgres_sql(sql)
        current = getattr(self.local, "connection", None)
        if current is not None:
            return self._execute(current, sql, params)
        with self.pool.connection() as connection:
            return self._execute(connection, sql, params)

    def _execute(self, connection, sql: str, params) -> _Result:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = [_HybridRow(row) for row in cursor.fetchall()] if cursor.description else []
            changed = max(cursor.rowcount, 0)
        with self._counter_lock:
            self.total_changes += changed
        return _Result(rows, changed)

    @staticmethod
    def _postgres_sql(sql: str) -> str:
        result = sql.replace("?", "%s").replace("MAX(last_seen,%s)", "GREATEST(last_seen,%s)")
        if result.startswith("INSERT OR IGNORE INTO"):
            return result.replace("INSERT OR IGNORE INTO", "INSERT INTO", 1) + " ON CONFLICT DO NOTHING"
        if result.startswith("INSERT OR REPLACE INTO"):
            match = re.match(r"INSERT OR REPLACE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES(.*)", result, re.S)
            if not match:
                raise ValueError("Unsupported INSERT OR REPLACE statement")
            table, columns_text, values = match.groups()
            columns = [column.strip() for column in columns_text.split(",")]
            updates = ",".join(f"{column}=EXCLUDED.{column}" for column in columns if column != "id")
            return f"INSERT INTO {table} ({columns_text}) VALUES{values} ON CONFLICT (id) DO UPDATE SET {updates}"
        return result


class PostgreSQLRepository(SQLiteRepository):
    """Pooled PostgreSQL implementation of the operational repository contract."""

    def __init__(self, database_url: str, migration_path: Path, *, min_size: int = 1, max_size: int = 10) -> None:
        try:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool
        except ImportError as exc:  # pragma: no cover - exercised only with postgres extra
            raise RuntimeError("Install the data-intelligence postgres extra to use PostgreSQL.") from exc
        self._local = threading.local()
        self._pool = ConnectionPool(database_url, min_size=min_size, max_size=max_size, kwargs={"row_factory": dict_row}, open=True)
        self.connection = _ConnectionFacade(self._pool, self._local)
        self._lock = threading.RLock()
        self._run_postgresql_migrations(migration_path)

    def _run_postgresql_migrations(self, migration_path: Path) -> None:
        with self._pool.connection() as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)")
            for path in sorted(migration_path.glob("[0-9][0-9][0-9]_*.sql")):
                exists = connection.execute("SELECT 1 FROM schema_migrations WHERE version=%s", (path.name,)).fetchone()
                if exists:
                    continue
                with connection.transaction():
                    connection.execute(path.read_text(encoding="utf-8"))
                    connection.execute("INSERT INTO schema_migrations(version) VALUES(%s)", (path.name,))

    @contextmanager
    def transaction(self) -> Iterator[None]:
        if getattr(self._local, "connection", None) is not None:
            yield
            return
        with self._pool.connection() as connection:
            with connection.transaction():
                self._local.connection = connection
                try:
                    yield
                finally:
                    self._local.connection = None

    def close(self) -> None:
        self._pool.close()

    def ping(self) -> bool:
        return self.connection.execute("SELECT 1").fetchone()[0] == 1
