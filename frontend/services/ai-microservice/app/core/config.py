from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="development", alias="RESOURCE_MATCH_ENV")
    api_key: str = Field(default="local-dev-key", alias="RESOURCE_MATCH_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    database_url: str = Field(default="", alias="DATABASE_URL")
    ocr_confidence_threshold: float = Field(
        default=0.85,
        alias="OCR_CONFIDENCE_THRESHOLD",
    )
    decay_interval_minutes: int = Field(
        default=15,
        alias="DECAY_INTERVAL_MINUTES",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
