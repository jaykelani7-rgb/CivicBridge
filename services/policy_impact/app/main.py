import logging
import asyncio
import sys
from pathlib import Path

# Add C:\googlehacka to sys.path so packages and services are resolvable
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.cloud_runtime import BigQueryDeliveryLedger, PubSubEventBus
from packages.event_bus import configure_event_bus, get_event_bus
from packages.durable_outbox import poll_forever
from services.policy_impact.app.config import settings
from services.policy_impact.app.database import get_repository

if settings.EVENT_BUS == "pubsub":
    configure_event_bus(PubSubEventBus(settings.PUBSUB_PROJECT, {
        "recommendation.created.v1": settings.RECOMMENDATION_TOPIC,
        "policy.decision.recorded.v1": settings.DECISION_TOPIC,
        "project.status.updated.v1": settings.PROJECT_TOPIC,
        "impact.metric.updated.v1": settings.IMPACT_TOPIC,
    }))

from services.policy_impact.app.api.decisions import router as decisions_router
from services.policy_impact.app.api.health import router as health_router
from services.policy_impact.app.api.metrics import router as metrics_router
from services.policy_impact.app.api.milestones import router as milestones_router
from services.policy_impact.app.api.projects import router as projects_router
from services.policy_impact.app.api.recommendations import router as recommendations_router
from services.policy_impact.app.api.status_summary import router as status_router
from services.policy_impact.app.api.pubsub import router as pubsub_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.SERVICE_VERSION,
    description="CivicBridge AI - Policy + Impact Backend Service owned by Sharmad.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router)
app.include_router(recommendations_router)
app.include_router(decisions_router)
app.include_router(projects_router)
app.include_router(milestones_router)
app.include_router(metrics_router)
app.include_router(status_router)
app.include_router(pubsub_router)
app.state.delivery_ledger = (
    BigQueryDeliveryLedger(settings.GCP_PROJECT_ID, settings.BIGQUERY_DATASET, settings.GCP_LOCATION)
    if settings.IDEMPOTENCY_BACKEND == "bigquery" else None
)


@app.on_event("startup")
def recover_committed_events() -> None:
    """Replay a prior process's committed but unpublished policy events."""
    get_repository().dispatch_pending(get_event_bus())


@app.on_event("startup")
async def start_outbox_retry() -> None:
    app.state.outbox_task = asyncio.create_task(poll_forever(
        lambda: get_repository().dispatch_pending(get_event_bus(), fail_on_error=True),
        logging.getLogger("policy-outbox"),
    ))


@app.on_event("shutdown")
async def stop_outbox_retry() -> None:
    task = getattr(app.state, "outbox_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@app.get("/")
def read_root():
    return {
        "service": settings.APP_NAME,
        "owner": "Sharmad",
        "scope": "Policy + Impact Backend",
        "docs": "/docs",
        "status": "online",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("services.policy_impact.app.main:app", host="127.0.0.1", port=8000, reload=True)
