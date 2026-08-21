from fastapi import APIRouter
from services.policy_impact.app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
        "dependencies": {
            "database": "connected",
            "shreyank_ai_normalization": "ready",
            "jay_data_intelligence": "ready",
        },
    }
