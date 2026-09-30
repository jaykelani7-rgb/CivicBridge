# CivicBridge staging activation and live-verification runbook

This is a procedure for an **isolated staging** environment. It does not authorize deployment, paid resources, production-data access, real-user messaging, or a production cutover. The local tests and labelled fixture screenshots in [requirements-matrix.md](requirements-matrix.md) are not live-provider evidence. Choose test participants who have consented to each recording, keep their reports free of names and sensitive details, and set a deletion/retention plan before accepting their files. The country packs and current Jaipur/Cape Town indicators are **synthetic demonstrations**. Their availability permits integration tests but does not make a hotspot's external evidence official.

## Service and dependency map

| Service | Staging role and dependencies | Entry point / probe |
|---|---|---|
| Citizen Channels | Canonical intake, status, private media, Telegram; PostgreSQL, private Cloud Storage, Pub/Sub publisher; internal bytes/content requested by AI | `services.citizen_channels.main:app`, `/health`, `/v1/requests/{id}/status` |
| AI Normalization | Retrieves private citizen content/media; Speech-to-Text V2, Translation Advanced, Vertex AI; PostgreSQL, Pub/Sub publisher | `services.ai_normalization.main:app`, `/health`, `/internal/v1/normalizations/{id}` |
| Data Intelligence | Consumes normalized events, groups and scores deterministically; PostgreSQL operational store, optionally BigQuery/Vertex; Pub/Sub publisher | From `services/data-intelligence`: `app.main:app`, `/health`, `/v1/hotspots/{id}/score` |
| Policy & Impact | Retrieves Data Intelligence evidence and AI draft, persists recommendations, human decisions, projects, metrics; PostgreSQL, Pub/Sub publisher | `services.policy_impact.app.main:app`, `/health`, `/ready`, `/v1/recommendations` |
| Next.js frontend | Public intake/status and verified Firebase staff sessions; calls the four backends with runtime service URLs | `frontend`, `/api/auth/config`, `/api/auth/me` |

Use separate databases (or isolated schemas with independently validated migrations) for citizen, normalization, policy, and Data Intelligence. Frontend-to-backend calls and AI/Policy downstream calls can mint Cloud Run ID tokens using attached service identities. AI's internal media/content call additionally sends `X-Internal-Token`; keep `CITIZEN_INTERNAL_TOKEN` in a secret manager. Do not put URLs, database passwords, media URLs, or service tokens in `NEXT_PUBLIC_*` variables. The Firebase Web values are the deliberate public allowlist returned by `/api/auth/config`.

### Actual environment names by consumer

The names below are read by current code, not names of resources to create. Defaults in `.env.example`, `frontend/.env.example`, and `services/data-intelligence/.env.example` are local/demo defaults; replace them deliberately in staging. Set `ENVIRONMENT=production` for the three Python services in isolated staging to enforce their production storage/auth/mock guards. Data Intelligence uses its own `CB_ENV=production` (it has no `staging` value).

