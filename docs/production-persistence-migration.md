# Production persistence migration

## Current state and risk

The deployed pipeline is reliable at its Pub/Sub delivery boundaries, but its operational state is not fully durable. Cloud Run container filesystems are ephemeral.

| Service | Current container-local state | Replacement impact |
|---|---|---|
| Citizen Channels | Requests, idempotency keys and corrections in memory; uploaded media on local disk | Requests and media become unavailable |
| AI Normalization | Normalization result/cache and attempt history in memory | Cache and retry history are lost; durable input ledger remains in BigQuery |
| Data Intelligence | SQLite clusters, members, hotspots, score versions, evidence bundles, review queue and outbox | Operational analytics and unpublished outbox rows are lost; input ledger and embeddings remain in BigQuery |
| Policy + Impact | SQLite recommendations, decisions, projects, milestones and impact metrics, with memory fallback | Policy workflow state is lost; durable input ledger remains in BigQuery |

`max-instances=1` reduces split-brain behavior during the hackathon but does not make this state durable.

## Cloud SQL PostgreSQL ownership

When approved, Cloud SQL PostgreSQL should hold transactional operational data:

- citizen requests, consent/version metadata, idempotency keys and mutable workflow state;
- durable references to media objects stored in Cloud Storage, not media bytes in PostgreSQL;
- normalization status, attempts and cache entries that must survive restarts;
- issue clusters, memberships and hotspots requiring atomic counter/version updates;
- evidence-bundle metadata and hashes, with large immutable analytical payloads referenced where appropriate;
- transactional outbox and inbox/idempotency rows;
- policy recommendations, decisions, projects, milestones and mutable impact workflow records.

## BigQuery ownership

BigQuery should remain the analytical system for:

- versioned analytical and hotspot snapshots;
- embeddings and their model/version metadata where current query patterns remain appropriate;
- reporting datasets and score-component history;
- aggregate trend/history tables;
- provenance-rich official datasets and cross-border analysis.

BigQuery delivery ledgers may remain during migration for audit continuity, but PostgreSQL inbox rows should become the transactional processing gate for workflows that update PostgreSQL state.

## Transactional outbox

Each service writes its domain changes and an outbox row in one PostgreSQL transaction. An independent worker claims rows with `SELECT ... FOR UPDATE SKIP LOCKED`, publishes the unchanged contract event to Pub/Sub, records the Pub/Sub message ID and marks the row sent. Retries use the stable event ID. Consumers first insert an inbox row keyed by event ID and event type; a uniqueness constraint turns redelivery into a no-op. Publishing must never occur before the state transaction commits.

## Migration sequence

1. Provision private Cloud SQL, regional placement, backups, point-in-time recovery, maintenance policy and IAM database authentication after approval.
2. Add PostgreSQL repositories behind the existing service interfaces without changing contracts.
3. Create schema migrations, constraints, indexes, inbox and outbox tables.
4. Dual-write only where reconciliation is defined; otherwise perform bounded one-service cutovers beginning with Citizen and Policy.
5. Backfill operational rows from validated snapshots where possible. Treat missing container-local history as unavailable, not reconstructed fact.
6. Run shadow reads and compare identifiers, counts and hashes.
7. Switch one service at a time through configuration, retain BigQuery analytics, then remove local-write dependence after an observation period.
8. Increase Cloud Run scaling only after all SQLite/local-state dependencies are removed and concurrency tests pass.

## Rollback

Keep repository selection configuration-driven. Before each cutover, capture a database backup and schema version. Roll back application traffic to the prior revision and repository mode only while writes are quiesced or a documented reverse-sync exists. Never silently merge divergent SQLite and PostgreSQL histories. Pub/Sub replay should start from durable inbox/outbox identifiers after the rollback boundary.

## Cloud Run connection pooling

Use short transactions and bounded pools per instance. Set pool size plus overflow so `maximum Cloud Run instances × per-instance connections` stays below the Cloud SQL connection limit. Enable connection recycling, pre-ping, statement/lock timeouts and exponential retry for transient connection errors. Prefer the Cloud SQL connector or Unix socket with IAM authentication; do not download database credentials. Consider PgBouncer only if measured connection pressure justifies another operational component.

## New resources and cost/complexity categories

Expected resources include one regional PostgreSQL instance, private networking or connector configuration, databases/users, Secret Manager entries only for unavoidable non-IAM secrets, backups/PITR storage, monitoring/alerts and migration jobs. Cost categories include continuously allocated database CPU/RAM, storage and backup growth, network egress where regions differ, connector traffic, monitoring retention and engineering/on-call time. Complexity increases through schema migrations, connection capacity planning, backup testing, failover procedures, access reviews and data reconciliation. None of these resources are provisioned by the hackathon-hardening task.
