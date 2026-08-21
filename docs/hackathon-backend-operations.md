# Hackathon backend operations

## Deployed push inventory

| Contract | Source topic | Push subscription | Endpoint | Dead-letter topic |
|---|---|---|---|---|
| `request.created.v1` | `request-created-v1` | `ai-normalization-request-created` | AI Normalization `/pubsub/citizen-events` | `ai-normalization-request-created-dead-letter` |
| `request.confirmed.v1` | `request-confirmed-v1` | `ai-normalization-request-confirmed` | AI Normalization `/pubsub/citizen-events` | `ai-normalization-request-confirmed-dead-letter` |
| `request.normalized.v1` | `request-normalized-v1` | `data-intelligence-normalized` | Data Intelligence `/pubsub/request-normalized` | `data-intelligence-normalized-dead-letter` |
| `hotspot.updated.v1` | `hotspot-updated-v1` | `policy-impact-hotspot-updated` | Policy + Impact `/pubsub/hotspot-updated` | `policy-impact-hotspot-updated-dead-letter` |

The project also contains the contract output topics `request-needs-review-v1`, `recommendation-created-v1`, `policy-decision-recorded-v1`, `project-status-updated-v1`, and `impact-metric-updated-v1`. They currently have no deployed push subscriptions, so no consumer DLQ is needed for them.

## Readiness check

Run the non-destructive verification from the repository root:

```bash
python3 scripts/prepare_backend_demo.py --project civicbridge-1 --region us-central1
```

It verifies all four Cloud Run services are Ready, private, and capped at one instance; every push subscription has an endpoint and five-attempt DLQ; required BigQuery tables exist; and the India, Brazil and South Africa fixtures load correctly. It publishes nothing by default.

To explicitly publish new synthetic fixture events and wait for Data Intelligence plus downstream Policy ledger completion:

```bash
python3 scripts/prepare_backend_demo.py --project civicbridge-1 --region us-central1 --publish-fixtures
```

The fixture option creates new event/request identifiers and publishes no citizen data or PII. It is additive and does not delete existing demo state.

## Local fixture seed

Data Intelligence already has an idempotent fixture loader: fixed fixture rows use upsert or `INSERT OR IGNORE`. Seed a local database explicitly with:

```bash
python3 scripts/seed_local_demo.py --database ./data/intelligence-demo.db
```

There is deliberately no cloud reset command. Citizen, AI, Data Intelligence, and Policy do not share SQLite files between containers, and no destructive reset operation is executed automatically.

## DLQ inspection

Each source subscription has a dedicated `SOURCE-dead-letter` topic and `SOURCE-dead-letter-inspection` pull subscription. Inspect without acknowledgement first:

```bash
gcloud pubsub subscriptions pull SOURCE-dead-letter-inspection \
  --project civicbridge-1 --limit 10
```

Only acknowledge a message after recording the safe identifiers and deciding whether to replay it. Never copy full citizen submissions into tickets or logs.

The reviewed, idempotent configuration command is recorded in `scripts/configure_pubsub_dlqs.sh`. It creates resources and changes IAM, so do not run it casually. It changes only dead-letter fields on source subscriptions; existing push endpoints, OIDC identities/audiences, acknowledgement deadlines and retry settings are retained.

## SQLite mitigation

All four services are capped at `max-instances=1`; `min-instances` remains zero. This is only a hackathon consistency mitigation. It prevents concurrent containers from trying to represent one logical local store, but Cloud Run may still replace the single container at any time. In-memory state, SQLite, and local media are lost on replacement or revision rollout. The filesystem is writable but not durable.

- Citizen media defaults to `data/media` and can be redirected with `CITIZEN_MEDIA_DIR`.
- Data Intelligence uses `/service/data` in its production image, owned by the non-root application user.
- Policy creates the parent directory for `DATABASE_PATH`; production should point it at a writable application data directory.
- AI Normalization cache is process memory only.

Do not set `min-instances` above zero without approval: it reserves idle Cloud Run capacity and adds continuing cost.
