# CivicBridge Data Intelligence

Jay's Data Intelligence service converts a validated `request.normalized.v1` event into approximate administrative geography, explainable related-request candidates, an issue cluster, a hotspot, deterministic scores, and a bounded evidence bundle. It publishes `hotspot.updated.v1` only after the hotspot, score history, evidence bundle, and outbox row commit atomically.

The service owns geography resolution, public-data enrichment, duplicate candidates, clusters and membership, hotspots, Need/Action scores, evidence confidence, score versions, and evidence bundles. It does not read another service's database or own citizen media, transcription, translation, policy recommendations, approvals, projects, milestones, or impact measurements.

## Google-only service policy

This implementation does **not** use the OpenAI API, ChatGPT, Anthropic, or any other non-Google AI provider. There are no corresponding SDK dependencies, API keys, environment variables, or network calls.

The production integration points are Google services:

- Gemini, owned by the upstream AI Normalization service, supplies the validated normalized request.
- BigQuery and BigQuery GIS provide analytical enrichment and versioned boundary containment.
- Google Cloud Pub/Sub transports `request.normalized.v1` and `hotspot.updated.v1`.
- The container is suitable for Google Cloud Run.

Local SQLite and the in-memory publisher are credential-free test/demo adapters only; they do not call an external vendor. “OpenAPI” below is the vendor-neutral HTTP API-description standard exposed by FastAPI and is unrelated to OpenAI.

### Priority 1 production data adapters

Priority 1 is implemented incrementally; the working local MVP is unchanged.

- `CB_MODE=local` uses SQLite fixtures, local polygon containment, and the stable rectangular grid. It imports no Google SDK and requires no credentials.
- `CB_MODE=google` keeps SQLite for operational/idempotent state while selecting the read-only BigQuery analytical repository and BigQuery GIS geography provider.
- `CB_ALLOW_LOCAL_FALLBACK=true` lets Google mode fall back to the same local enrichment and geography ports when BigQuery is unavailable or has no matching current snapshot.
- BigQuery analytical reads use only `current_*` views. Those views admit records whose source snapshot is current and `synthetic=false`.
- Official ingestion uses a versioned manifest, immutable `snapshot_id`, Cloud Storage source URI, dataset version, publisher, license, source URL, retrieval date, transformation notes, confidence, freshness, and an ingestion audit record.

The schema bootstrap, current-snapshot views, example manifest, ingestion container, and exact manual setup are documented in [docs/priority-1-google-cloud-setup.md](docs/priority-1-google-cloud-setup.md). No cloud resources are created automatically.

## Architecture and processing flow

The code follows ports and adapters:

- `app/domain`: domain errors and typed results.
- `app/schemas`: permissive-forward-compatible input and strict output Pydantic contracts.
- `app/services`: duplicate detection, scoring, evidence construction, outbox dispatch, and the pipeline.
- `app/repositories`: indexed SQLite operational store for local/demo and hackathon use.
- `app/adapters/local`: deterministic fixture loader.
- `app/adapters/geospatial`: polygon containment, distance, gazetteer matching, and stable grid fallback.
- `app/adapters/bigquery`: optional parameterized BigQuery and BigQuery GIS production reads.
- `app/adapters/pubsub`: in-memory test publisher and optional Google Pub/Sub publisher/subscriber.
- `app/workers`: adapter-neutral normalized-event consumer.

```text
validate → resolve geography → compare candidates → assign/create cluster
         → join public evidence → aggregate hotspot → calculate scores
         → hash evidence bundle → commit version + outbox → publish event
```

One SQLite `BEGIN IMMEDIATE` transaction protects event idempotency, membership, aggregate, score history, evidence, and outbox creation. A duplicate completed `event_id` returns the stored entity and cannot increment counts or publish a conflicting event. Retry is allowed only for the explicitly retryable error codes. Outbox delivery is at-least-once; downstream consumers must also deduplicate by event ID.

## Local setup

Python 3.9 or newer is supported.

```bash
cd services/data-intelligence
python3 -m venv .venv
.venv/bin/python -m pip install '.[test]'
cp .env.example .env
# For credential-free local mode, set SIMILARITY_PROVIDER=lexical in .env.
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload --env-file .env
```

