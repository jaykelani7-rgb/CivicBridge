# ResourceMatch

ResourceMatch is a data-driven volunteer coordination and resource allocation platform for NGOs and corporate donors.

## Services

- `frontend`: Next.js App Router experience for coordinators, volunteers, and CSR donors.
- `services/core-api`: NestJS orchestration and persistence layer using Prisma + PostgreSQL/PostGIS.
- `services/ai-microservice`: FastAPI service for Twilio intake, OCR, Whisper transcription, NLP extraction, and decay processing.

## Frontend

```bash
npm install
npm run dev
```

## Backend Services

Core API:

```bash
cd services/core-api
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resourcematch npm run prisma:generate
npm run start:dev
```

AI microservice:

```bash
cd services/ai-microservice
uvicorn app.main:app --reload
```

## Docker Compose Dev Environment

1. Copy the example environment file:

```bash
cp .env.docker.example .env
```

2. Start the backend stack:

```bash
docker compose up --build
```

Available services:

- Postgres/PostGIS: `localhost:5432`
- AI microservice: `http://localhost:8000`
- Core API: `http://localhost:4000`

The Compose setup uses live bind mounts for `services/core-api` and `services/ai-microservice`, so backend code changes are reflected inside the containers during development.
