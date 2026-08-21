-- Replace {{PROJECT_ID}}, {{DATASET}}, and {{RAW_DATASET}} before execution.
CREATE SCHEMA IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}` OPTIONS(location="{{LOCATION}}");
CREATE SCHEMA IF NOT EXISTS `{{PROJECT_ID}}.{{RAW_DATASET}}` OPTIONS(location="{{LOCATION}}");

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.data_sources` (
  source_id STRING NOT NULL, dataset_id STRING NOT NULL, dataset_version STRING NOT NULL, snapshot_id STRING NOT NULL,
  publisher STRING NOT NULL, dataset_title STRING NOT NULL, country_code STRING NOT NULL,
  geographic_coverage STRING NOT NULL, time_coverage STRING NOT NULL, retrieved_at DATE NOT NULL,
  license STRING, source_url STRING NOT NULL, transformation_notes STRING NOT NULL, confidence FLOAT64 NOT NULL,
  freshness_status STRING NOT NULL, synthetic BOOL NOT NULL, is_current BOOL NOT NULL, ingested_at TIMESTAMP NOT NULL
) CLUSTER BY country_code,source_id,is_current;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.admin_units` (
  geography_id STRING NOT NULL, country_code STRING NOT NULL, admin1 STRING NOT NULL, admin2 STRING NOT NULL,
  locality STRING NOT NULL, centroid_lat FLOAT64 NOT NULL, centroid_lon FLOAT64 NOT NULL,
  boundary_geography GEOGRAPHY NOT NULL, aliases ARRAY<STRING> NOT NULL, boundary_source STRING NOT NULL,
  boundary_version STRING NOT NULL, source_id STRING NOT NULL, dataset_version STRING NOT NULL,
  snapshot_id STRING NOT NULL, ingested_at TIMESTAMP NOT NULL
) CLUSTER BY country_code,geography_id,boundary_version;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.demographic_features` (
  feature_id STRING NOT NULL, geography_id STRING NOT NULL, population FLOAT64,
  equity_vulnerability FLOAT64, reference_year INT64 NOT NULL, source_id STRING NOT NULL,
  dataset_version STRING NOT NULL, snapshot_id STRING NOT NULL, ingested_at TIMESTAMP NOT NULL
) CLUSTER BY geography_id,reference_year;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.infrastructure_indices` (
  feature_id STRING NOT NULL, geography_id STRING NOT NULL, category STRING NOT NULL,
  infrastructure_gap FLOAT64, existing_facility_coverage FLOAT64, reference_year INT64 NOT NULL,
  source_id STRING NOT NULL, dataset_version STRING NOT NULL, snapshot_id STRING NOT NULL,ingested_at TIMESTAMP NOT NULL
) CLUSTER BY geography_id,category,reference_year;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.investment_projects` (
  project_id STRING NOT NULL, geography_id STRING NOT NULL, category STRING NOT NULL,name STRING NOT NULL,
  status STRING NOT NULL, strategic_alignment FLOAT64,delivery_readiness FLOAT64,existing_coverage_penalty FLOAT64,
  source_id STRING NOT NULL,dataset_version STRING NOT NULL,snapshot_id STRING NOT NULL,ingested_at TIMESTAMP NOT NULL
) CLUSTER BY geography_id,category,status;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.ingestion_runs` (
  snapshot_id STRING NOT NULL,dataset_id STRING NOT NULL,dataset_version STRING NOT NULL,status STRING NOT NULL,
  error_code STRING,created_at TIMESTAMP NOT NULL,updated_at TIMESTAMP NOT NULL
) CLUSTER BY dataset_id,status;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.request_embeddings` (
  request_id STRING NOT NULL,content_hash STRING NOT NULL,embedding ARRAY<FLOAT64>,
  embedding_model STRING NOT NULL,embedding_dimension INT64 NOT NULL,canonical_text_version STRING NOT NULL,
  provider STRING NOT NULL,created_at TIMESTAMP NOT NULL
) CLUSTER BY content_hash,embedding_model,provider;

CREATE TABLE IF NOT EXISTS `{{PROJECT_ID}}.{{DATASET}}.processed_event_deliveries` (
  event_id STRING NOT NULL,event_type STRING NOT NULL,request_id STRING NOT NULL,event_version STRING NOT NULL,
  status STRING NOT NULL,claim_token STRING,error_code STRING,created_at TIMESTAMP NOT NULL,updated_at TIMESTAMP NOT NULL
) CLUSTER BY event_type,status,event_id;