| Consumer | Required for the staging path | Conditional and purpose |
|---|---|---|
| Citizen Channels | `ENVIRONMENT`, `CITIZEN_DATABASE_URL`, `CITIZEN_MEDIA_BUCKET`, `CITIZEN_INTERNAL_TOKEN`, `CITIZEN_EVENT_BUS=pubsub`, `CITIZEN_PUBSUB_PROJECT`, `CITIZEN_REQUEST_CREATED_TOPIC`, `CITIZEN_REQUEST_CONFIRMED_TOPIC` | `PUBSUB_PUSH_AUDIENCE`, `PUBSUB_PUSH_SERVICE_ACCOUNT` for app-verified push; `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` only after website smoke succeeds. `CITIZEN_MEDIA_DIR` is for private **local** files, not a substitute for durable staging media. |
| AI Normalization | `ENVIRONMENT`, `NORMALIZATION_DATABASE_URL`, `CITIZEN_CHANNELS_URL`, `CITIZEN_INTERNAL_TOKEN`, `USE_MOCK_SERVICES=false`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `GEMINI_MODEL_NAME`, `AI_EVENT_BUS=pubsub`, `AI_PUBSUB_PROJECT`, `AI_NORMALIZED_TOPIC`, `AI_REVIEW_TOPIC` | `AI_AUTHENTICATE_CLOUD_RUN=true` when Citizen requires Cloud Run IAM; `PUBSUB_PUSH_AUDIENCE`, `PUBSUB_PUSH_SERVICE_ACCOUNT` for app-verified push; `CONFIDENCE_REVIEW_THRESHOLD`; `AI_IDEMPOTENCY_BACKEND`, `AI_BIGQUERY_DATASET` only if using the legacy BigQuery ledger route. |
| Data Intelligence | `CB_ENV`, `CB_MODE`, `CB_STORAGE_BACKEND=postgresql`, `CB_DATABASE_URL`, `CB_EVENT_BUS=pubsub`, `CB_PUBSUB_PROJECT`, `CB_PUBSUB_TOPIC`, `CB_SCORE_VERSION`, `SIMILARITY_PROVIDER` | For **synthetic staging** use `CB_MODE=local`, `CB_ANALYTICAL_BACKEND=local`, `CB_GEOGRAPHY_PROVIDER=local`, `CB_FIXTURE_DIR`, `CB_COUNTRY_PACKS`, and keep fixture labels visible. For live semantic embeddings use `SIMILARITY_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`; if BigQuery is selected, add `CB_BIGQUERY_PROJECT`, `CB_BIGQUERY_DATASET`, `CB_BIGQUERY_LOCATION`, `CB_BIGQUERY_RAW_DATASET` as applicable. `CB_IDEMPOTENCY_BACKEND=local` relies on the transactional operational repository; `bigquery` requires BigQuery datasets. `CB_DATABASE_POOL_MIN_SIZE` and `CB_DATABASE_POOL_MAX_SIZE` bound connections. |
| Policy & Impact | `ENVIRONMENT`, `POLICY_DATABASE_URL`, `ENABLE_MOCK_STUBS=false`, `SHREYANK_AI_SERVICE_URL`, `JAY_DATA_INTELLIGENCE_URL`, `POLICY_EVENT_BUS=pubsub`, `POLICY_PUBSUB_PROJECT`, `POLICY_RECOMMENDATION_TOPIC`, `POLICY_DECISION_TOPIC`, `POLICY_PROJECT_TOPIC`, `POLICY_IMPACT_TOPIC` | `POLICY_AUTHENTICATE_CLOUD_RUN=true` when AI/Data Intelligence require IAM; `GCP_PROJECT_ID`, `GCP_LOCATION`, `POLICY_IDEMPOTENCY_BACKEND`, `POLICY_BIGQUERY_DATASET` only for legacy BigQuery ledger. `DATABASE_PATH` is the SQLite fallback and should not be used in staging. |
| Frontend | `CITIZEN_CHANNELS_URL`, `AI_NORMALIZATION_URL`, `DATA_INTELLIGENCE_URL`, `POLICY_IMPACT_URL`, `FIREBASE_PROJECT_ID`, `AUTH_ORIGIN`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `FIREBASE_SESSION_MAX_AGE_SECONDS`, `CLOUD_RUN_AUTH_MODE`, `BFF_REQUEST_TIMEOUT_MS`, `NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED`. Keep `NEXT_PUBLIC_DEMO_MODE=false` for a live smoke. Maps variables are optional and unrelated to this verification. |

Set Google Application Default Credentials through an attached runtime service account. The AI identity needs access to Speech-to-Text, Translation, Vertex AI, Citizen's private service, and only the necessary Pub/Sub topics. The Citizen identity needs only its private media bucket objects and its output topics. Data Intelligence needs its operational database, selected analytics/Vertex resources, and its output topic. Policy needs AI and Data Intelligence invoker access, its database, and its output topics. The frontend identity needs backend invoker access and the Firebase session permissions listed in [frontend/README.md](../frontend/README.md). Use a separate, narrowly scoped Pub/Sub push identity per destination where feasible; grant each destination's invoker role and token-minting capability to Pub/Sub. Avoid downloaded service-account JSON keys.

