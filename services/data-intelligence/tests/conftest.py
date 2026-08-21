from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Optional
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


SERVICE_DIR = Path(__file__).resolve().parents[1]


BASE_REQUESTS = {
    "IN": {
        "country_code":"IN","original_language":"hi-IN","translation_working":"The road floods whenever it rains.",
        "category":"drainage","subcategory":"stormwater_drainage",
        "summary":"Recurring road flooding blocks access during rain in Ward 42.",
        "problem_description":"The road floods during rain.","requested_outcome":"Repair roadside stormwater drainage.",
        "urgency":"high","affected_scope":"community","location_mentions":["Ward 42","Jaipur"],
    },
    "BR": {
        "country_code":"BR","original_language":"pt-BR","translation_working":"Irregular waste collection leaves rubbish in Grajaú streets.",
        "category":"waste","subcategory":"waste_collection",
        "summary":"Coleta de lixo irregular deixa resíduos nas ruas do Grajaú.",
        "problem_description":"Resíduos permanecem nas ruas.","requested_outcome":"Restabelecer uma coleta regular de resíduos.",
        "urgency":"medium","affected_scope":"community","location_mentions":["Grajaú","São Paulo"],
    },
    "ZA": {
        "country_code":"ZA","original_language":"zu-ZA","translation_working":"Repeated water interruptions affect households in Soweto.",
        "category":"water","subcategory":"water_supply",
        "summary":"Repeated water interruptions affect households in Soweto.",
        "problem_description":"Community water service is unreliable.","requested_outcome":"Restore a reliable community water supply.",
        "urgency":"high","affected_scope":"community","location_mentions":["Soweto","Johannesburg"],
    },
}


def event_payload(country: str = "IN", *, event_id: Optional[str] = None, request_id: Optional[str] = None) -> dict:
    data = deepcopy(BASE_REQUESTS[country])
    data.update({
        "request_id":request_id or str(uuid4()),"evidence_types":["voice","repeat_report"],"confidence":0.91,
        "pii_flags":["none"],"needs_human_review":False,"review_reason":None,"model":"configured-gemini-model",
        "prompt_version":"normalize-1.0.0","schema_version":"normalized-request-1.0.0",
    })
    return {"event_id":event_id or str(uuid4()),"event_type":"request.normalized.v1","schema_version":"1.0.0",
            "occurred_at":"2026-08-20T10:30:00Z","producer":"ai-normalization","trace_id":str(uuid4()),"data":data}


@pytest.fixture
def app(tmp_path):
    settings = Settings(environment="test",database_path=str(tmp_path/"intelligence.db"),
                        fixture_dir=str(SERVICE_DIR/"fixtures"))
    application = create_app(settings)
    yield application
    application.state.repository.close()


@pytest.fixture
def client(app):
    return TestClient(app)
