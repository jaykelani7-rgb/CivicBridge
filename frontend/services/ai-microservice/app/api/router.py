from fastapi import APIRouter

from app.api.routes import decay, health, ocr, voice, webhooks

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
api_router.include_router(voice.router, prefix="/api/v1/intake/voice", tags=["voice"])
api_router.include_router(ocr.router, prefix="/api/v1/ocr", tags=["ocr"])
api_router.include_router(decay.router, prefix="/api/v1/decay", tags=["decay"])