The minimum external inputs for a live staging smoke are: (1) isolated PostgreSQL connection endpoints and a tested backup location for all four services; (2) a private Cloud Storage bucket and service identities/IAM; (3) existing or approved Pub/Sub topics, push subscriptions, OIDC push identities/audiences, and retry/dead-letter policy; (4) a Google Cloud project with Speech-to-Text, Translation, and Vertex AI enabled for attached runtime identities, plus an allowed `GCP_LOCATION`/model; (5) Firebase Web app config, a test user with the correct custom role, and frontend origin; (6) a consented test participant and two different audio recordings; and, only for the later Telegram phase, (7) an operator-owned bot token, webhook secret, HTTPS callback, and private test chat. Official data extracts are **not** a prerequisite for service integration; keep synthetic provenance visible.

## Database, media, migration, and recovery gate

1. Inventory staging database identifiers, schema versions, row counts, object-bucket policy, event subscriptions, and the existing backup/restore procedure. Stop or pause **staging** event delivery and writers during the schema snapshot and migration. Take consistent PostgreSQL backups under a migration identity. Keep backup files encrypted and access-restricted; they contain citizen reports and staff decisions. Test restoration to a different staging database before cutover. Never test recovery by overwriting an active database.
2. Apply the three additive migration sets with `scripts/migrate_platform.py` against **staging** URLs, one service at a time. The script records versions in `schema_migrations` and rolls back a failed migration transaction. It does not migrate Data Intelligence.
3. Data Intelligence's PostgreSQL repository applies `services/data-intelligence/migrations/postgresql/001_initial.sql` and `002_evidence_metadata.sql` through its own version ledger when instantiated. Run a controlled one-off initialization with the migration principal, then check the ledger. Current startup still checks/creates the ledger, so the runtime DB account needs sufficient DDL privileges until that is refactored. Do not run the SQL files manually and then start the repository with an empty ledger, because the files include non-idempotent DDL.
   Policy startup does not seed synthetic recommendations; `demo_baseline` is a manual/test-only fixture path. If the staging DB already contains older demo rows, keep them visibly classified and separate from new test transactions.
4. Check table existence, migration ledger, outbox/inbox rows, database read/write through a non-sensitive staging test record, and restart/reload from another instance. Policy's `project_creation_keys` reserves one canonical project per recommendation. Its migration preserves older duplicate project rows: inventory and reconcile them with their owner rather than deleting them during the schema change. Confirm that private media bytes survive service restart and are unavailable without the internal token and bucket IAM. PostgreSQL alone does not store the media bytes.
5. If migration or validation fails: leave publishers/subscriptions paused; preserve the failed DB, logs, and backup; fix forward where safe or restore into a **new** staging database and point a no-traffic revision there. Do not silently combine diverged databases. Re-enable delivery from known event IDs only after checking inbox/outbox state and duplicate behavior.

For PostgreSQL backups, prefer a protected libpq service definition (`PGSERVICE`/`PGSERVICEFILE`) or a staging migration identity that authenticates without putting a password-bearing URL in a command argument. These commands are templates; `staging_citizen`, file path, and the service definition are operator placeholders, **not** CivicBridge environment variable names:

```sh
PGSERVICE=staging_citizen pg_dump --format=custom --file='<restricted-backup-dir>/citizen-before-migration.dump'
PGSERVICE=staging_citizen psql -Atc 'SELECT version FROM schema_migrations ORDER BY version'
# Recovery drill: restore to a separate, empty quarantine database, never the active one.
PGSERVICE=staging_citizen_quarantine pg_restore --exit-on-error --no-owner \
  --dbname='<empty-staging-quarantine-database>' '<restricted-backup-dir>/citizen-before-migration.dump'
```

Repeat the snapshot, ledger check, and restore drill for normalization, policy, and Data Intelligence. A backup file existing is insufficient; compare table counts and representative redacted records after restoring. `pg_restore` targets must be reviewed for environment identity and emptiness before execution.

Example commands from the repository root, with URLs supplied through a protected environment rather than written into shell history or this file:

```sh
# Run only against isolated staging databases, after a tested backup.
python3 scripts/migrate_platform.py --service citizen --database-url "$CITIZEN_DATABASE_URL"
python3 scripts/migrate_platform.py --service normalization --database-url "$NORMALIZATION_DATABASE_URL"
python3 scripts/migrate_platform.py --service policy --database-url "$POLICY_DATABASE_URL"

# Run in a controlled migration job with CB_DATABASE_URL pointing to staging.
cd services/data-intelligence
PYTHONPATH=. python3 -c 'from pathlib import Path; from app.config.settings import Settings; from app.repositories.factory import build_operational_repository; r = build_operational_repository(Settings.from_env(), Path("migrations")); print("storage reachable:", r.ping()); r.close()'
```

