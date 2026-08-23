# CivicBridge frontend integration gaps

## AI normalization human review

The canonical AI Normalization service exposes internal normalization and retry endpoints, but no supported staff-facing review queue or review-decision endpoint. The Command Center therefore displays “Review service unavailable” and does not call the legacy `/v1/review-queue`, `/v1/review/{id}`, OCR service, private database, or internal files. The AI Normalization owner must define a public/staff contract and authorization model before this can be enabled.

## Staff identity configuration

The Firebase browser sign-in, Admin SDK ID-token exchange, revocable session cookies, logout, and custom-claim role enforcement are implemented. Production access remains unavailable until an authorized owner supplies the public Firebase web configuration, grants the documented runtime IAM permissions, sets each staff user's validated `role` custom claim, and adds the deployed hostname to Firebase Authentication's authorized domains. No credentials or role bypasses are committed.

## Citizen downstream status completeness

Citizen Channels exposes the agreed public status endpoint, but its current downstream hotspot, recommendation, and policy event listeners are placeholders. Its storage is also process memory/local disk. The frontend truthfully displays only fields returned by the endpoint; complete project-stage tracking requires the Citizen Channels owner to finish downstream event updates and durable operational storage.

Citizen Channels currently stores one `media_ref` per request, so a voice recording and a separate evidence photo cannot both be retained on one request without one replacing the other. The frontend supports one recording/upload attachment and does not invent multi-attachment behavior.

## Homepage summary

No canonical aggregate summary endpoint exists for report, hotspot, recommendation, or project totals. The hardcoded headline statistics and placeholder testimonials were removed. Homepage hotspot cards use the real Data Intelligence list endpoint.

## Report export

The current Policy + Impact contract does not provide a complete audit-report/receipt schema or financial transaction records. PDF receipt export is disabled rather than using fabricated funding amounts, costs, verification claims, or outcomes. A future export should be based on a versioned backend report DTO with provenance.

## Canonical backend persistence

As documented in the root README, several canonical services still use process memory, SQLite, local files, or mock/stub dependencies. The BFF does not hide those limitations. Production durability and replacement of Policy service stubs remain backend-owner work.

Data Intelligence now persists optional evidence language, grouping, source classification,
structured limitation, readiness, and priority metadata in its operational store/evidence
bundle. The default Cloud Run SQLite file is still ephemeral, so this metadata can disappear
when an instance is replaced. The repository includes an additive PostgreSQL migration, but
this change does not provision Cloud SQL or modify a deployment.

AI Normalization does not currently generate an original-language summary. It safely supplies
the normalized working-language summary and leaves `anonymized_original_summary` absent rather
than exposing or relabelling its masked full transcript. Producing that optional field later
requires a versioned, evaluated AI Normalization extraction change; Data Intelligence already
accepts and propagates it when present.

## Legacy frontend services

`frontend/services/core-api`, `frontend/services/ai-microservice`, and `frontend/compose.yaml` describe the older ResourceMatch architecture. They are intentionally not deleted, imported, started, or integrated. Removal requires teammate confirmation.
