CREATE TABLE IF NOT EXISTS citizen_requests (request_id TEXT PRIMARY KEY, data_json TEXT NOT NULL, idempotency_key TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS citizen_media (media_ref TEXT PRIMARY KEY, request_id TEXT NOT NULL, storage_key TEXT NOT NULL, filename TEXT NOT NULL, media_type TEXT NOT NULL, size_bytes INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS citizen_event_receipts (event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS citizen_channel_sessions (channel_id TEXT PRIMARY KEY, data_json TEXT NOT NULL);
