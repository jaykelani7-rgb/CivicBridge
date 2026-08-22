from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="ResourceMatch AI Microservice",
    version="0.1.0",
    summary="OCR, voice intake, WhatsApp normalization, and decay processing.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(api_router)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {
        "service": "resourcematch-ai-microservice",
        "environment": settings.environment,
        "docs": "/docs",
    }
