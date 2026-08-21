import pytest
from pydantic import ValidationError

from app.schemas.events import EventEnvelope, NormalizedRequest
from app.config.settings import Settings
from tests.conftest import event_payload


def test_unknown_optional_fields_are_ignored():
    payload = event_payload()
    payload["data"]["future_optional_field"] = {"safe":True}
    assert EventEnvelope[NormalizedRequest].model_validate(payload).data.category == "drainage"


@pytest.mark.parametrize("mutation",[
    lambda p:p["data"].pop("summary"),
    lambda p:p["data"].update(category="invalid"),
    lambda p:p["data"].update(confidence=2),
    lambda p:p["data"].update(email="citizen@example.com"),
])
def test_invalid_normalized_requests_fail(mutation):
    payload = event_payload()
    mutation(payload)
    with pytest.raises(ValidationError):
        EventEnvelope[NormalizedRequest].model_validate(payload)


def test_invalid_google_configuration_fails_clearly():
    with pytest.raises(ValueError,match="BigQuery project and dataset"):
        Settings(runtime_mode="google",analytical_backend="bigquery",geography_provider="bigquery").validate()


def test_google_mode_selects_bigquery_but_keeps_sqlite_operational_store():
    settings=Settings.from_env({"CB_MODE":"google","CB_BIGQUERY_PROJECT":"demo-project",
                                "CB_BIGQUERY_DATASET":"intelligence","CB_BIGQUERY_LOCATION":"asia-south1"})
    assert settings.storage_backend=="sqlite"
    assert settings.analytical_backend=="bigquery"
    assert settings.geography_provider=="bigquery"
    assert settings.effective_raw_dataset=="intelligence_raw"
    assert settings.bigquery_s2_level==13


def test_local_mode_needs_no_google_credentials():
    settings=Settings.from_env({})
    assert settings.runtime_mode=="local"
    assert settings.analytical_backend=="local"
    assert settings.geography_provider=="local"
    assert settings.bigquery_project is None


def test_invalid_bigquery_identifier_is_rejected():
    with pytest.raises(ValueError,match="invalid identifier"):
        Settings.from_env({"CB_MODE":"google","CB_BIGQUERY_PROJECT":"unsafe.project;drop",
                           "CB_BIGQUERY_DATASET":"intelligence"})
