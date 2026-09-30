import httpx
from fastapi import APIRouter
from packages.cloud_runtime import cloud_run_headers
from services.policy_impact.app.config import settings
from services.policy_impact.app.database import get_repository

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
        "probe": "process_only",
    }


@router.get("/ready")
def get_readiness():
    """Report configuration and reachability, never claim a live workflow ran."""
    repository = get_repository()
    try:
        repository._execute_read_one("SELECT 1", ())
        database_reachable = True
        outbox_pending = repository.pending_event_count()
    except Exception:
        database_reachable = False
        outbox_pending = None

    def reaches(url: str) -> bool:
        try:
            response = httpx.get(
                f"{url.rstrip('/')}/health",
                headers=cloud_run_headers(url, settings.AUTHENTICATE_CLOUD_RUN),
                timeout=2.0,
            )
            return response.status_code == 200
        except Exception:
            return False

    ai_reachable = reaches(settings.SHREYANK_AI_SERVICE_URL)
    intelligence_reachable = reaches(settings.JAY_DATA_INTELLIGENCE_URL)
    return {
        "status": "ready" if all((database_reachable, ai_reachable, intelligence_reachable)) else "degraded",
        "configured": {
            "database_url": bool(repository.db_path),
            "ai_url": bool(settings.SHREYANK_AI_SERVICE_URL),
            "intelligence_url": bool(settings.JAY_DATA_INTELLIGENCE_URL),
            "event_bus": settings.EVENT_BUS,
            "mock_stubs_enabled": settings.ENABLE_MOCK_STUBS,
        },
        "reachable": {
            "database": database_reachable,
            "ai_health": ai_reachable,
            "intelligence_health": intelligence_reachable,
        },
        "outbox_pending": outbox_pending,
        "exercised": False,
        "exercised_note": "Use a traced staging recommendation, decision, project and metric to verify the workflow.",
    }