The corresponding local-only SQLite migration command uses `--database-url data/citizen_channels.db` (and the other service paths) as shown in [dpg-readiness.md](dpg-readiness.md). Use `ffmpeg`/`ffprobe` in the Citizen runtime for compressed audio validation. Private staging media must use `CITIZEN_MEDIA_BUCKET` with no public object ACLs and access limited to Citizen's runtime identity. Media are retrieved by AI through Citizen's `/internal/v1/requests/{id}/media?media_ref=...` route with `X-Internal-Token`; the frontend/public status API must never expose that URL or token. Establish bucket lifecycle and report-deletion rules before accepting real participants.

Citizen, AI, Data Intelligence, and Policy retry their committed outboxes at startup and while running. A publisher error leaves the same envelope pending; a lost acknowledgement can result in duplicate delivery. Verify inbox/project idempotency and dead-letter handling. For a controlled operator drain after restoring publisher access, use the existing environment of each service and check only counts/event IDs, never payload text:

```sh
# Repository root; Citizen replay also requires Cloud Run invoker identity when private.
ID_TOKEN="$(gcloud auth print-identity-token --audiences="$CITIZEN_CHANNELS_URL")"
curl -fsS -X POST "$CITIZEN_CHANNELS_URL/internal/v1/events/replay" \
  -H "Authorization: Bearer $ID_TOKEN" -H "X-Internal-Token: $CITIZEN_INTERNAL_TOKEN"
unset ID_TOKEN
python3 -m services.ai_normalization.replay_outbox
python3 -m services.policy_impact.app.replay_outbox
(cd services/data-intelligence && PYTHONPATH=. python3 -m app.replay_outbox)

# Read-only metadata checks against an existing staging service definition.
PGSERVICE=staging_citizen psql -Atc \
  'SELECT event_type, COUNT(*) FROM outbox_events WHERE published_at IS NULL GROUP BY event_type'
PGSERVICE=staging_citizen psql -Atc \
  'SELECT event_type, COUNT(*) FROM citizen_inbound_events WHERE applied_at IS NULL GROUP BY event_type'
```

The CLI drain commands use the same `*_DATABASE_URL`, event-bus and Pub/Sub variables as their respective running services. Do not run them against production by accident. For `Data Intelligence`, the service's own working directory is required. An empty outbox only shows that publishers acknowledged delivery; it does not prove that every subscriber applied the event.

For a **local** four-process rehearsal, inject the chosen environment into each terminal, install the requirements from each canonical service, and run from the repository root unless the command changes directory. This is not a live-provider test when mocks are enabled or the event buses are `memory`:

```sh
PYTHONPATH=. uvicorn services.citizen_channels.main:app --host 127.0.0.1 --port 8000
PYTHONPATH=. uvicorn services.ai_normalization.main:app --host 127.0.0.1 --port 8001
cd services/data-intelligence && PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8002
PYTHONPATH=. uvicorn services.policy_impact.app.main:app --host 127.0.0.1 --port 8003
cd frontend && npm ci && npm run dev
```

Run each line in its own terminal and return to the repository root before starting Policy. The Data Intelligence command needs its own working directory so its `app` package and fixture paths resolve. In staging use supervised service revisions rather than a shell terminal, and do not bind private backend ports publicly.

## Event topics, identity, and routing

Use the topic names from the corresponding environment variables above; do not assume default names when inspecting an existing project. Pub/Sub is at least once: use stable `event_id` in the event envelope, verify duplicate delivery, and configure bounded retries plus dead-letter handling. This table lists the **actual current push paths**:

