CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL,
  result_entity_id TEXT, status TEXT NOT NULL, error_code TEXT, trace_id TEXT NOT NULL
);
CREATE TABLE admin_units (
  geography_id TEXT PRIMARY KEY, country_code TEXT NOT NULL, admin1 TEXT NOT NULL, admin2 TEXT NOT NULL,
  locality TEXT NOT NULL, centroid_lat DOUBLE PRECISION NOT NULL, centroid_lon DOUBLE PRECISION NOT NULL,
  polygon_json TEXT NOT NULL, aliases_json TEXT NOT NULL, boundary_source TEXT NOT NULL, boundary_version TEXT NOT NULL
);
CREATE TABLE data_sources (
  source_id TEXT PRIMARY KEY, publisher TEXT NOT NULL, dataset_title TEXT NOT NULL, country_code TEXT NOT NULL,
  geographic_coverage TEXT NOT NULL, time_coverage TEXT NOT NULL, retrieved_at TEXT NOT NULL, license TEXT,
  transformation_notes TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL, freshness_status TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0,1))
);
CREATE TABLE demographic_features (
  feature_id TEXT PRIMARY KEY, geography_id TEXT NOT NULL REFERENCES admin_units(geography_id), population DOUBLE PRECISION,
  equity_vulnerability DOUBLE PRECISION, reference_year INTEGER NOT NULL, source_id TEXT NOT NULL REFERENCES data_sources(source_id)
);
CREATE TABLE infrastructure_indices (
  feature_id TEXT PRIMARY KEY, geography_id TEXT NOT NULL REFERENCES admin_units(geography_id), category TEXT NOT NULL,
  infrastructure_gap DOUBLE PRECISION, existing_facility_coverage DOUBLE PRECISION, reference_year INTEGER NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(source_id)
);
CREATE TABLE investment_projects (
  project_id TEXT PRIMARY KEY, geography_id TEXT NOT NULL REFERENCES admin_units(geography_id), category TEXT NOT NULL,
  name TEXT NOT NULL, status TEXT NOT NULL, strategic_alignment DOUBLE PRECISION, delivery_readiness DOUBLE PRECISION,
  existing_coverage_penalty DOUBLE PRECISION, source_id TEXT NOT NULL REFERENCES data_sources(source_id)
);
CREATE TABLE issue_clusters (
  cluster_id TEXT PRIMARY KEY, country_code TEXT NOT NULL, geography_id TEXT NOT NULL REFERENCES admin_units(geography_id),
  spatial_cell TEXT NOT NULL, category TEXT NOT NULL, subcategory TEXT, canonical_summary TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL, last_seen TIMESTAMPTZ NOT NULL, unique_request_count INTEGER NOT NULL,
  corroboration_count INTEGER NOT NULL, cluster_status TEXT NOT NULL, duplicate_method TEXT NOT NULL,
  cluster_version INTEGER NOT NULL, centroid_lat DOUBLE PRECISION NOT NULL, centroid_lon DOUBLE PRECISION NOT NULL
);
CREATE TABLE cluster_members (
  request_id TEXT PRIMARY KEY, cluster_id TEXT NOT NULL REFERENCES issue_clusters(cluster_id), event_id TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL, requested_outcome TEXT NOT NULL, urgency TEXT NOT NULL, request_confidence DOUBLE PRECISION NOT NULL,
  location_confidence DOUBLE PRECISION NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  evidence_refs_json TEXT NOT NULL, UNIQUE(cluster_id, request_id)
);
CREATE TABLE cluster_audit (
  audit_id TEXT PRIMARY KEY, request_id TEXT NOT NULL, from_cluster_id TEXT, to_cluster_id TEXT NOT NULL REFERENCES issue_clusters(cluster_id),
  reason TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL, trace_id TEXT NOT NULL
);
CREATE TABLE duplicate_candidates (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL, candidate_request_id TEXT NOT NULL, candidate_cluster_id TEXT NOT NULL REFERENCES issue_clusters(cluster_id),
  final_similarity DOUBLE PRECISION NOT NULL, semantic_similarity DOUBLE PRECISION NOT NULL, spatial_similarity DOUBLE PRECISION NOT NULL,
  temporal_similarity DOUBLE PRECISION NOT NULL, taxonomy_similarity DOUBLE PRECISION NOT NULL, distance_km DOUBLE PRECISION NOT NULL,
  time_difference_days DOUBLE PRECISION NOT NULL, match_reason TEXT NOT NULL, suggested_action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  similarity_classification TEXT NOT NULL DEFAULT 'separate_request', similarity_provider TEXT NOT NULL DEFAULT 'lexical',
  embedding_model TEXT NOT NULL DEFAULT 'lexical-explainable-v1', embedding_dimension INTEGER NOT NULL DEFAULT 768,
  canonical_text_version TEXT NOT NULL DEFAULT 'v1', degraded_similarity INTEGER NOT NULL DEFAULT 0 CHECK (degraded_similarity IN (0,1))
);
CREATE TABLE hotspots_daily (
  hotspot_id TEXT PRIMARY KEY, cluster_id TEXT NOT NULL UNIQUE REFERENCES issue_clusters(cluster_id), country_code TEXT NOT NULL,
  geography_id TEXT NOT NULL REFERENCES admin_units(geography_id), spatial_cell TEXT NOT NULL, category TEXT NOT NULL,
  calculation_date DATE NOT NULL, request_count INTEGER NOT NULL, unique_request_count INTEGER NOT NULL,
  corroboration_count INTEGER NOT NULL, suspected_duplicates INTEGER NOT NULL, pending_review_count INTEGER NOT NULL,
  excluded_count INTEGER NOT NULL, request_rate DOUBLE PRECISION NOT NULL, affected_population INTEGER NOT NULL,
  trend_30d DOUBLE PRECISION NOT NULL, infrastructure_gap DOUBLE PRECISION, equity_vulnerability DOUBLE PRECISION,
  evidence_confidence DOUBLE PRECISION NOT NULL, need_score DOUBLE PRECISION NOT NULL, action_score DOUBLE PRECISION NOT NULL,
  score_version TEXT NOT NULL, evidence_bundle_id TEXT, calculated_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL, warnings_json TEXT NOT NULL
);
CREATE TABLE score_components (
  id TEXT PRIMARY KEY, hotspot_id TEXT NOT NULL REFERENCES hotspots_daily(hotspot_id), hotspot_version INTEGER NOT NULL,
  component_name TEXT NOT NULL, raw_value DOUBLE PRECISION, normalized_value DOUBLE PRECISION NOT NULL, weight DOUBLE PRECISION NOT NULL,
  weighted_contribution DOUBLE PRECISION NOT NULL, source_ids_json TEXT NOT NULL, missing INTEGER NOT NULL CHECK (missing IN (0,1)),
  fallback_used DOUBLE PRECISION, component_confidence DOUBLE PRECISION NOT NULL, formula_version TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL, UNIQUE(hotspot_id, hotspot_version, component_name)
);
CREATE TABLE hotspot_versions (
  id TEXT PRIMARY KEY, hotspot_id TEXT NOT NULL REFERENCES hotspots_daily(hotspot_id), version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL, reason TEXT NOT NULL, idempotency_key TEXT, trace_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(hotspot_id,version), UNIQUE(hotspot_id,idempotency_key)
);
CREATE TABLE evidence_bundles (
  evidence_bundle_id TEXT PRIMARY KEY, hotspot_id TEXT NOT NULL REFERENCES hotspots_daily(hotspot_id), bundle_version INTEGER NOT NULL,
  bundle_json TEXT NOT NULL, bundle_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, UNIQUE(hotspot_id,bundle_version)
);
CREATE TABLE review_requests (
  request_id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, country_code TEXT NOT NULL, reason TEXT NOT NULL,
  trace_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL
);
CREATE TABLE outbox_events (
  event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, trace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE request_embeddings (
  content_hash TEXT PRIMARY KEY, request_id TEXT NOT NULL, embedding_json TEXT NOT NULL, embedding_model TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL, canonical_text_version TEXT NOT NULL, provider TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE normalized_requests (
  request_id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE REFERENCES processed_events(event_id), country_code TEXT NOT NULL,
  category TEXT NOT NULL, subcategory TEXT, summary TEXT NOT NULL, requested_outcome TEXT NOT NULL, urgency TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL, schema_version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_clusters_country_geo_category ON issue_clusters(country_code,geography_id,category);
CREATE INDEX idx_members_cluster_time ON cluster_members(cluster_id,occurred_at);
CREATE INDEX idx_duplicates_request ON duplicate_candidates(request_id);
CREATE INDEX idx_hotspots_filters ON hotspots_daily(country_code,category,geography_id,calculation_date);
CREATE INDEX idx_hotspots_scores ON hotspots_daily(need_score,action_score,evidence_confidence);
CREATE INDEX idx_score_hotspot_version ON score_components(hotspot_id,hotspot_version);
CREATE INDEX idx_outbox_unpublished ON outbox_events(published_at,created_at);
CREATE INDEX idx_embeddings_request ON request_embeddings(request_id,created_at);
CREATE INDEX idx_normalized_country_category ON normalized_requests(country_code,category,occurred_at);
