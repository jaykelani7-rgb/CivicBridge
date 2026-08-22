# ResourceMatch AI Microservice Architecture

## Purpose

The FastAPI microservice isolates the inference-heavy and media-processing workflows from the core Node/NestJS API.

- Twilio WhatsApp webhook intake
- OCR extraction and confidence scoring
- Whisper transcription orchestration
- NLP need extraction and explainability generation
- Heat / decay recalculation for open needs

## Deployment Shape

### Core API

- Handles user auth, dashboard APIs, assignment workflows, donation flows, and Prisma persistence.
- Calls the AI microservice synchronously for lightweight inference or asynchronously through job orchestration when media processing is slower.

### AI Microservice

- Normalizes inbound Twilio payloads into a consistent message envelope.
- Calls OCR / speech / NLP providers.
- Returns typed extraction payloads that the core API can persist into `NeedReport`, `DocumentExtraction`, `NeedInsight`, and `Need`.
- Emits recalculated decay / heat updates that the core API can commit to PostgreSQL.

### Scheduler / Background Worker

- Triggers `POST /api/v1/decay/recalculate` every 15 minutes.
- Can be implemented with a platform scheduler, Celery/Arq worker, or the core API’s cron layer.

## Data Flow

### WhatsApp text or mixed media

1. Twilio calls `POST /api/v1/webhooks/twilio/whatsapp`.
2. The microservice classifies the message as text, image, audio, or mixed.
3. The core API stores a `NeedReport`.
4. If text exists, the core API or worker calls `POST /api/v1/intake/voice/extract` with normalized text.
5. If image exists, the worker calls `POST /api/v1/ocr/extract`.
6. If audio exists, the worker calls `POST /api/v1/intake/voice/transcribe`, then `POST /api/v1/intake/voice/extract`.

### OCR review

1. `POST /api/v1/ocr/extract` returns parsed fields, confidence, and `needs_review`.
2. If confidence is below threshold, the core API creates a `DocumentExtraction` row with `reviewStatus=PENDING`.
3. Coordinators approve or reject in the dashboard.
4. That decision can be mirrored into the microservice via `POST /api/v1/ocr/review` for audit consistency.

### Decay logic

1. Scheduler calls `POST /api/v1/decay/recalculate` every 15 minutes.
2. The microservice recalculates heat scores using severity and elapsed time.
3. The response contains a batch of `need_id` and `recalculated_heat_score` pairs.
4. The core API writes the updates to PostgreSQL so the live heat map reflects the latest state.

## Route Contracts

## `GET /health`

Purpose: liveness / readiness check.

Response body:

```json
{
  "status": "ok",
  "timestamp": "2026-04-21T12:30:00+00:00"
}
```

## `POST /api/v1/webhooks/twilio/whatsapp`

Purpose: receive Twilio form-encoded WhatsApp payloads and normalize the message kind.

Request:

- Content type: `application/x-www-form-urlencoded`
- Important fields:
  - `MessageSid`
  - `AccountSid`
  - `From`
  - `To`
  - `Body`
  - `NumMedia`
  - `ProfileName`
- Header:
  - `X-Twilio-Signature`

Response body:

```json
{
  "accepted": true,
  "source": "WHATSAPP",
  "message_kind": "text",
  "normalized_event_id": "SMxxxxxxxx",
  "queued_for_processing": true
}
```

Behavior:

- `text`: process NLP directly.
- `image`: route to OCR.
- `audio`: route to transcription.
- `mixed`: split into the relevant downstream jobs.

## `POST /api/v1/intake/voice/transcribe`

Purpose: transcribe a voice note, most commonly from WhatsApp audio.

Request body:

```json
{
  "report_id": "report-uuid",
  "media_url": "https://signed-cdn.example/audio.ogg",
  "language_hint": "ta",
  "duration_seconds": 38,
  "location_hint": { "lat": 12.9291, "lng": 80.2303 },
  "source": "VOICE"
}
```

Response body:

```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "created_at": "2026-04-21T12:30:00+00:00",
  "transcript": "Need water support and ORS near the temporary school shelter.",
  "detected_language": "ta",
  "confidence_score": 0.94,
  "source": "WHISPER",
  "media_duration_seconds": 38
}
```

## `POST /api/v1/intake/voice/extract`

Purpose: convert transcript or normalized inbound text into a structured need candidate plus explainability.

Request body:

```json
{
  "report_id": "report-uuid",
  "transcript": "Need water support and ORS near the temporary school shelter.",
  "language": "ta",
  "source": "VOICE",
  "location_hint": { "lat": 12.9291, "lng": 80.2303 }
}
```