| Event type and publisher | Subscriber destination | Application authentication |
|---|---|---|
| `request.created.v1`, `request.confirmed.v1` — Citizen | AI `/internal/v1/events/pubsub` | `PUBSUB_PUSH_AUDIENCE` + `PUBSUB_PUSH_SERVICE_ACCOUNT` verify OIDC token; Cloud Run IAM also gates private service. |
| `request.normalized.v1` — AI | Data Intelligence `/pubsub/request-normalized`; Citizen `/internal/v1/events/pubsub` | Data Intelligence relies on Cloud Run IAM for this route. Citizen checks the two push identity variables. |
| `request.needs_review.v1` — AI | Citizen `/internal/v1/events/pubsub` | Citizen checks push identity. |
| `hotspot.updated.v1` — Data Intelligence | Policy `/pubsub/hotspot-updated`; Citizen `/internal/v1/events/pubsub` | Policy relies on Cloud Run IAM for this route. Citizen checks push identity. |
| `recommendation.created.v1`, `policy.decision.recorded.v1`, `project.status.updated.v1`, `impact.metric.updated.v1` — Policy | Citizen `/internal/v1/events/pubsub` | Citizen checks push identity. |

Each push subscription must use the destination's configured audience and identity, and the service's own topic publisher must have topic publish permission. `PUBSUB_PUSH_AUDIENCE` is a service-specific expected audience, not a single shared value for all services. Local `X-Internal-Token` fallback applies to Citizen/AI push only outside `ENVIRONMENT=production`; never depend on it for isolated staging in production mode. `CITIZEN_INTERNAL_TOKEN` still protects Citizen's private media/content route. Data Intelligence and Policy legacy `/pubsub/...` routes have no app-level OIDC verification; keep their Cloud Run services private and give only approved invoker identities access.

Before exercising a live queue, inspect each topic, subscription endpoint, OIDC audience, push identity, retry/dead-letter policy, and service invoker binding. Do not create or modify resources as part of this repository task. A Pub/Sub topic being present, a `204` from a duplicate event, or an empty dead-letter queue alone does not prove the end-to-end chain.

Read-only examples using existing names (the subscription is an operator-supplied placeholder, not a new application setting):

```sh
gcloud pubsub topics describe "$AI_NORMALIZED_TOPIC" --project="$AI_PUBSUB_PROJECT"
gcloud pubsub subscriptions describe '<request-normalized-subscription-id>' \
  --project="$AI_PUBSUB_PROJECT" \
  --format='json(topic,pushConfig,deadLetterPolicy,retryPolicy)'
```

## Readiness evidence levels

Record four separate results for each integration: **configured** (values and permissions present), **reachable** (authenticated probe or network connection), **exercised** (a unique staging transaction completed), and **recovered** (restart/retry reproduced the same result without duplication). Capture timestamps, correlation IDs, service revision, provider/model/version, and redacted logs. No secret value or raw citizen media belongs in the report.

| Probe | What it proves | What it does not prove |
|---|---|---|
| Citizen `/health` | Process is responding | Database, bucket, Pub/Sub, or Telegram reachability; use a consented staging transaction and restart to test these. |
| AI `/health` | Process responds, reports mock flag and project configuration, checks Citizen `/health` reachability | Actual private-media access or success with Google Speech, Translation, and Vertex; check the normalized record and provenance after exercising distinct audio. |
| Data Intelligence `/health` | Reports operational/analytical repository and publisher pings plus fixture-load state | Official provenance or a delivered normalized event. A loaded fixture is synthetic. |
| Policy `/health`, `/ready` | `/health` proves process liveness. `/ready` tests DB and AI/Data Intelligence health reachability and reports pending outbox count. | `/ready` deliberately sets `exercised=false`; only a grounded recommendation, human decision, project and metric in staging prove the workflow. |
| Frontend `/api/auth/config`, `/api/auth/me` | Public Firebase config validates; `/api/auth/me` verifies an existing server session or returns 401 | Staff role, navigation, and expiry are only verified after an authorized sign-in and revocation/expiry exercise. |
| Telegram `getWebhookInfo` | Bot token and webhook registration are visible to the bot operator | The webhook, consent, voice download, canonical intake, reply, and duplicate handling need a controlled private test chat. |

### Authenticated staff review gate