OpenAPI is exposed at `http://localhost:8080/docs` and `http://localhost:8080/openapi.json`.

Fixtures load automatically at startup and are safe to rerun. To load them explicitly:

```bash
CB_FIXTURE_DIR=./fixtures .venv/bin/python -m app.adapters.local.seed
```

The country packs provide two administrative areas per country, versioned boundary metadata, demographics, infrastructure/service-access and equity indicators, a plan example, and one related-report seed cluster. All synthetic values are labeled `synthetic: true` with transformation notes and must not be represented as official statistics.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/internal/v1/intelligence/requests/{request_id}/process` | Process or safely replay one normalized event |
| `POST` | `/pubsub/request-normalized` | Receive authenticated Pub/Sub push delivery for `request.normalized.v1` |
| `GET` | `/v1/hotspots` | Paginated/filterable hotspot list |
| `GET` | `/v1/hotspots/{hotspot_id}` | Current aggregate, geography, confidence, and warnings |
| `GET` | `/v1/hotspots/{hotspot_id}/evidence` | Immutable bounded evidence bundle |
| `GET` | `/v1/hotspots/{hotspot_id}/score` | Every raw/normalized component, weight, contribution, source, fallback, and confidence |
| `POST` | `/internal/v1/hotspots/{hotspot_id}/recalculate` | Append a score/hotspot/evidence version; requires `Idempotency-Key` |
| `GET` | `/health` | Runtime, storage, event bus, analytical data, fixture, and score-version health |

List filters are `country_code`, `category`, `geography_id`, `date_from`, `date_to`, `min_need_score`, `min_action_score`, `min_confidence`, `status`, `page`, and `page_size`.

### Process a normalized request

Shreyank should publish the contract envelope to the configured `request.normalized.v1` subscription. For local HTTP integration, send the same envelope directly (not wrapped in another object):

```bash
curl -X POST http://localhost:8080/internal/v1/intelligence/requests/84b50f3f-52c9-4ac5-bef0-03cc1ea43168/process \
  -H 'Content-Type: application/json' \
  -d '{
    "event_id":"b514d49e-34bb-46fa-a10c-919721e528d1",
    "event_type":"request.normalized.v1",
    "schema_version":"1.0.0",
    "occurred_at":"2026-08-20T10:30:00Z",
    "producer":"ai-normalization",
    "trace_id":"b96b5e2f-36e5-4d38-b490-794ad64d0198",
    "data":{
      "request_id":"84b50f3f-52c9-4ac5-bef0-03cc1ea43168",
      "country_code":"IN","original_language":"hi-IN",
      "translation_working":"The road floods whenever it rains.",
      "category":"drainage","subcategory":"stormwater_drainage",
      "summary":"Recurring road flooding blocks access during rain in Ward 42.",
      "problem_description":"The road floods during rain.",
      "requested_outcome":"Repair roadside stormwater drainage.",
      "urgency":"high","affected_scope":"community",
      "location_mentions":["Ward 42","Jaipur"],
      "evidence_types":["voice","repeat_report"],"confidence":0.91,
      "pii_flags":["none"],"needs_human_review":false,"review_reason":null,
      "model":"configured-gemini-model","prompt_version":"normalize-1.0.0",
      "schema_version":"normalized-request-1.0.0"
    }
  }'
