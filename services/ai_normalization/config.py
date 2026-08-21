"""
Configuration for the AI Normalization service (owned by Shreyank).

Follows the same environment-variable-driven, mock-first pattern used by the
other CivicBridge services (see services/policy_impact/app/config.py and
services/data-intelligence/app/config/settings.py) so the whole backend can
run without any Google Cloud credentials via USE_MOCK_SERVICES=true, and can
be pointed at real Speech-to-Text / Translation / Vertex AI Gemini by setting
GCP_PROJECT_ID and flipping the flag off.
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "CivicBridge AI - AI Normalization Service"
    SERVICE_OWNER: str = "Shreyank"
    SERVICE_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Host service dependency (Sujal's Citizen Channels service)
    CITIZEN_CHANNELS_URL: str = os.getenv("CITIZEN_CHANNELS_URL", "http://127.0.0.1:8000")
    CITIZEN_CHANNELS_TIMEOUT_SECONDS: float = float(os.getenv("CITIZEN_CHANNELS_TIMEOUT_SECONDS", "3.0"))

    # Google Cloud / Vertex AI configuration
    USE_MOCK_SERVICES: bool = os.getenv("USE_MOCK_SERVICES", "true").lower() == "true"
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")
    GEMINI_MODEL_NAME: str = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

    # Deterministic validation thresholds (Section 10 of the hackathon blueprint)
    CONFIDENCE_REVIEW_THRESHOLD: float = float(os.getenv("CONFIDENCE_REVIEW_THRESHOLD", "0.60"))
    DUPLICATE_SIMILARITY_THRESHOLD: float = float(os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", "0.82"))

    # Versioning (must stay in sync with packages/contracts/normalization.py)
    SCHEMA_VERSION: str = "normalized-request-1.0.0"
    PROMPT_VERSION: str = "normalize-1.0.0"
    RECOMMENDATION_PROMPT_VERSION: str = "policy-brief-draft-1.0.0"

    SERVICE_PORT: int = int(os.getenv("AI_NORMALIZATION_PORT", "8001"))


settings = Settings()
