import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "CivicBridge AI - Policy + Impact Service"
    SERVICE_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "policy_impact.db")
    SHREYANK_AI_SERVICE_URL: str = os.getenv("SHREYANK_AI_SERVICE_URL", "http://127.0.0.1:8001")
    JAY_DATA_INTELLIGENCE_URL: str = os.getenv("JAY_DATA_INTELLIGENCE_URL", "http://127.0.0.1:8002")
    ENABLE_MOCK_STUBS: bool = os.getenv("ENABLE_MOCK_STUBS", "true").lower() == "true"


settings = Settings()