Response body:

```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "created_at": "2026-04-21T12:30:00+00:00",
  "normalized_text": "Need water support and ORS near the temporary school shelter.",
  "needs_review": false,
  "confidence_score": 0.91,
  "candidate": {
    "title": "Water and hydration support needed",
    "summary": "Shelter request mentions water access and ORS shortage.",
    "category": "Water Access",
    "urgency_score": 88,
    "beneficiary_count_hint": 65,
    "tags": ["hydration", "shelter", "verified-pending"],
    "location": { "lat": 12.9291, "lng": 80.2303 }
  },
  "explainability": {
    "summary": "Repeated urgency and hydration signals were detected in the transcript.",
    "data_points": [
      "Keywords matched water shortage and illness support.",
      "Urgency-weighted phrases increased extraction confidence."
    ]
  }
}
```

Persistence mapping:

- `normalized_text` -> `NeedReport.normalizedText`
- `confidence_score` -> `NeedReport.confidenceScore`
- `candidate.*` -> candidate `Need` fields
- `explainability` -> `NeedInsight`

## `POST /api/v1/ocr/extract`

Purpose: run OCR against a paper survey or uploaded image and return extracted fields.

Request body:

```json
{
  "report_id": "report-uuid",
  "image_url": "https://signed-cdn.example/form.jpg",
  "language_hint": "ta",
  "script_hint": "Tamil",
  "source": "OCR"
}
```

Response body:

```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "created_at": "2026-04-21T12:30:00+00:00",
  "engine": "vision-ocr-pipeline",
  "detected_language": "ta",
  "confidence_score": 0.81,
  "needs_review": true,
  "extracted_text": "Family size 5, requires sanitation kits and food assistance.",
  "parsed_fields": [
    { "name": "family_size", "value": "5", "confidence_score": 0.86 },
    { "name": "sanitation_kits", "value": "2", "confidence_score": 0.82 }
  ],
  "explainability": {
    "summary": "Confidence dropped because handwritten quantities overlapped the form grid.",
    "data_points": [
      "Image blur reduced numeric field certainty.",
      "The extraction is routed to human review because the score is below threshold."
    ]
  }
}
```

Persistence mapping:

- `confidence_score` -> `DocumentExtraction.confidenceScore`
- `parsed_fields` / `extracted_text` -> `DocumentExtraction.extractedPayload`
- `needs_review` -> `DocumentExtraction.needsReview`

## `POST /api/v1/ocr/review`

Purpose: record the result of human approval or rejection for a previously low-confidence OCR payload.

Request body:

```json
{
  "extraction_id": "extraction-uuid",
  "approved": true,
  "reviewer_user_id": "user-uuid",
  "review_notes": "Family size corrected after manual read."
}
```

Response body:

```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "created_at": "2026-04-21T12:30:00+00:00",
  "engine": "human-review",
  "detected_language": "ta",
  "confidence_score": 1.0,
  "needs_review": false,
  "extracted_text": "Human review completed.",
  "parsed_fields": [],
  "explainability": {
    "summary": "Coordinator review has overridden the automated OCR decision.",
    "data_points": [
      "Approved: true",
      "Reviewer user id: user-uuid"
    ]
  }
}
```

## `POST /api/v1/decay/recalculate`

Purpose: internal route for a scheduler or trusted worker to recompute heat scores every 15 minutes.

Request body:

```json
{
  "run_reason": "scheduler",
  "triggered_by": "system-cron",
  "open_need_ids": [],
  "as_of": "2026-04-21T12:30:00+00:00"
}
```

Response body:

```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "created_at": "2026-04-21T12:30:00+00:00",
  "processed_count": 2,
  "interval_minutes": 15,
  "updates": [
    {
      "need_id": "need-1",
      "previous_heat_score": 98,
      "recalculated_heat_score": 95,
      "decay_state": "fresh",
      "severity_weight": 1.4,
      "elapsed_minutes": 15
    }
  ]
}
```

Persistence mapping:

- `updates[].recalculated_heat_score` -> `Need.heatScore`
- `updates[].decay_state` -> frontend rendering hint or derived cache

## Security Expectations

- Webhook routes validate `X-Twilio-Signature`.
- Internal routes should require service-to-service auth, for example `Authorization: Bearer <internal-token>`.
- Signed media URLs should expire quickly and never be stored as permanent public links.

## Suggested Next Backend Step

Wire the NestJS core API to:

- persist `NeedReport` before inference,
- call these microservice routes,
- write returned OCR / transcript / explainability payloads into PostgreSQL,
- and expose a coordinator-facing read model for the dashboard and volunteer surfaces.
