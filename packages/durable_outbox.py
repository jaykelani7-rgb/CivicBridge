"""Small SQL outbox shared by Citizen, Normalization, and Policy services.

The business row and envelope must be inserted with the same connection before
commit. Dispatch is at least once: a crash after publish may resend the same
stable event ID, so consumers must also be idempotent.
"""
import datetime
import asyncio
import inspect
import json
from typing import Any, Callable

from packages.contracts.envelope import EventEnvelope


def _sql(statement: str, postgres: bool) -> str:
    return statement.replace("?", "%s") if postgres else statement


def ensure_outbox(cursor: Any) -> None:
    cursor.execute("""CREATE TABLE IF NOT EXISTS outbox_events (
        event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL, published_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
    )""")
    cursor.execute("CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events(published_at,created_at)")


def enqueue(cursor: Any, event: EventEnvelope, postgres: bool) -> None:
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute(_sql("""INSERT INTO outbox_events(event_id,event_type,payload_json,created_at)
        VALUES(?,?,?,?) ON CONFLICT(event_id) DO NOTHING""", postgres),
        (event.event_id, event.event_type, json.dumps(event.model_dump(mode="json")), now))


def dispatch(connect: Callable[[], Any], postgres: bool, publisher: Any, limit: int = 100) -> list[str]:
    """Publish pending envelopes with stable IDs; leave failures pending."""
    if inspect.iscoroutinefunction(publisher.publish):
        raise TypeError("Durable outbox publisher must confirm delivery synchronously")
    connection = connect()
    published: list[str] = []
    try:
        if not postgres:
            connection.execute("BEGIN IMMEDIATE")
        query = "SELECT event_id,payload_json FROM outbox_events WHERE published_at IS NULL ORDER BY created_at,event_id LIMIT ?"
        if postgres:
            query = "SELECT event_id,payload_json FROM outbox_events WHERE published_at IS NULL ORDER BY created_at,event_id FOR UPDATE SKIP LOCKED LIMIT %s"
        rows = connection.cursor().execute(query, (limit,)).fetchall()
        for event_id, payload in rows:
            event = EventEnvelope.model_validate(json.loads(payload))
            try:
                publisher.publish(event)
            except Exception as error:
                connection.cursor().execute(_sql("UPDATE outbox_events SET attempts=attempts+1,last_error=? WHERE event_id=?", postgres), (str(error)[:300], event_id))
                connection.commit()
                raise
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            connection.cursor().execute(_sql("UPDATE outbox_events SET published_at=?,attempts=attempts+1,last_error=NULL WHERE event_id=?", postgres), (now, event_id))
            published.append(event_id)
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    return published


def pending_count(connect: Callable[[], Any]) -> int:
    connection = connect()
    try:
        return int(connection.cursor().execute("SELECT COUNT(*) FROM outbox_events WHERE published_at IS NULL").fetchone()[0])
    finally:
        connection.close()


async def poll_forever(callback: Callable[[], Any], logger: Any, interval_seconds: float = 5.0) -> None:
    """Keep retrying committed events while the service is running."""
    while True:
        try:
            if inspect.iscoroutinefunction(callback):
                await asyncio.to_thread(lambda: asyncio.run(callback()))
            else:
                await asyncio.to_thread(callback)
        except Exception:
            logger.exception("Outbox retry failed; committed events remain pending")
        await asyncio.sleep(interval_seconds)
