ALTER TABLE data_sources ADD COLUMN classification TEXT NOT NULL DEFAULT 'unclassified';
ALTER TABLE data_sources ADD COLUMN dataset_version TEXT;
ALTER TABLE data_sources ADD COLUMN public_url TEXT;
ALTER TABLE data_sources ADD COLUMN upstream_source_ids_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE cluster_members ADD COLUMN group_relationship TEXT NOT NULL DEFAULT 'distinct_theme';

ALTER TABLE normalized_requests ADD COLUMN original_language TEXT;
ALTER TABLE normalized_requests ADD COLUMN working_language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE normalized_requests ADD COLUMN anonymized_original_summary TEXT;
ALTER TABLE normalized_requests ADD COLUMN translation_performed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE normalized_requests ADD COLUMN translation_provider TEXT;
ALTER TABLE normalized_requests ADD COLUMN evidence_types_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE normalized_requests ADD COLUMN pii_flags_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_hotspots_priority_scope
  ON hotspots_daily(country_code, category, status, action_score, evidence_confidence, request_count, calculated_at);
