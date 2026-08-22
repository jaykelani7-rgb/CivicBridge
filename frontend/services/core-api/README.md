# ResourceMatch Core API

NestJS service that owns authenticated application workflows and persists normalized intake results into PostgreSQL with Prisma.

## Responsibilities

- Accept inbound operational intake requests and webhook payloads.
- Call the FastAPI AI microservice for transcription, OCR, NLP extraction, and decay-score recalculation.
- Persist `NeedReport`, `DocumentExtraction`, `NeedInsight`, and representative `Need` rows into PostgreSQL.
- Expose orchestration routes that the frontend or internal workers can call.

## Suggested Environment

- `PORT`
- `DATABASE_URL`
- `AI_MICROSERVICE_BASE_URL`
- `RESOURCE_MATCH_INTERNAL_API_KEY`

## Local Run

```bash
npm install
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resourcematch npm run prisma:generate
npm run build
npm run start:dev
```

## Routes

- `GET /health`
- `POST /api/v1/intake/webhooks/twilio/whatsapp`
- `POST /api/v1/intake/voice`
- `POST /api/v1/intake/ocr`
- `POST /api/v1/intake/ocr/review`
- `POST /api/v1/decay/recalculate`
