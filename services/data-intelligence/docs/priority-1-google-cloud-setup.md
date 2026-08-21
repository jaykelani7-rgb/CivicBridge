# Priority 1: Google Cloud data setup

This runbook is intentionally manual. The repository does not provision, mutate, or delete Google Cloud resources. Run only the commands you have reviewed in a project you control.

Priority 1 keeps SQLite as the operational store. BigQuery is read-only during request processing and is used for official analytical snapshots and BigQuery GIS. The local fixtures, polygon resolver, rectangular grid, and synchronous API remain available without Google Cloud credentials.

## 1. Choose names

Run these in your own terminal and replace every example value:

```bash
export PROJECT_ID="your-google-cloud-project"
export REGION="asia-south1"
export BQ_LOCATION="asia-south1"
export DATASET="civicbridge_intelligence"
export RAW_DATASET="civicbridge_intelligence_raw"
export DATA_BUCKET="your-globally-unique-versioned-data-bucket"
export RUNTIME_SA="civicbridge-intelligence-runtime"
export INGEST_SA="civicbridge-intelligence-ingest"
```

BigQuery datasets participating in a query must use compatible locations. Do not mix `US`, `EU`, and regional datasets.

## 2. Authenticate locally without key files

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project "$PROJECT_ID"
```

Application Default Credentials are for local development. Do not download or commit service-account JSON keys.

## 3. Enable the required APIs

```bash
gcloud services enable \
  bigquery.googleapis.com \
  bigquerystorage.googleapis.com \
  storage.googleapis.com
```

Vertex AI and Pub/Sub are deliberately not required for Priority 1.

## 4. Create service accounts

```bash
gcloud iam service-accounts create "$RUNTIME_SA" \
  --display-name="CivicBridge Data Intelligence runtime"

gcloud iam service-accounts create "$INGEST_SA" \
  --display-name="CivicBridge official dataset ingestion"
```

Grant project-level job execution only:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${INGEST_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"
```

After creating the datasets in the next step, use BigQuery dataset sharing in the Google Cloud console:

- Give the runtime service account `BigQuery Data Viewer` on `$DATASET` only.
- Give the ingestion service account `BigQuery Data Editor` on `$DATASET` and `$RAW_DATASET` only.
- Do not grant the runtime identity write access.

## 5. Render and review the BigQuery schema

From `services/data-intelligence/`:

```bash
sed \
  -e "s/{{PROJECT_ID}}/${PROJECT_ID}/g" \
  -e "s/{{DATASET}}/${DATASET}/g" \
  -e "s/{{RAW_DATASET}}/${RAW_DATASET}/g" \
  -e "s/{{LOCATION}}/${BQ_LOCATION}/g" \
  app/adapters/bigquery/sql/schema.sql \
  > /tmp/civicbridge-bigquery-schema.sql

sed \
  -e "s/{{PROJECT_ID}}/${PROJECT_ID}/g" \
  -e "s/{{DATASET}}/${DATASET}/g" \
  app/adapters/bigquery/sql/official_dataset_views.sql \
  > /tmp/civicbridge-bigquery-views.sql

less /tmp/civicbridge-bigquery-schema.sql
less /tmp/civicbridge-bigquery-views.sql
```

After reviewing them, execute:

```bash
bq query --location="$BQ_LOCATION" --use_legacy_sql=false < /tmp/civicbridge-bigquery-schema.sql
bq query --location="$BQ_LOCATION" --use_legacy_sql=false < /tmp/civicbridge-bigquery-views.sql
```

The `current_*` views exclude synthetic and superseded snapshots.

## 6. Create a versioned raw-data bucket

```bash
gcloud storage buckets create "gs://${DATA_BUCKET}" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access

gcloud storage buckets update "gs://${DATA_BUCKET}" --versioning

gcloud storage buckets add-iam-policy-binding "gs://${DATA_BUCKET}" \
  --member="serviceAccount:${INGEST_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

Upload permission should belong to a separate approved data-preparation identity or operator, not to the read-only runtime service account.

## 7. Prepare normalized official assets

Download official data only through the publisher's approved channel. Preserve the untouched raw file separately, record its checksum, confirm the license, and transform country-specific fields into one of these normalized contracts.

### `admin_units`

```text
geography_id, country_code, admin1, admin2, locality,
centroid_lat, centroid_lon, boundary_wkt, aliases
```

`boundary_wkt` must be WGS84 polygon or multipolygon WKT. `aliases` should be a repeated string field, so Parquet is recommended.
Include accent-preserving names plus case-folded/transliterated aliases used by the supported gazetteer, for example both `Grajaú` and `grajau`.

### `demographic_features`

```text
feature_id, geography_id, population, equity_vulnerability, reference_year
```

### `infrastructure_indices`

```text
feature_id, geography_id, category, infrastructure_gap,
existing_facility_coverage, reference_year
```

### `investment_projects`

```text
project_id, geography_id, category, name, status,
strategic_alignment, delivery_readiness, existing_coverage_penalty
```

Upload to an immutable version prefix:

```bash
gcloud storage cp ./demographic_features.parquet \
  "gs://${DATA_BUCKET}/india/census/2011-v1/demographic_features.parquet"
