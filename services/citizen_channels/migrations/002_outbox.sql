CREATE TABLE IF NOT EXISTS outbox_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, published_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events(published_at,created_at);
CREATE TABLE IF NOT EXISTS citizen_inbound_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, received_at TEXT NOT NULL, applied_at TEXT);
CREATE INDEX IF NOT EXISTS citizen_inbound_events_pending_idx ON citizen_inbound_events(applied_at);
