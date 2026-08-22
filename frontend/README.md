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
FIREBASE_PROJECT_ID=civicbridge-1
FIREBASE_SESSION_MAX_AGE_SECONDS=432000
AUTH_ORIGIN=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=civicbridge-1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=civicbridge-1
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED=false
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=
NEXT_PUBLIC_DEMO_MODE=false
```

The `NEXT_PUBLIC_FIREBASE_*` web configuration identifies the Firebase web app and is intentionally public; it is not an Admin credential. Never put service URLs, ID tokens, session cookies, private keys, or other secrets in a `NEXT_PUBLIC_*` value. Never create, download, or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON key for this application.

`FIREBASE_SESSION_MAX_AGE_SECONDS` must remain between 300 seconds and 1,209,600 seconds (two weeks). `AUTH_ORIGIN` must be the exact externally visible origin, with scheme and optional port but no path. Email/password controls are shown only when `NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED=true`; leave it false unless that provider is enabled in Firebase Authentication.

## Firebase Authentication setup

These owner actions are required once for project `civicbridge-1`:

1. In Firebase Console, open **Project settings > General > Your apps**. Register or select the frontend Web app and copy its Web SDK configuration into the matching `NEXT_PUBLIC_FIREBASE_*` variables. Do not commit real environment values.
2. In **Authentication > Sign-in method**, confirm Google is enabled. Email/password is optional; enable it in the Console before changing the frontend flag to `true`.
3. In **Authentication > Settings > Authorized domains**, add `localhost` for local development and the exact deployed frontend hostname for production.
4. In Google Cloud IAM, attach `civicbridge-frontend@civicbridge-1.iam.gserviceaccount.com` to the frontend runtime. Grant only the Firebase Authentication permissions used for session creation, revocation checks, and logout revocation: `firebaseauth.users.createSession`, `firebaseauth.users.get`, and `firebaseauth.users.update`. Prefer a reviewed custom role containing those permissions; the predefined Firebase Authentication Admin role is broader. Do not grant service-agent roles to this runtime identity.

The app signs in with the Firebase Web SDK using in-memory persistence, immediately exchanges the ID token through `POST /api/auth/session`, and signs out of the client SDK. The server stores only an `HttpOnly`, `SameSite=Lax` session cookie (also `Secure` in production). `GET /api/auth/me`, protected pages, and protected BFF endpoints verify that cookie with revocation checks and authorize only the `role` custom claim.

Assigning roles is a privileged administrator operation. The script accepts one UID and one of `analyst`, `policymaker`, `admin`, or `csr_partner`; it preserves other custom claims and rejects all other roles. Run it only as an authorized project administrator using Application Default Credentials:

```bash
gcloud config set project civicbridge-1
gcloud auth application-default login
cd frontend
FIREBASE_PROJECT_ID=civicbridge-1 npm run auth:set-role -- FIREBASE_UID analyst
```

After a claim changes, the user must sign out and sign in again so Firebase issues an ID token containing the new claim. Never accept a role from browser state, a request body, query parameters, or local storage.

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
gcloud config set project civicbridge-1
gcloud auth application-default login
cd frontend
npm ci
cp .env.example .env.local
# Fill in the Firebase Web app values and keep AUTH_ORIGIN=http://localhost:3000
npm run dev
```

Open `http://localhost:3000/auth` and sign in with a Firebase user that already has a valid role claim. The Citizen Portal and its submission BFF remain public. Command Center routes require `analyst`, `policymaker`, or `admin`; Policy & Impact routes require `policymaker`, `admin`, or `csr_partner`. There is no local role bypass.

## Cloud Run authentication and IAM

For an HTTPS `*.run.app` target (or when `CLOUD_RUN_AUTH_MODE=always`), the BFF uses Application Default Credentials through `google-auth-library` to mint an ID token whose audience is the target service URL. Local HTTP URLs receive no Google token. Never download or commit a service-account JSON key.

The frontend Cloud Run runtime service account needs `roles/run.invoker` on:

- CivicBridge Citizen Channels
- CivicBridge Data Intelligence
- CivicBridge Policy + Impact

The services remain private. An owner must grant those per-service bindings, configure the server-only URLs on the frontend Cloud Run service, and complete the Firebase/IAM steps above. Local ADC can be obtained with `gcloud auth application-default login` for approved developer testing.

## Demo mode

`NEXT_PUBLIC_DEMO_MODE=false` is the default. Failed API requests never fall back to mock content. If demo mode is explicitly enabled, visible “Demo data” labels appear. Evidence bundles also inspect backend source provenance and label synthetic fixtures independently of this flag.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

E2E tests verify public citizen submission behavior and the unauthenticated staff-route boundary without using fake auth cookies. Unit tests cover Firebase session creation, rejection, revocation, role authorization, logout, and cross-origin mutations. Live integration tests must remain skipped unless `RUN_LIVE_FRONTEND_INTEGRATION_TESTS=true`.

## Deployment

1. Build and test the frontend image without embedding backend URLs.
2. Deploy the frontend privately or publicly according to the product entry-point policy, using a dedicated runtime service account.
3. Set the server-only service URL, Google project/location, timeout, Firebase Admin project/session/origin values, and public Firebase Web app values on the frontend service.
4. Grant the runtime service account `roles/run.invoker` on each target backend service.
5. Keep every backend service private and verify citizen submission plus staff-role denial/allow paths.

See [`INTEGRATION_GAPS.md`](../INTEGRATION_GAPS.md) for capabilities that require backend or owner configuration.
