CREATE TABLE IF NOT EXISTS normalized_requests (
  request_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  summary TEXT NOT NULL,
  requested_outcome TEXT NOT NULL,
  urgency TEXT NOT NULL,
  confidence REAL NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES processed_events(event_id)
);

CREATE INDEX IF NOT EXISTS idx_normalized_country_category ON normalized_requests(country_code, category, occurred_at);
