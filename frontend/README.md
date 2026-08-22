# CivicBridge frontend

This Next.js application is the browser and Backend-for-Frontend (BFF) layer for the canonical CivicBridge four-service backend in the repository root.

## Architecture

```text
Browser -> same-origin /api route handlers -> private Cloud Run services
```

The browser never receives canonical backend URLs. Route handlers under `src/app/api` call only the root services:

- `services/citizen_channels`
- `services/ai_normalization` (indirectly through events; no public review API exists)
- `services/data-intelligence`
- `services/policy_impact`

`frontend/services/core-api` and `frontend/services/ai-microservice` are legacy ResourceMatch code. They are retained for teammate review but are not started, imported, or called by this frontend. The old `compose.yaml` also describes that legacy stack and is not the canonical local environment.

## Environment

Copy `.env.example` to `.env.local` and set:

```env
CITIZEN_CHANNELS_URL=http://127.0.0.1:8000
DATA_INTELLIGENCE_URL=http://127.0.0.1:8002
POLICY_IMPACT_URL=http://127.0.0.1:8003
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
CLOUD_RUN_AUTH_MODE=auto
BFF_REQUEST_TIMEOUT_MS=15000
STAFF_AUTH_MODE=firebase
FIREBASE_PROJECT_ID=
NEXT_PUBLIC_CIVICBRIDGE_DEV_ROLE=
NEXT_PUBLIC_DEMO_MODE=false
```

Only the explicit demo flag and local development role are public. Never use `NEXT_PUBLIC_*` for service URLs, tokens, project credentials, or private configuration.

For local staff testing without Firebase, set `STAFF_AUTH_MODE=development` and `NEXT_PUBLIC_CIVICBRIDGE_DEV_ROLE=analyst` or `policymaker`. Development authorization is rejected when `NODE_ENV=production`.

## Local development

From the repository root, create Python environments and install each canonical service's requirements. Start the services in separate terminals:

```bash
uvicorn services.citizen_channels.main:app --port 8000
uvicorn services.ai_normalization.main:app --port 8001
cd services/data-intelligence && .venv/bin/uvicorn app.main:app --port 8002
uvicorn services.policy_impact.app.main:app --port 8003
```

Keep local event buses, idempotency stores, and service mock settings aligned with the root README. Then run:

```bash
cd frontend
npm ci
npm run dev
```

The Citizen Portal is public. The Command Center and Policy & Impact pages require staff authorization.

## Cloud Run authentication and IAM

For an HTTPS `*.run.app` target (or when `CLOUD_RUN_AUTH_MODE=always`), the BFF uses Application Default Credentials through `google-auth-library` to mint an ID token whose audience is the target service URL. Local HTTP URLs receive no Google token. Never download or commit a service-account JSON key.

The frontend Cloud Run runtime service account needs `roles/run.invoker` on:

- CivicBridge Citizen Channels
- CivicBridge Data Intelligence
- CivicBridge Policy + Impact

The services remain private. An owner must create the frontend runtime identity, grant those per-service bindings, configure the server-only URLs on the frontend Cloud Run service, and configure Firebase/Identity Platform and role claims. Local ADC can be obtained with `gcloud auth application-default login` for approved developer testing.

## Demo mode

`NEXT_PUBLIC_DEMO_MODE=false` is the default. Failed API requests never fall back to mock content. If demo mode is explicitly enabled, visible “Demo data” labels appear. Evidence bundles also inspect backend source provenance and label synthetic fixtures independently of this flag.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E tests mock same-origin BFF requests and do not require Cloud Run. Live integration tests must remain skipped unless `RUN_LIVE_FRONTEND_INTEGRATION_TESTS=true`.

## Deployment

1. Build and test the frontend image without embedding backend URLs.
2. Deploy the frontend privately or publicly according to the product entry-point policy, using a dedicated runtime service account.
3. Set the server-only service URL, Google project/location, timeout, and Firebase environment values on the frontend service.
4. Grant the runtime service account `roles/run.invoker` on each target backend service.
5. Keep every backend service private and verify citizen submission plus staff-role denial/allow paths.

See [`INTEGRATION_GAPS.md`](../INTEGRATION_GAPS.md) for capabilities that require backend or owner configuration.
