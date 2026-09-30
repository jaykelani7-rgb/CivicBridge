CREATE TABLE IF NOT EXISTS outbox_events (event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, published_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events(published_at,created_at);
CREATE TABLE IF NOT EXISTS project_creation_keys (recommendation_id TEXT PRIMARY KEY, project_id TEXT NOT NULL);
INSERT INTO project_creation_keys(recommendation_id,project_id)
SELECT recommendation_id,MIN(project_id) FROM projects WHERE 1=1 GROUP BY recommendation_id
ON CONFLICT(recommendation_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS inbound_event_receipts (event_id TEXT PRIMARY KEY, recommendation_id TEXT NOT NULL, received_at TEXT NOT NULL);
