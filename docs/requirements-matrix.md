# CivicBridge improvement coverage — 2026-09-30

“Verified” below means local code, unit/integration, or isolated browser-fixture verification. No live provider, deployed Pub/Sub, production database, or official source import was verified.

| Requirement | Status | Evidence or remaining work |
|---|---|---|
| Branch, fetch and preserve existing work | Implemented and verified | `jay/civicbridge-platform-completion` began at `caeadbd`; `git fetch origin` ran; no push, merge, deployment, or production write. |
| Verified-session staff entry and role destinations | Implemented and verified | Header queries `/api/auth/me`, shows a loading state, role-aware workspace navigation and sign-out; unit tests cover signed-out, authorized, and denied roles. |
| Safe return destination after sign-in/expiry | Implemented and verified | Same-origin, role-approved return-path validator and regression tests. |
| Recommendation workspace and review flow | Implemented and verified | Queue/search/status, wide brief, evidence provenance, selected deep link, decision drawer/confirmation, draft retention, receipts and project creation; component tests and isolated screenshots. |
| Mobile/tablet/desktop staff layout | Implemented and verified | Playwright fixture checks at 320/390/768/1440 px and 200% text; screenshots in `docs/staff-workspace/screenshots`. Live authenticated screen not available without credentials. |
| Private audio retrieval, validation and STT byte handoff | Implemented but live verification pending | Internal authenticated bytes, private local/GCS storage option, WAV/compressed format and 10 MB/60 s checks, distinct-WAV byte-handoff tests. Google Speech credentials absent. |
| Voice/text preservation, processing failure and retry | Implemented and verified | Original transcript plus working translation and written context retained; failed transcription enters review, public failure state and retry endpoint; local tests. |
| AI provenance and failure distinction | Partial | Speech/translation/extraction mode and provider fields, explicit mock/degraded states, production mock guards; deployed Google/Vertex and semantic model smoke tests pending. |
| Recommendation grounding | Partial | Bundle/hotspot checks, citation membership, source-field numerical traces and unsupported-number rejection; source factual accuracy still requires independent review. |
| Deterministic hotspot scoring | Implemented and verified | Existing score engine retained, labelled deterministic; synthetic regression demonstrates infrastructure gap, investment alignment and coverage penalty. |
| Durable citizen/normalization/policy records | Partial | Additive versioned SQL migration command, SQLite restart/replay tests, PostgreSQL paths, private GCS option and duplicate receipts. Transactionally coordinated outbox, stress test and cloud database verification remain. |
| Citizen downstream status and privacy | Implemented but live verification pending | Hotspot→recommendation→decision→project→measurement handlers, normalized summary separate from later updates, private-safe DTO and authenticated push tests. Deployed subscription/event ordering unverified. |
| Telegram text and voice channel | Implemented but live verification pending | Secret-verified webhook, clarification, explicit consent, media download, deduplication, canonical intake and receipt; tests stub Telegram. No bot/webhook registered. |
| Official demographic/infrastructure/investment pilot | Partial | Publisher sources and metadata assessed; fail-closed validator rejects incompatible geography/period/rights and missing extracts. No official values imported into Ward 15. |
| Bidirectional project metrics | Implemented and verified | Higher/lower direction, unchanged/improving/deteriorating/achieved/pending, dated sources, manual-entry UI and role checks; staff intake cannot self-label independent verification. |
| Independently verified outcomes | Missing | No separate verifier workflow or independent measurement source connected. Manual before/after values are not causal evidence. |
| DPG architecture, adaptation and privacy documentation | Partial | `docs/dpg-readiness.md` covers supported demo packs, access, limits and setup; owner must decide retention/deletion policy and repository licence. No certification claimed. |
| Full live end-to-end verification | Missing | Requires Google/Vertex, Telegram, PostgreSQL/GCS, Pub/Sub, official data rights/crosswalk, and a staging environment; not available in this local task. |
