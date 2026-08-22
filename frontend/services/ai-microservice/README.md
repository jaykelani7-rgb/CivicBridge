# ResourceMatch AI Microservice

FastAPI service for the async and inference-heavy workflows that should stay outside the core Node/NestJS API.

## Responsibilities

- Receive Twilio WhatsApp webhooks.
- Detect whether inbound messages are text, image, or audio.
- Run OCR extraction on image uploads and flag low-confidence outputs.
- Run speech-to-text workflows for voice notes.
- Extract structured need candidates from transcript or message text.
- Recalculate need heat / decay scores on a scheduled cadence.

## Suggested Service Boundary

### Core API owns

- Authentication and authorization.
- User-facing CRUD for needs, assignments, donations, and receipts.
- Persistence orchestration with Prisma/PostgreSQL.
- Coordinator-initiated human review actions.

### AI microservice owns

- Media classification and normalization.
- OCR execution and confidence scoring.
- Whisper transcription orchestration.
- Lightweight NLP need extraction and explainability payload assembly.
- Scheduled decay-score recomputation payload generation.

## Local Run

```bash
uvicorn app.main:app --reload --app-dir services/ai-microservice
```

## Environment

Create `.env` values for:

- `RESOURCE_MATCH_ENV`
- `RESOURCE_MATCH_API_KEY`
- `OPENAI_API_KEY`
- `TWILIO_AUTH_TOKEN`
- `DATABASE_URL`
- `OCR_CONFIDENCE_THRESHOLD`
- `DECAY_INTERVAL_MINUTES`

## Route Summary

- `GET /health`
- `POST /api/v1/webhooks/twilio/whatsapp`
- `POST /api/v1/intake/voice/transcribe`
- `POST /api/v1/intake/voice/extract`
- `POST /api/v1/ocr/extract`
- `POST /api/v1/ocr/review`
- `POST /api/v1/decay/recalculate`

The route contracts are also documented in [docs/ai-microservice-architecture.md](/Users/jaykelani/Downloads/googlefinal/docs/ai-microservice-architecture.md:1).
