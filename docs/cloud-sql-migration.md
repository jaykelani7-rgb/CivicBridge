# Data Intelligence Cloud SQL migration plan

Status: code and PostgreSQL migrations are prepared; no Cloud SQL, private networking, database, user, secret, or connector has been provisioned.

## Proposed billable footprint (owner approval required)

- One Cloud SQL for PostgreSQL 16 instance in `us-central1`, initially `db-custom-1-3840` (1 vCPU, 3.75 GiB RAM).
- 20 GiB balanced persistent SSD, storage auto-increase, point-in-time recovery, and seven-day automated-backup retention.
- High availability disabled for the hackathon pilot. Production authorization should reconsider regional HA, which materially increases cost.
- Private IP and one Serverless VPC Access connector are preferred for production. A pilot may instead use the Cloud SQL connector without a public client allowlist.
- Secret Manager secret versions for database name, application user, and a generated password.

Every item above is a new or expanded billable Google Cloud resource and requires explicit owner approval. Maps usage, key, and Map ID are separate billable/configuration decisions.

## Database and identity design

Create database `civicbridge_intelligence` and least-privilege runtime user `data_intelligence_app`. A separate migration principal owns DDL; runtime receives only required DML/sequence privileges. Keep `civicbridge-data-intel@civicbridge-1.iam.gserviceaccount.com` and grant only `roles/cloudsql.client` plus Secret Accessor on the required secrets. Never create a service-account JSON key.

```env
CB_STORAGE_BACKEND=postgresql
CB_DATABASE_URL=postgresql://data_intelligence_app:...@/civicbridge_intelligence?host=/cloudsql/civicbridge-1:us-central1:INSTANCE
CB_DATABASE_POOL_MIN_SIZE=1
CB_DATABASE_POOL_MAX_SIZE=10
```

Install `.[production,postgres]`. Keep BigQuery for analytics, GIS enrichment, the delivery ledger, and embedding cache; it is not a transactional replacement.

## Migration procedure

1. Obtain approval for the exact resources above and choose connector/private-IP networking.
2. Provision privately, create migration/runtime users, and store generated credentials in Secret Manager.
3. Run `services/data-intelligence/migrations/postgresql/001_initial.sql` with the migration principal.
4. Export current SQLite state from a controlled live instance before scale-down. Validate counts, foreign keys, UUID uniqueness, evidence hashes, and outbox state in staging.
5. Deploy a no-traffic revision with the Cloud SQL connection, secret references, and PostgreSQL backend.
6. Run health, duplicate-event, membership, hotspot/score/evidence, and outbox tests; compare responses with the source snapshot.
7. Briefly pause normalized-event delivery, migrate any delta, shift traffic, resume, and verify idempotency.

## Rollback

Stop traffic to the PostgreSQL revision, pause delivery, and restore the previous revision only for short demo continuity. Do not delete PostgreSQL or backups. SQLite rollback cannot promise restored hotspot state unless a validated export exists. Preserve the migration audit until cleanup is separately approved.

## Operational risks

- SQLite state may disappear before export when Cloud Run scales to zero.
- Pool size multiplied by instance count must stay below the Cloud SQL connection limit.
- Schema or evidence-hash drift must block cutover.
- Keep database and service in `us-central1` to avoid latency/governance risk.
- Pilot HA is intentionally omitted and remains a production resilience gap.

