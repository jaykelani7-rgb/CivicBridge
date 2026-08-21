from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[2]


def test_service_has_no_non_google_ai_sdk_or_credentials():
    inspected = [
        SERVICE_ROOT / "pyproject.toml",
        SERVICE_ROOT / ".env.example",
    ]
    content = "\n".join(path.read_text(encoding="utf-8").casefold() for path in inspected)
    forbidden = ("openai", "anthropic", "chatgpt", "claude_api_key")
    assert not any(provider in content for provider in forbidden)


def test_production_cloud_dependencies_are_google_cloud_sdks():
    pyproject = (SERVICE_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert "google-cloud-bigquery" in pyproject
    assert "google-cloud-pubsub" in pyproject


def test_local_configuration_contains_no_credentials_and_google_mode_is_explicit():
    env=(SERVICE_ROOT/".env.example").read_text(encoding="utf-8")
    assert "CB_MODE=local" in env
    assert "CB_ANALYTICAL_BACKEND=local" in env
    assert "CB_STORAGE_BACKEND=sqlite" in env
    assert "CB_BIGQUERY_PROJECT=\n" in env