```

Exact household coordinates and raw PII fields are rejected or kept out of analytical outputs. Requests flagged for review, below the safe confidence rule, or with ambiguous geography return `pending_review` and never enter an active hotspot.

### Pub/Sub push delivery on Cloud Run

The existing `data-intelligence-normalized` subscription should push messages from the
`request-normalized-v1` topic to:

```text
https://YOUR_CLOUD_RUN_SERVICE_URL/pubsub/request-normalized
```

The route accepts the standard wrapped Pub/Sub envelope, strictly decodes `message.data` as Base64 JSON,
validates `request.normalized.v1`, and delegates to the same `NormalizedRequestConsumer` and transactional pipeline
used by local HTTP and pull delivery. It returns `204` only after processing commits. Malformed deliveries receive
`400`; retryable dependency failures receive `503`; unexpected internal failures receive `500`. Repeated `event_id`
values replay the stored result without duplicating embeddings, cluster members, hotspots, or outbox events.
In production, set `CB_IDEMPOTENCY_BACKEND=bigquery` with `CB_BIGQUERY_PROJECT` and `CB_BIGQUERY_DATASET`.
The durable `processed_event_deliveries` ledger stores only safe identifiers, version, status, claim token, and
timestamps; it never stores the Pub/Sub payload or citizen text. Local mode keeps transactional SQLite idempotency.

Cloud Run should require authentication. Configure Pub/Sub push authentication with a dedicated Google-managed or
user-managed runtime identity and an OIDC audience matching the Cloud Run service URL. Grant that identity
`roles/run.invoker`; the Pub/Sub service agent must be allowed to mint an OIDC token for it. No custom shared secret,
Gemini API key, or service-account JSON key is needed. With the service and identity already created, the relevant
configuration is equivalent to:

```bash
gcloud run services add-iam-policy-binding DATA_INTELLIGENCE_SERVICE \
  --region=us-central1 \
  --member="serviceAccount:PUBSUB_PUSH_SERVICE_ACCOUNT" \
  --role="roles/run.invoker"

gcloud pubsub subscriptions modify-push-config data-intelligence-normalized \
  --push-endpoint="https://YOUR_CLOUD_RUN_SERVICE_URL/pubsub/request-normalized" \
  --push-auth-service-account="PUBSUB_PUSH_SERVICE_ACCOUNT" \
  --push-auth-token-audience="https://YOUR_CLOUD_RUN_SERVICE_URL"
```

Keep the existing subscription retry/dead-letter policy enabled. Cloud Run validates the OIDC token before the
request reaches FastAPI; the application endpoint intentionally does not implement a second secret mechanism.

Run the push adapter tests locally without Google Cloud credentials:

```bash
cd services/data-intelligence
SIMILARITY_PROVIDER=lexical .venv/bin/pytest -q tests/integration/test_pubsub_push.py
```

### Query results

```bash
curl 'http://localhost:8080/v1/hotspots?country_code=IN&category=drainage&page=1&page_size=20'
curl http://localhost:8080/v1/hotspots/HOTSPOT_ID/score
curl http://localhost:8080/v1/hotspots/HOTSPOT_ID/evidence
curl -X POST http://localhost:8080/internal/v1/hotspots/HOTSPOT_ID/recalculate \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: approved-refresh-001' \
  -d '{"reason":"Approved dataset refresh","requested_score_version":"priority-1.0.0","trace_id":"b96b5e2f-36e5-4d38-b490-794ad64d0198"}'
```

Sharmad should consume `hotspot.updated.v1`, deduplicate by `event_id`, use `evidence_bundle_id` from the event, and fetch `GET /v1/hotspots/{hotspot_id}/evidence`. The bundle is a bounded immutable snapshot; it contains source IDs and limitations and intentionally provides no unrestricted database or citizen-media access. `GET .../score` is available for a full deterministic explanation.

## Duplicate detection

### Vertex AI semantic embeddings

Duplicate similarity is selected through a `SimilarityProvider` port. `VertexEmbeddingProvider` uses the official
`google-genai` SDK with Vertex AI, `gemini-embedding-001`, the stable `v1` API, 768 output dimensions, deterministic
batch splitting, request timeouts, and bounded transient-only retry backoff. `LexicalSimilarityProvider` remains an
independently usable, credential-free implementation and is the explicit degraded fallback.

Canonical embedding text has a versioned stable field order: country, approximate administrative area, category,
subcategory, normalized summary, problem description, and requested outcome. Missing fields are omitted, whitespace
is normalized, direct contact details are redacted, and request IDs, timestamps, exact addresses, authentication IDs,
and messaging IDs are excluded. The SHA-256 cache key includes canonical text, canonical version, model, and dimension.
SQLite stores cached embedding records in local mode; Google mode uses the existing BigQuery analytical repository's
`request_embeddings` table with SQLite continuity fallback. Both persist provider/model/version metadata associated
with each similarity result, so unchanged content is not sent to Vertex again. No BigQuery vector index is created for
the current hackathon-sized candidate set; candidate filtering remains bounded by country, category, time, and distance.

Semantic cosine scores are classified as `probable_duplicate` at `>= 0.88`, `related_request` at `>= 0.78`, and
`separate_request` below `0.78`. These initial values require calibration against realistic multilingual CivicBridge
evaluation data. The existing explainable combined duplicate score, spatial/temporal/taxonomy components, and
`auto_attach`/`manual_review`/`separate` contract remain unchanged.

If Vertex fails, permanent errors are not retried; transient rate-limit, timeout, network, gateway, or availability
errors receive bounded retries. A structured warning then records lexical fallback without logging submissions,
vectors, credentials, or tokens. Processing continues and both the API response and persisted candidate identify the
provider/model actually used and `degraded_similarity=true`.

Candidate retrieval is restricted to the same country and category, the configured time window, and configured distance. The versioned local method calculates:

```text
0.50 × semantic similarity
+ 0.25 × spatial similarity
+ 0.15 × temporal similarity
+ 0.10 × taxonomy similarity
```

The semantic component combines token Jaccard and sequence similarity for the summary plus requested outcome. Every candidate returns all components, distance, time difference, reason, and suggested action. `>= 0.85` may auto-attach when geography confidence is adequate; `0.65–0.85` is returned for manual review and is never auto-merged; lower scores remain separate. Thresholds, radius, and window are environment configuration rather than business-logic constants.

## Scoring (`priority-1.0.0`)

The immutable JSON configuration is `app/config/scoring/priority-1.0.0.json`.

```text
Need = .25 DemandRate + .20 InfrastructureGap + .15 Severity
     + .15 EquityVulnerability + .10 AffectedPopulation
     + .10 RecentTrend + .05 EvidenceConfidence