The local Firebase Web/Admin configuration and an authorized staff test user were not available during this repository task, so no authenticated browser session or screenshot was produced. The [desktop brief](staff-workspace/screenshots/policy-desktop.png), [desktop decision drawer](staff-workspace/screenshots/decision-desktop.png), and [mobile decision drawer](staff-workspace/screenshots/decision-mobile.png) are labelled **isolated fixtures**. Frontend unit tests and the 320/390/768/1440 px fixture browser checks cover navigation, role denial, direct-entry return paths, drawer focus/Escape and responsive width; they do not prove a real Firebase session or Cloud Run data access.

With a staging staff identity, open an authorized deep link to `/command-center` and `/csr-impact` in a fresh signed-in browser, then use every persistent staff navigation item and account sign-out. Verify a multi-role user's selector only offers authorized workspaces; verify a lower-role user receives permission-denied feedback for the restricted route. Open a real recommendation, check evidence reading width and selection/deep link at 320, 390, 768 and 1440 px, type an unsaved decision, close/reopen the drawer, submit/confirm once, and inspect the saved receipt. Revoke or expire the server session and revisit the deep link: the return destination must remain same-origin and role-approved. Capture authenticated screenshots only after these checks, with the service revision and test-record IDs noted separately.

For reachable private Cloud Run probes, use a caller identity that has `roles/run.invoker`; mint an ID token with the destination service URL as audience. Example (never print the token):

```sh
ID_TOKEN="$(gcloud auth print-identity-token --audiences="$CITIZEN_CHANNELS_URL")"
curl -fsS -H "Authorization: Bearer $ID_TOKEN" "$CITIZEN_CHANNELS_URL/health"
unset ID_TOKEN
```

Use the matching service URL for other probes. Application endpoints can still reject a caller lacking the internal token, Firebase role, or push identity even if Cloud Run IAM allows invocation.

## Ordered staging activation checklist

1. Obtain an isolated project/namespace, four staging databases, a private media bucket, dedicated runtime/push identities, topic/subscription inventory, allowed Google APIs and quotas, Firebase staging Web app and test users, consent/retention policy, and a rollback owner. No official-data import is required for this integration smoke; keep fixture provenance visible.
2. Capture tested database backups and existing event offsets/IDs. Apply the four service migration sets and verify schema ledgers. Configure private media and `ffprobe` before any voice test.
3. Configure Citizen, AI, Data Intelligence, Policy, and frontend runtime variables by consumer table. Set AI/Policy mocks off, frontend demo mode off, and keep the synthetic country pack explicitly labelled. Keep Telegram disabled until the website path passes.
4. Grant only necessary service invoker, database, bucket, provider, Firebase, and topic permissions; configure the actual push endpoints, audience, retry policy, and dead-letter handling. Probe liveness and reachability separately.
5. Run the website text/voice journey below. Inspect persisted outbox/inbox state and request/project uniqueness across restart and duplicate replay. Acknowledged writes must survive restart.
6. Enable and test Telegram in a private operator chat only after the website chain works. Do not broadcast or invite real users during smoke testing. Capture its webhook setup and `getWebhookInfo`, a text and a distinct voice intake, receipts, duplicates, and private media behavior.
7. Record the evidence-level table above, outstanding failures, and rollback decision. Leave official-data status separate; see [pilot/README.md](pilot/README.md).

## Repeatable end-to-end smoke procedure

Use staging URLs and a role-approved test staff account. For all three reports, choose one configured demonstration geography, such as `IN-RJ-JPR-W42` / `Ward 42, Jaipur`; the boundary and demographic/infrastructure/investment inputs are synthetic. Set `NEXT_PUBLIC_DEMO_MODE=false` but verify backend evidence still says `synthetic_demo`. Use a controlled participant's real recordings in two **different** utterances, each under 60 seconds and 10 MB, with consent recorded. The browser recorder's WAV output is the preferred website path; inspect actual MIME/type, bytes, duration, and a different SHA-256 digest for each file. Do not copy raw audio or transcripts into issue trackers.

