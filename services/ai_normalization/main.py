"""
CivicBridge AI - AI Normalization Service (owned by Shreyank).

Standalone FastAPI microservice implementing contract.md Section 9.2:
  POST /internal/v1/normalizations
  GET  /internal/v1/normalizations/{request_id}
  POST /internal/v1/normalizations/{request_id}/retry
  POST /internal/v1/policy-briefs/draft
  GET  /health

Runs mock-first (USE_MOCK_SERVICES=true) so the full backend demo works with
zero Google Cloud credentials; flip the flag and set GCP_PROJECT_ID to use the
real Cloud Speech-to-Text V2 / Cloud Translation Advanced / Vertex AI Gemini
adapters.

Run directly:
    uvicorn services.ai_normalization.main:app --host 127.0.0.1 --port 8001 --reload
"""
import logging
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from packages.event_bus.bus import EventBus, event_bus as shared_event_bus
from packages.cloud_runtime import BigQueryDeliveryLedger, PubSubEventBus

from services.ai_normalization.api.errors import NormalizationAPIError
from services.ai_normalization.api.routes import router
from services.ai_normalization.clients.citizen_channels_client import CitizenChannelsClient
from services.ai_normalization.config import Settings, settings as default_settings
from services.ai_normalization.database import NormalizationRepository, get_repository
from services.ai_normalization.events.consumer import register_consumers
from services.ai_normalization.pipeline.extraction import GeminiExtractionAdapter
from services.ai_normalization.pipeline.normalization_service import NormalizationService
from services.ai_normalization.pipeline.policy_brief import PolicyBriefDraftAdapter
from services.ai_normalization.pipeline.speech import SpeechToTextAdapter
from services.ai_normalization.pipeline.translation import TranslationAdapter

logging.basicConfig(level=logging.INFO)


def _error(code: str, message: str, retryable: bool, details: list, trace_id: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "retryable": retryable, "details": details, "trace_id": trace_id}},
    )


def create_app(
    settings: Optional[Settings] = None,
    *,
    repository: Optional[NormalizationRepository] = None,
    event_bus: Optional[EventBus] = None,
    citizen_client: Optional[CitizenChannelsClient] = None,
) -> FastAPI:
    settings = settings or default_settings
    repository = repository or get_repository()
    event_bus = event_bus or (
        PubSubEventBus(
            settings.PUBSUB_PROJECT,
            {
                "request.normalized.v1": settings.NORMALIZED_TOPIC,
                "request.needs_review.v1": settings.REVIEW_TOPIC,
            },
        )
        if settings.EVENT_BUS == "pubsub"
        else shared_event_bus
    )
    citizen_client = citizen_client or CitizenChannelsClient(
        base_url=settings.CITIZEN_CHANNELS_URL, timeout=settings.CITIZEN_CHANNELS_TIMEOUT_SECONDS
    )

    service = NormalizationService(
        settings=settings,
        repository=repository,
        event_bus=event_bus,
        citizen_client=citizen_client,
        stt=SpeechToTextAdapter(settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION),
        translator=TranslationAdapter(settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION),
        extractor=GeminiExtractionAdapter(
            settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION, settings.GEMINI_MODEL_NAME
        ),
    )
    policy_brief_drafter = PolicyBriefDraftAdapter(
        settings.USE_MOCK_SERVICES, settings.GCP_PROJECT_ID, settings.GCP_LOCATION, settings.GEMINI_MODEL_NAME
    )

    register_consumers(event_bus, service)

    app = FastAPI(
        title=settings.APP_NAME,
        description="Speech-to-Text, Translation, and Gemini structured extraction for citizen requests. Owned by Shreyank.",
        version=settings.SERVICE_VERSION,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.settings = settings
    app.state.repository = repository
    app.state.event_bus = event_bus
    app.state.citizen_client = citizen_client
    app.state.service = service
    app.state.policy_brief_drafter = policy_brief_drafter
    app.state.delivery_ledger = (
        BigQueryDeliveryLedger(settings.GCP_PROJECT_ID, settings.BIGQUERY_DATASET, settings.GCP_LOCATION)
        if settings.IDEMPOTENCY_BACKEND == "bigquery"
        else None
    )

    app.include_router(router)

    @app.exception_handler(NormalizationAPIError)
    async def normalization_error_handler(request: Request, exc: NormalizationAPIError):
        return _error(exc.code, exc.message, exc.retryable, exc.details, exc.trace_id, exc.http_status)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        trace = request.headers.get("X-Trace-Id", str(uuid4()))
        details = [{"field": ".".join(str(x) for x in e["loc"]), "reason": e["msg"]} for e in exc.errors()]
        return _error("NORMALIZATION_REQUEST_INVALID", "The request payload failed validation.", False, details, trace, 422)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=default_settings.SERVICE_PORT)
