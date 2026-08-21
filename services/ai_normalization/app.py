"""
Backward-compatible entry point.

The AI Normalization service used to be a one-endpoint stub living directly
in this file. It has been replaced by the real service in main.py (see
services/ai_normalization/main.py for the full implementation). This shim is
kept so any existing `uvicorn services.ai_normalization.app:app` command, or
`python services/ai_normalization/app.py` invocation, keeps working unchanged.
"""
from services.ai_normalization.main import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn

    from services.ai_normalization.config import settings

    uvicorn.run(app, host="127.0.0.1", port=settings.SERVICE_PORT)