1. In `/volunteer`, submit one consented text report with country `IN`, language `en-IN`, administrative area `Ward 42, Jaipur`, and an idempotency key. Save the returned `request_id` and receipt. In `/track`, verify `submitted` and later status without private text or staff notes. A shell equivalent against Citizen (direct Cloud Run invoker token required if private) is:

   ```sh
   ID_TOKEN="$(gcloud auth print-identity-token --audiences="$CITIZEN_CHANNELS_URL")"
   curl -fsS -X POST "$CITIZEN_CHANNELS_URL/v1/requests" \
     -H 'Content-Type: application/json' -H 'Idempotency-Key: <unique-text-key>' \
     -H "Authorization: Bearer $ID_TOKEN" \
     --data '{"channel":"web_text","country_code":"IN","language_hint":"en-IN","administrative_area":"Ward 42, Jaipur","consent":{"accepted":true,"version":"2026-08-01"},"text":"Stormwater flooding repeatedly blocks the road after rain."}'
   ```

2. In `/volunteer`, record two distinct consented voice reports with `hi-IN` (or another language confirmed available to Speech and Translation in the chosen provider location). Submit separately with new idempotency keys; for the second, also add written context and verify the transcript and text are both preserved. Upload each real recording; a voice request remains `awaiting_media` until valid audio arrives. A shell equivalent for each previously created voice request is `curl -fsS -X POST -H "Authorization: Bearer $ID_TOKEN" -F 'file=@<path-to-consented-recording.wav>;type=audio/wav' "$CITIZEN_CHANNELS_URL/v1/requests/<request-id>/media"`. Do not accept a canned or repeated transcript as live success. Compare hashes, transcript language/content, `speech_status=ok`, `speech_provider`, `speech_model`, `translation_status=ok`, `translation.provider`, `model`, `processing_mode`, and `fallback_used` in the private normalization record. Preserve the original transcript and English working translation. If a provider call fails, require `failed`/review state and retry through `/internal/v1/normalizations/<request-id>/retry`; record the retry attempt and do not relabel a mock as live.

   ```sh
   # Create each voice request separately; use a different key and a different recording.
   curl -fsS -X POST "$CITIZEN_CHANNELS_URL/v1/requests" \
     -H 'Content-Type: application/json' -H 'Idempotency-Key: <unique-voice-key-1>' \
     -H "Authorization: Bearer $ID_TOKEN" \
     --data '{"channel":"web_voice","country_code":"IN","language_hint":"hi-IN","administrative_area":"Ward 42, Jaipur","consent":{"accepted":true,"version":"2026-08-01"}}'
   shasum -a 256 '<recording-one.wav>' '<recording-two.wav>'
   # Inspect status without exposing private content. Re-mint ID_TOKEN for each target audience.
   curl -fsS -H "Authorization: Bearer $ID_TOKEN" \
     "$CITIZEN_CHANNELS_URL/v1/requests/<request-id>/status" \
     | jq '{request_id,processing_stage,hotspot_id,recommendation_id,project_id,outcome_status,measurement_source_type,pii_masked}'
   unset ID_TOKEN
   AI_TOKEN="$(gcloud auth print-identity-token --audiences="$AI_NORMALIZATION_URL")"
   curl -fsS -H "Authorization: Bearer $AI_TOKEN" \
     "$AI_NORMALIZATION_URL/internal/v1/normalizations/<request-id>" \
     | jq '{status,attempts,result:(.result|{processing_mode,speech_provider,speech_model,speech_status,translation_status,translation,model,prompt_version,fallback_used,needs_human_review,review_reason})}'
   unset AI_TOKEN
   ```
3. If a report lands in `/command-center` normalization review, inspect the masked reason and use the authorized review action. Approval releases the normalized event to analytics; it is not policy approval. Check that unreviewed/failed requests do not silently enter an active hotspot.
4. Confirm each accepted normalized event reaches Data Intelligence and Citizen status. Open `/v1/hotspots?country_code=IN`, then `/v1/hotspots/<hotspot-id>/score` and `/evidence`. Record `score_version`, component weights/inputs, synthetic source IDs, geographic match, limitations, and the deterministic action-score explanation. The three reports need not join one hotspot if taxonomy or location differs; do not force an assignment just to complete the smoke. Check `request_ids` in the emitted hotspot event and public `hotspot_id` relationship.

   ```sh
   DI_TOKEN="$(gcloud auth print-identity-token --audiences="$DATA_INTELLIGENCE_URL")"
   curl -fsS -H "Authorization: Bearer $DI_TOKEN" \
     "$DATA_INTELLIGENCE_URL/v1/hotspots?country_code=IN&page=1&page_size=20" \
     | jq '{pagination,items:[.items[]|{hotspot_id,category,geography_id,score_version,provenance}]}'
   curl -fsS -H "Authorization: Bearer $DI_TOKEN" \
     "$DATA_INTELLIGENCE_URL/v1/hotspots/<hotspot-id>/score" \
     | jq '{hotspot_id,score_version,need_score,action_score,components,warnings}'
   unset DI_TOKEN
   ```
