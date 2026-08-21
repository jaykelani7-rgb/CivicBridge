import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "CivicBridge AI - Policy + Impact Service"
    SERVICE_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "data/policy_impact.db")
    SHREYANK_AI_SERVICE_URL: str = os.getenv("SHREYANK_AI_SERVICE_URL", "http://127.0.0.1:8001")
    JAY_DATA_INTELLIGENCE_URL: str = os.getenv("JAY_DATA_INTELLIGENCE_URL", "http://127.0.0.1:8002")
    ENABLE_MOCK_STUBS: bool = os.getenv("ENABLE_MOCK_STUBS", "true").lower() == "true"
    EVENT_BUS: str = os.getenv("POLICY_EVENT_BUS", "memory")
    PUBSUB_PROJECT: str = os.getenv("POLICY_PUBSUB_PROJECT", "")
    RECOMMENDATION_TOPIC: str = os.getenv("POLICY_RECOMMENDATION_TOPIC", "recommendation-created-v1")
    DECISION_TOPIC: str = os.getenv("POLICY_DECISION_TOPIC", "policy-decision-recorded-v1")
    PROJECT_TOPIC: str = os.getenv("POLICY_PROJECT_TOPIC", "project-status-updated-v1")
    IMPACT_TOPIC: str = os.getenv("POLICY_IMPACT_TOPIC", "impact-metric-updated-v1")
    IDEMPOTENCY_BACKEND: str = os.getenv("POLICY_IDEMPOTENCY_BACKEND", "local")
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")
    BIGQUERY_DATASET: str = os.getenv("POLICY_BIGQUERY_DATASET", "civicbridge_policy_impact")
    AUTHENTICATE_CLOUD_RUN: bool = os.getenv("POLICY_AUTHENTICATE_CLOUD_RUN", "false").lower() == "true"


settings = Settings()