Action = .60 Need + .20 StrategicAlignment + .10 DeliveryReadiness
       + .10 DataConfidence - ExistingCoveragePenalty
```

Every input is normalized to `0–100`; scores are clamped to that range. Demand uses validated unique requests per 10,000 people. Severity uses an 80% mean plus a controlled 20% maximum. Population and rate use versioned country/category-compatible caps for this MVP. Trend requires 30 days of cluster history. Evidence confidence combines request confidence, location confidence, completeness, freshness, source reliability, and corroboration.

Missing values never silently become zero or perfect. The configuration supplies documented neutral/conservative fallbacks, each score component records `missing`, `fallback_used`, and a warning, and evidence/data confidence is reduced by 0.10 per missing scoring component. The same inputs, timestamp, and score version produce the same component results and scores. Gemini does not calculate or override scores.

## Storage models

`migrations/001_initial.sql` creates:

- `processed_events`, `review_requests`, and `outbox_events` for idempotency/retry/review/event delivery.
- `admin_units`, `data_sources`, `demographic_features`, `infrastructure_indices`, and `investment_projects` for versioned sourced enrichment.
- `issue_clusters`, `cluster_members`, `cluster_audit`, and `duplicate_candidates` for membership and explainability.
- `hotspots_daily`, `score_components`, `hotspot_versions`, and `evidence_bundles` for current reads plus immutable history.

Indexes cover event/request IDs, country, geography, category, spatial cell, dates, hotspot IDs, scores, score versions, and unpublished outbox events.

## Environment variables

All values and descriptions are in `.env.example`:

- Runtime: `CB_ENV`, `CB_SERVICE_PORT`, `CB_LOG_LEVEL`.
- Mode/storage: `CB_MODE`, `CB_STORAGE_BACKEND`, `CB_ANALYTICAL_BACKEND`, `CB_DATABASE_PATH`, `CB_FIXTURE_DIR`.
- Geography: `CB_GEOGRAPHY_PROVIDER`, `CB_ALLOW_LOCAL_FALLBACK`, `CB_COUNTRY_PACKS`, `CB_GRID_RESOLUTION`.
- Duplicate matching: `CB_DUPLICATE_DISTANCE_KM`, `CB_DUPLICATE_TIME_WINDOW_DAYS`, `CB_DUPLICATE_HIGH_THRESHOLD`, `CB_DUPLICATE_REVIEW_THRESHOLD`.
- Scoring/API: `CB_SCORE_VERSION`, `CB_DEFAULT_PAGE_SIZE`, `CB_MAX_PAGE_SIZE`.
- BigQuery: `CB_BIGQUERY_PROJECT`, `CB_BIGQUERY_DATASET`, `CB_BIGQUERY_RAW_DATASET`, `CB_BIGQUERY_LOCATION`, `CB_BIGQUERY_S2_LEVEL`.
- Events: `CB_EVENT_BUS`, `CB_PUBSUB_PROJECT`, `CB_PUBSUB_TOPIC`, `CB_PUBSUB_SUBSCRIPTION`,
  `CB_IDEMPOTENCY_BACKEND`.
- Similarity: `SIMILARITY_PROVIDER`, `VERTEX_EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`,
  `DUPLICATE_SIMILARITY_THRESHOLD`, `RELATED_SIMILARITY_THRESHOLD`, timeout/retry/batch limits.
- Vertex runtime: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `RUN_VERTEX_INTEGRATION_TESTS`.

Production configuration fails at startup if a selected BigQuery or Pub/Sub dependency lacks required identifiers. Install `.[production]` for Google Cloud SDKs. BigQuery reads use named query parameters and GIS uses `ST_COVERS(..., ST_GEOGPOINT(...))` against versioned boundaries. The transactional operational store remains separate from analytical BigQuery reads. In Cloud Run, enable the BigQuery delivery ledger because SQLite files are ephemeral. Cluster, hotspot, evidence, and outbox records still use SQLite in this release and remain a documented production limitation until a supported durable operational repository is introduced; BigQuery is not treated as a full transactional replacement for Cloud SQL.

Vertex mode also fails startup with an actionable error when project, location, model, dimension, timeout, batch size,
or thresholds are invalid. Local development authenticates with:

```bash
gcloud auth application-default login
```

No Gemini API key or service-account JSON key is required or supported. Cloud Run should use its attached runtime
service account with `roles/aiplatform.user`; set the environment variables on the Cloud Run service and do not mount
credential files. For fully offline development, set `SIMILARITY_PROVIDER=lexical`.

## Tests and Docker

```bash
.venv/bin/pytest
.venv/bin/pytest --cov=app --cov-report=term-missing
SIMILARITY_PROVIDER=lexical .venv/bin/python -m app.adapters.similarity.smoke
RUN_VERTEX_INTEGRATION_TESTS=true \
  GOOGLE_CLOUD_PROJECT=YOUR_PROJECT GOOGLE_CLOUD_LOCATION=us-central1 \
  SIMILARITY_PROVIDER=vertex .venv/bin/pytest tests/integration/test_vertex_live.py