5. Create/open a recommendation only for a returned hotspot/evidence-bundle pair. Check bundle identity/version, citation membership, quantitative claim traces, missing beneficiaries as “Needs assessment,” and model/provider/mode. Unsupported numbers should be rejected or flagged. In `/csr-impact`, record a reasoned human `approve_for_assessment` decision, then create one linked project candidate. A second delivery or retry for the same event/recommendation must not create another project. A decision and candidate are **not** delivered impact.
6. Record one **manual** metric on the linked project with `baseline`, `current`, `target`, `direction`, `unit`, `source_id`, `measured_at`, and methodology. Check higher/lower direction and missing/unchanged/deteriorating behavior with controlled values. Verify the citizen tracking page shows linked project and measurement progress without private notes, raw audio, or a causal-impact claim.
7. In an isolated staging revision, deliberately fault-inject a **publisher failure** after the domain transaction commits (pausing a subscriber alone does not create this crash window). Verify a pending durable outbox row remains, terminate/restart the producer, restore publisher access, and run its replay/drain path. The stable event ID must be published once logically, with duplicates safely acknowledged; physical Pub/Sub deliveries can repeat. Redeliver the same envelope and reverse-order older status event. Check project row count, recommendation linkage, and citizen stage/summary do not regress. Record event IDs and outbox/inbox attempts without storing payload text in logs. Restore normal retry/dead-letter policy afterward.
8. Only after steps 1–7 pass, register the Telegram webhook in the operator-owned test bot with an HTTPS URL ending `/v1/channels/telegram/webhook` and `secret_token` equal to the configured `TELEGRAM_WEBHOOK_SECRET`. In a private test chat, send `/country IN`, `/language hi-IN`, `/area Ward 42, Jaipur`, `/privacy`, `/agree`, then a text report and a distinct voice note. Confirm webhook verification, `getFile` download, tracking replies, canonical media/normalization/status, duplicate-update no-op, and withdrawal behavior. Keep bot token and secret out of shell history, logs, screenshots, and repository files. A stubbed webhook test is only local verification.

   After operator approval, the following command uses the **existing** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` environment variables and an operator shell placeholder `STAGING_TELEGRAM_WEBHOOK_URL`. It does not print secret values. It performs a real external registration, so do not run it against a production bot during preparation:

   ```sh
   python3 - <<'PY'
   import os
   import httpx
   base = "https://api.telegram.org/bot" + os.environ["TELEGRAM_BOT_TOKEN"]
   result = httpx.post(base + "/setWebhook", json={
       "url": os.environ["STAGING_TELEGRAM_WEBHOOK_URL"],
       "secret_token": os.environ["TELEGRAM_WEBHOOK_SECRET"],
       "allowed_updates": ["message"],
   }, timeout=20)
   result.raise_for_status()
   print({"registered": bool(result.json().get("ok"))})
   info = httpx.post(base + "/getWebhookInfo", timeout=20)
   info.raise_for_status()
   payload = info.json().get("result", {})
   print({"url_matches_expected": payload.get("url") == os.environ["STAGING_TELEGRAM_WEBHOOK_URL"],
          "pending_update_count": payload.get("pending_update_count")})
   PY
   ```

Capture a redacted run record containing service revisions, config presence (not values), migration versions, three receipt IDs, two audio hashes, provider/model/version and statuses, hotspot/evidence IDs and source classifications, human reviewer role and decision ID, linked project/metric IDs, event IDs/attempts, screenshots clearly labelled **authenticated staging** or **fixture**, and recovery observations. Do not mark Speech, Translation, Vertex, Pub/Sub, PostgreSQL, private Cloud Storage, Firebase, or Telegram “live verified” until the corresponding exercised and recovered steps succeed.
