# ResourceMatch System Architecture

## Step 1 Decisions

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion, Zustand, React Query.
- Core API: NestJS with Prisma for strong module boundaries, DTO validation, and long-term maintainability.
- AI/ML microservices: FastAPI for Twilio webhook intake, OCR, Whisper transcription, NLP parsing, and decay-score jobs.
- Database: PostgreSQL with the PostGIS extension enabled.
- Maps: Mapbox GL JS for performant clustering, animated heat layers, and fine-grained map styling.

## Why PostGIS Points Instead Of Raw GeoJSON In The Database

The product speaks GeoJSON at the API boundary, but the database should store geospatial values as PostGIS points using `geography(Point, 4326)`.

- Radius queries remain accurate for real-world distances like `3km`.
- GiST indexes keep the command center heat map and volunteer matching responsive.
- The API can still serialize every point back into GeoJSON for the frontend.

## Core Domain Boundaries

### Identity And Access

- `User` stores platform identity and global role.
- `Organization` supports NGO and corporate donor tenancy.
- `VolunteerProfile` and `CSRDonorProfile` extend `User` without bloating the base table.

### Need Intake And Triage

- `NeedReport` represents every inbound signal from WhatsApp, voice, OCR, or manual entry.
- `Need` is the canonical, deduplicated crisis or resource requirement surfaced to dashboards.
- `DocumentExtraction` supports the human review queue for low-confidence OCR.
- `NeedInsight` stores explainable AI outputs for the "Why was this flagged?" UI.

### Operations

- `NeedAssignment` handles volunteer and field-worker dispatch, including buddy matching context.
- `NeedMedia` stores S3-backed audio, image, and document evidence.

### Funding And Accountability

- `Donation` links a CSR contribution directly to a specific `Need`.
- `ImpactReceipt` persists the generated evidence package for board-ready PDF exports.

## Geospatial And Performance Notes

- `Need.location`, `NeedReport.location`, and `VolunteerProfile.lastKnownLocation` use PostGIS geography points.
- GiST indexes support heat maps, proximity searches, and routing decisions.
- GIN indexes on `skills`, `languages`, and donor `focusAreas` support fast matching filters.
- `NeedReport` is intentionally separate from `Need` so multiple inbound reports can strengthen the same verified need.

## Suggested Next Step

Step 2 should scaffold the application foundation:

- Next.js App Router project structure
- Tailwind config with the earthy design tokens
- global CSS variables
- Shadcn base theming
- providers for React Query, Zustand, theme, and toast handling