docker build -t civicbridge-data-intelligence .
docker run --rm -p 8080:8080 civicbridge-data-intelligence
```

The suite covers schema/contract compatibility, polygon containment, stable cells, distances, explainable duplicate components/thresholds, cluster assignment, event and membership idempotency, every score output and formula, missing-data confidence, evidence hashing and PII masking, fixture provenance/reruns, APIs and pagination, dependency health, mocked BigQuery GIS, output-event consumption, recalculation history, and end-to-end India/Brazil/South Africa flows. No paid credentials are required.

The offline smoke command prints only provider, model, dimension, two scores, degraded status, and the assertion that
the two water reports are more similar than the road report. The live integration test is skipped unless
`RUN_VERTEX_INTEGRATION_TESTS=true`; it uses Application Default Credentials and never accepts an API key or key file.

## Known limitations and integration risks

- Local semantic similarity is lexical and multilingual only where normalized summaries retain comparable terms; Vertex AI text embeddings can replace it behind the detector boundary after team approval and evaluation.
- The local grid is a stable rectangular privacy-preserving fallback, not H3. BigQuery may provide a precomputed H3 or approved administrative spatial cell.
- Demo boundaries are deliberately small fixture polygons. Production requires authoritative, licensed, versioned boundary tables.
- Fixture public-data values are synthetic and explicitly labeled. Production BigQuery tables must preserve the normalized source fields used here.
- SQLite is appropriate for a hackathon/local operational store. A production deployment should move operational idempotency/outbox writes to a managed transactional database; BigQuery is intentionally used for analytical reads, not transactional membership updates.
- Outbox dispatch retries on later processing or an external scheduled dispatcher; a production worker should continuously drain it and use Pub/Sub dead-letter policies.
- Authentication/authorization and edge rate limiting are deployment concerns and are not implemented in this isolated service.