```

## 8. Create and validate a manifest

Copy the example without overwriting it:

```bash
cp datasets/manifests/examples/india-census-demo.json /tmp/india-census-2011-v1.json
```

Edit `/tmp/india-census-2011-v1.json` and verify:

- Publisher and official source URL are correct.
- License or usage restriction is recorded.
- `dataset_version` never changes for different content.
- Every URI points to your versioned bucket.
- `synthetic` remains `false` only for genuinely official data.
- Transformation notes explain code mappings, units, exclusions, and validation.

Validate through the tested Pydantic contract and show the deterministic ingestion plan:

```bash
python -m pip install '.[google-data]'

export CB_MODE="google"
export CB_STORAGE_BACKEND="sqlite"
export CB_BIGQUERY_PROJECT="$PROJECT_ID"
export CB_BIGQUERY_DATASET="$DATASET"
export CB_BIGQUERY_RAW_DATASET="$RAW_DATASET"
export CB_BIGQUERY_LOCATION="$BQ_LOCATION"
export CB_BIGQUERY_S2_LEVEL="13"

python -m app.adapters.bigquery.ingest /tmp/india-census-2011-v1.json --dry-run
```

## 9. Ingest the approved snapshot

Run this only after reviewing the dry-run plan:

```bash
python -m app.adapters.bigquery.ingest /tmp/india-census-2011-v1.json
```

The ingestion adapter:

1. Records a `running` ingestion audit.
2. Loads Cloud Storage assets into snapshot-specific staging tables.
3. Runs normalized range/key assertions.
4. Inserts records with `source_id`, dataset version, snapshot ID, and ingestion time.
5. Atomically marks the previous source snapshot non-current and the new source current.
6. Records completion or a safe failure code.

If publication of the current source record fails, the previous current snapshot remains visible through the views.

## 10. Verify provenance and boundaries

```bash
bq query --location="$BQ_LOCATION" --use_legacy_sql=false \
  "SELECT source_id,dataset_version,snapshot_id,publisher,retrieved_at,license,source_url,confidence
   FROM \`${PROJECT_ID}.${DATASET}.current_data_sources\` ORDER BY source_id"

bq query --location="$BQ_LOCATION" --use_legacy_sql=false \
  "SELECT geography_id,country_code,boundary_version,ST_ISVALID(boundary_geography) AS valid
   FROM \`${PROJECT_ID}.${DATASET}.current_admin_units\` LIMIT 20"
```

## 11. Run the API in Google mode

```bash
export CB_MODE="google"
export CB_ALLOW_LOCAL_FALLBACK="true"
export CB_EVENT_BUS="memory"
export CB_DATABASE_PATH="./data/intelligence-google-mode.db"

uvicorn app.main:app --host 0.0.0.0 --port 8080
curl --fail http://localhost:8080/health
```

Expected health metadata includes:

```json
{
  "runtime_mode":"google",
  "operational_repository":"sqlite",
  "analytical_repository":"BigQueryAnalyticalRepository",
  "geography_provider":"BigQueryGeographyProvider",
  "local_fallback_enabled":true
}
```

## 12. Confirm credential-free local fallback

In a fresh shell with no `GOOGLE_APPLICATION_CREDENTIALS` variable:

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
export CB_MODE="local"
export CB_ANALYTICAL_BACKEND="local"
export CB_GEOGRAPHY_PROVIDER="local"
export CB_EVENT_BUS="memory"

uvicorn app.main:app --host 0.0.0.0 --port 8080
```

The India, Brazil, and South Africa fixture flows must still pass:

```bash
pytest
```

## Deferred by explicit scope

- Vertex AI embeddings are Priority 2.
- Pub/Sub worker retry and dead-letter behavior are Priority 3.
- Cloud Run API/worker deployment packaging is Priority 3.
- Cloud SQL, API Gateway, and full production authentication are not part of this change.
