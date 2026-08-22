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

## Legacy frontend services

`frontend/services/core-api`, `frontend/services/ai-microservice`, and `frontend/compose.yaml` describe the older ResourceMatch architecture. They are intentionally not deleted, imported, started, or integrated. Removal requires teammate confirmation.
