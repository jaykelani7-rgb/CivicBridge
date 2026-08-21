PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  result_entity_id TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  trace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_units (
  geography_id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  admin1 TEXT NOT NULL,
  admin2 TEXT NOT NULL,
  locality TEXT NOT NULL,
  centroid_lat REAL NOT NULL,
  centroid_lon REAL NOT NULL,
  polygon_json TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  boundary_source TEXT NOT NULL,
  boundary_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
  source_id TEXT PRIMARY KEY,
  publisher TEXT NOT NULL,
  dataset_title TEXT NOT NULL,
  country_code TEXT NOT NULL,
  geographic_coverage TEXT NOT NULL,
  time_coverage TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  license TEXT,
  transformation_notes TEXT NOT NULL,
  confidence REAL NOT NULL,
  freshness_status TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS demographic_features (
  feature_id TEXT PRIMARY KEY,
  geography_id TEXT NOT NULL,
  population REAL,
  equity_vulnerability REAL,
  reference_year INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  FOREIGN KEY (geography_id) REFERENCES admin_units(geography_id),
  FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

CREATE TABLE IF NOT EXISTS infrastructure_indices (
  feature_id TEXT PRIMARY KEY,
  geography_id TEXT NOT NULL,
  category TEXT NOT NULL,
  infrastructure_gap REAL,
  existing_facility_coverage REAL,
  reference_year INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  FOREIGN KEY (geography_id) REFERENCES admin_units(geography_id),
  FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

CREATE TABLE IF NOT EXISTS investment_projects (
  project_id TEXT PRIMARY KEY,
  geography_id TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  strategic_alignment REAL,
  delivery_readiness REAL,
  existing_coverage_penalty REAL,
  source_id TEXT NOT NULL,
  FOREIGN KEY (geography_id) REFERENCES admin_units(geography_id),
  FOREIGN KEY (source_id) REFERENCES data_sources(source_id)
);

CREATE TABLE IF NOT EXISTS issue_clusters (
  cluster_id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  spatial_cell TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  canonical_summary TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  unique_request_count INTEGER NOT NULL,
  corroboration_count INTEGER NOT NULL,
  cluster_status TEXT NOT NULL,
  duplicate_method TEXT NOT NULL,
  cluster_version INTEGER NOT NULL,
  centroid_lat REAL NOT NULL,
  centroid_lon REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cluster_members (
  request_id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  requested_outcome TEXT NOT NULL,
  urgency TEXT NOT NULL,
  request_confidence REAL NOT NULL,
  location_confidence REAL NOT NULL,
  occurred_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  evidence_refs_json TEXT NOT NULL,
  FOREIGN KEY (cluster_id) REFERENCES issue_clusters(cluster_id)
);

CREATE TABLE IF NOT EXISTS cluster_audit (
  audit_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  from_cluster_id TEXT,
  to_cluster_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  trace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  candidate_request_id TEXT NOT NULL,
  candidate_cluster_id TEXT NOT NULL,
  final_similarity REAL NOT NULL,
  semantic_similarity REAL NOT NULL,
  spatial_similarity REAL NOT NULL,
  temporal_similarity REAL NOT NULL,
  taxonomy_similarity REAL NOT NULL,
  distance_km REAL NOT NULL,
  time_difference_days REAL NOT NULL,
  match_reason TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotspots_daily (
  hotspot_id TEXT PRIMARY KEY,
  cluster_id TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL,
  geography_id TEXT NOT NULL,
  spatial_cell TEXT NOT NULL,
  category TEXT NOT NULL,
  calculation_date TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  unique_request_count INTEGER NOT NULL,
  corroboration_count INTEGER NOT NULL,
  suspected_duplicates INTEGER NOT NULL,
  pending_review_count INTEGER NOT NULL,
  excluded_count INTEGER NOT NULL,
  request_rate REAL NOT NULL,
  affected_population INTEGER NOT NULL,
  trend_30d REAL NOT NULL,
  infrastructure_gap REAL,
  equity_vulnerability REAL,
  evidence_confidence REAL NOT NULL,
  need_score REAL NOT NULL,
  action_score REAL NOT NULL,
  score_version TEXT NOT NULL,
  evidence_bundle_id TEXT,
  calculated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  FOREIGN KEY (cluster_id) REFERENCES issue_clusters(cluster_id)
);

CREATE TABLE IF NOT EXISTS score_components (
  id TEXT PRIMARY KEY,
  hotspot_id TEXT NOT NULL,
  hotspot_version INTEGER NOT NULL,
  component_name TEXT NOT NULL,
  raw_value REAL,
  normalized_value REAL NOT NULL,
  weight REAL NOT NULL,
  weighted_contribution REAL NOT NULL,
  source_ids_json TEXT NOT NULL,
  missing INTEGER NOT NULL,
  fallback_used REAL,
  component_confidence REAL NOT NULL,
  formula_version TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  FOREIGN KEY (hotspot_id) REFERENCES hotspots_daily(hotspot_id)
);

CREATE TABLE IF NOT EXISTS hotspot_versions (
  id TEXT PRIMARY KEY,
  hotspot_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (hotspot_id, version),
  UNIQUE (hotspot_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS evidence_bundles (
  evidence_bundle_id TEXT PRIMARY KEY,
  hotspot_id TEXT NOT NULL,
  bundle_version INTEGER NOT NULL,
  bundle_json TEXT NOT NULL,
  bundle_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (hotspot_id, bundle_version)
);

CREATE TABLE IF NOT EXISTS review_requests (
  request_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  reason TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_country ON admin_units(country_code);
CREATE INDEX IF NOT EXISTS idx_sources_country ON data_sources(country_code);
CREATE INDEX IF NOT EXISTS idx_infra_geo_category ON infrastructure_indices(geography_id, category);
CREATE INDEX IF NOT EXISTS idx_projects_geo_category ON investment_projects(geography_id, category);
CREATE INDEX IF NOT EXISTS idx_clusters_country_geo_category ON issue_clusters(country_code, geography_id, category);
CREATE INDEX IF NOT EXISTS idx_clusters_spatial_cell ON issue_clusters(spatial_cell);
CREATE INDEX IF NOT EXISTS idx_members_cluster_time ON cluster_members(cluster_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_duplicates_request ON duplicate_candidates(request_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_filters ON hotspots_daily(country_code, category, geography_id, calculation_date);
CREATE INDEX IF NOT EXISTS idx_hotspots_scores ON hotspots_daily(need_score, action_score, evidence_confidence);
CREATE INDEX IF NOT EXISTS idx_score_hotspot_version ON score_components(hotspot_id, hotspot_version);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(published_at, created_at);
