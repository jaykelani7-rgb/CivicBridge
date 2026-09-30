import asyncio
import base64
import io
import json
import sqlite3
import wave
from types import SimpleNamespace

import httpx
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from packages.contracts.citizen import ConsentPayload, CreateRequestPayload
from packages.contracts.envelope import EventEnvelope
from packages.contracts.normalization import NormalizedRequestData
from packages.contracts.recommendation import Recommendation
from packages.contracts.impact import ImpactMetricCreateRequest
from services.citizen_channels import main as citizen_main
from services.citizen_channels import telegram
from services.citizen_channels.storage import CitizenStorage
from services.ai_normalization.clients.citizen_channels_client import CitizenChannelsClient
from services.ai_normalization.pipeline.speech import SpeechToTextAdapter
from services.ai_normalization.database import NormalizationRepository
from services.ai_normalization.config import Settings as AISettings
from services.ai_normalization.pipeline.normalization_service import NormalizationService
from packages.event_bus.bus import EventBus
from services.policy_impact.app.database import PolicyImpactRepository
from services.policy_impact.app.services.evidence_validator import EvidenceValidator
from services.policy_impact.app.services.project_impact_service import classify_metric
from scripts.official_pilot import validate_catalog
from scripts.migrate_platform import migrate


def make_wav(sample: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(sample.to_bytes(2, "little", signed=True) * 8000)
    return output.getvalue()


def test_citizen_records_media_and_event_receipts_survive_restart(tmp_path):
    database = str(tmp_path / "citizen.db")
    media = str(tmp_path / "media")
    first = CitizenStorage(database_url=database, media_dir=media)
    payload = CreateRequestPayload(channel="web_voice", country_code="IN", language_hint="hi-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Also check the drain")
    request_id = first.create_request(payload, idempotency_key="source:1")
    a = first.attach_media(request_id, "voice.wav", make_wav(100), "audio/wav")
    b = first.attach_media(request_id, "photo.png", b"\x89PNG\r\n\x1a\nimage", "image/png")
    first.mark_event("event:1")
    second = CitizenStorage(database_url=database, media_dir=media)
    assert second.create_request(payload, idempotency_key="source:1") == request_id
    assert second.event_seen("event:1")
    assert len(second.get_request(request_id)["media"]) == 2
    assert second.get_media(request_id, a)[0] == make_wav(100)
    assert second.get_media(request_id, b)[1] == "image/png"
    assert second.get_media("other-request", a) is None


def test_unpublished_citizen_event_replays_with_stable_id_after_restart(tmp_path, monkeypatch):
    database = str(tmp_path / "citizen.db")
    media = str(tmp_path / "media")
    first = CitizenStorage(database_url=database, media_dir=media)
    monkeypatch.setattr(citizen_main, "citizen_storage", first)
    request_id = first.create_request(CreateRequestPayload(channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Drain blocked"))
    event_id = first.get_request(request_id)["created_event_id"]

    class Publisher:
        def __init__(self): self.fail = True; self.events = []
        async def publish(self, event):
            self.events.append(event.event_id)
            if self.fail: raise RuntimeError("publisher unavailable")

    publisher = Publisher()
    monkeypatch.setattr(citizen_main, "event_bus", publisher)
    with pytest.raises(RuntimeError):
        asyncio.run(citizen_main._publish_created(request_id, "trace-1"))
    second = CitizenStorage(database_url=database, media_dir=media)
    monkeypatch.setattr(citizen_main, "citizen_storage", second)
    assert second.unpublished_requests() == [request_id]
    publisher.fail = False
    assert asyncio.run(citizen_main._replay_unpublished()) == 1
    assert asyncio.run(citizen_main._replay_unpublished()) == 0
    assert publisher.events == [event_id, event_id]
    assert second.get_request(request_id)["event_published"] is True


def test_normalization_and_policy_records_survive_restart(tmp_path):
    normalized = NormalizedRequestData(request_id="r1", country_code="IN", original_language="hi-IN", transcript_original="मूल", translation_working="original", category="water", subcategory="access", summary="Water access", problem_description="No water", requested_outcome="Restore water", urgency="medium", affected_scope="neighborhood", confidence=.7, needs_human_review=True, processing_mode="mock", model="mock-rule-engine")
    normalization_path = str(tmp_path / "normalization.db")
    first = NormalizationRepository(normalization_path)
    first.save("r1", normalized, "needs_review")
    second = NormalizationRepository(normalization_path)
    assert second.get("r1").result.transcript_original == "मूल"
    assert second.list_needs_review()[0].status == "needs_review"
    policy_path = str(tmp_path / "policy.db")
    policy = PolicyImpactRepository(policy_path)
    recommendation = Recommendation(recommendation_id="rec-1", hotspot_id="hs-1", evidence_bundle_id="evb-1", title="Assess water", problem="Water access", proposed_intervention="Field survey", created_at="2026-09-30T00:00:00Z", updated_at="2026-09-30T00:00:00Z")
    policy.save_recommendation(recommendation)
    other_instance = PolicyImpactRepository(policy_path)
    assert other_instance.get_recommendation("rec-1").intended_beneficiaries is None


@pytest.mark.parametrize("service,table", [
    ("citizen", "citizen_requests"),
    ("normalization", "normalization_records"),
    ("policy", "impact_metrics"),
])
def test_additive_schema_migration_is_repeatable_and_preserves_rows(tmp_path, service, table):
    path = str(tmp_path / f"{service}.db")
    assert migrate(service, path) == ["001_initial"]
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        connection.execute("CREATE TABLE IF NOT EXISTS existing_records (id TEXT PRIMARY KEY)")
        connection.execute("INSERT INTO existing_records VALUES ('old-record')")
    assert migrate(service, path) == []
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT id FROM existing_records").fetchone() == ("old-record",)


def test_authenticated_media_endpoint_and_distinct_audio_handoff(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    monkeypatch.setenv("CITIZEN_INTERNAL_TOKEN", "test-internal-secret")
    payload = CreateRequestPayload(channel="web_voice", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True))
    request_id = storage.create_request(payload)
    refs = [storage.attach_media(request_id, f"voice-{n}.wav", make_wav(n), "audio/wav") for n in (100, 200)]
    app_client = TestClient(citizen_main.app)
    assert app_client.get(f"/internal/v1/requests/{request_id}/media", params={"media_ref": refs[0]}).status_code == 403
    assert app_client.get(f"/internal/v1/requests/{request_id}/media", params={"media_ref": refs[0]}, headers={"X-Internal-Token": "wrong"}).status_code == 403
    values = []
    for ref in refs:
        response = app_client.get(f"/internal/v1/requests/{request_id}/media", params={"media_ref": ref}, headers={"X-Internal-Token": "test-internal-secret"})
        values.append(response.content)
    assert values[0] != values[1]

    def fake_get(url, *, params, headers, timeout):
        assert headers["X-Internal-Token"] == "test-internal-secret"
        response = app_client.get(url.replace("http://citizen", ""), params=params, headers=headers)
        return httpx.Response(response.status_code, headers=response.headers, content=response.content, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)
    client = CitizenChannelsClient(base_url="http://citizen", allow_mock=False, internal_token="test-internal-secret")
    assert [client.get_audio(request_id, ref) for ref in refs] == values
    heard = []
    adapter = SpeechToTextAdapter(use_mock=True)
    adapter.use_mock = False
    adapter._client = SimpleNamespace(recognize=lambda **kwargs: heard.append(kwargs["content"]) or SimpleNamespace(results=[SimpleNamespace(alternatives=[SimpleNamespace(transcript="heard")])]))
    for value, ref in zip(values, refs):
        assert adapter.transcribe(media_ref=ref, media_type="audio/wav", language_code="en-IN", audio_content=value) == ("heard", "ok")
    assert heard == values
    assert adapter.transcribe(media_ref=refs[0], media_type="audio/wav", language_code="en-IN", audio_content=None)[1] == "failed"


def test_voice_with_written_context_preserves_both_in_explicit_demo_mode(tmp_path):
    class CitizenClient:
        def get_content(self, request_id):
            return {"request_id": request_id, "channel": "web_voice", "country_code": "IN", "language_hint": "en-IN", "text": "The clinic entrance is also blocked.", "media_ref": "private://voice", "media_type": "audio/wav"}

    service = NormalizationService(
        settings=AISettings(USE_MOCK_SERVICES=True),
        repository=NormalizationRepository(str(tmp_path / "normalization.db")),
        event_bus=EventBus(), citizen_client=CitizenClient(),
    )
    record, _ = service.normalize_request("voice-and-text")
    assert "streetlights" in record.result.transcript_original.lower()
    assert "Written context: The clinic entrance is also blocked." in record.result.transcript_original
    assert "Written context: The clinic entrance is also blocked." in record.result.translation_working
    assert record.result.processing_mode == "mock"


def test_telegram_secret_consent_and_duplicate_delivery(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(telegram, "citizen_storage", storage)
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "test-secret")
    replies = []

    async def fake_call(token, method, payload):
        assert token == "test-token" and method == "sendMessage"
        replies.append(payload["text"])
        return {"message_id": len(replies)}

    monkeypatch.setattr(telegram, "_telegram_call", fake_call)
    client = TestClient(citizen_main.app)
    def send(update_id, text, secret="test-secret"):
        return client.post("/v1/channels/telegram/webhook", json={"update_id": update_id, "message": {"chat": {"id": 44}, "text": text}}, headers={"X-Telegram-Bot-Api-Secret-Token": secret})

    assert send(1, "/start", "wrong").status_code == 403
    assert send(1, "Flooding on my road").status_code == 200
    assert "provide country" in replies[-1]
    for update_id, command in ((2, "/country IN"), (3, "/language en-IN"), (4, "/area Jaipur"), (5, "/agree")):
        assert send(update_id, command).status_code == 200
    result = send(6, "Flooding on my road")
    assert result.status_code == 200
    assert "Tracking reference:" in replies[-1]
    assert len(storage.list_requests()) == 1
    assert send(6, "Flooding on my road").json()["status"] == "duplicate"
    assert len(storage.list_requests()) == 1
    assert storage.list_requests()[0]["channel"] == "telegram_text"


def test_citizen_status_follows_hotspot_recommendation_and_project(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    request_id = storage.create_request(CreateRequestPayload(channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Blocked drain"))

    def emit(kind, event_id, **data):
        asyncio.run({
            "hotspot.updated.v1": citizen_main.handle_hotspot_updated,
            "recommendation.created.v1": citizen_main.handle_recommendation_created,
            "policy.decision.recorded.v1": citizen_main.handle_policy_decision,
            "project.status.updated.v1": citizen_main.handle_project_status,
            "impact.metric.updated.v1": citizen_main.handle_impact_metric,
        }[kind](EventEnvelope(event_id=event_id, event_type=kind, producer="test", data=data)))

    emit("hotspot.updated.v1", "event-h", hotspot_id="hotspot-1", request_ids=[request_id], action_score=71)
    emit("recommendation.created.v1", "event-r", hotspot_id="hotspot-1", recommendation_id="rec-1")
    emit("policy.decision.recorded.v1", "event-d", recommendation_id="rec-1", action="approve_for_assessment")
    emit("project.status.updated.v1", "event-p", recommendation_id="rec-1", project_id="project-1", status="candidate")
    emit("project.status.updated.v1", "event-p", recommendation_id="rec-1", project_id="project-1", status="completed")
    public = storage.get_public_status(request_id).model_dump()
    assert public["processing_stage"] == "project_active"
    assert public["project_status"] == "candidate"
    assert public["hotspot_id"] == "hotspot-1"
    assert public["recommendation_id"] == "rec-1"
    assert "text" not in public and "consent" not in public
    emit("impact.metric.updated.v1", "event-m", project_id="project-1", outcome_status="improving", source_type="manual", baseline=10, current=8)
    measured = storage.get_public_status(request_id).model_dump()
    assert measured["processing_stage"] == "outcome_tracking"
    assert measured["outcome_status"] == "improving"
    assert measured["measurement_source_type"] == "manual"
    assert "10" not in measured["public_summary"] and "8" not in measured["public_summary"]
    assert "caused" in measured["public_summary"]
    emit("impact.metric.updated.v1", "event-m", project_id="project-1", outcome_status="deteriorating", source_type="independently_verified")
    assert storage.get_public_status(request_id).outcome_status == "improving"


def test_authenticated_pubsub_push_updates_status_once(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    monkeypatch.setenv("CITIZEN_INTERNAL_TOKEN", "local-push-secret")
    request_id = storage.create_request(CreateRequestPayload(channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Blocked drain"))
    event = EventEnvelope(event_id="pubsub-1", event_type="hotspot.updated.v1", producer="data-intelligence", data={"hotspot_id": "hs-1", "request_ids": [request_id], "action_score": 52})
    payload = {"message": {"data": base64.b64encode(json.dumps(event.model_dump()).encode()).decode()}}
    client = TestClient(citizen_main.app)
    assert client.post("/internal/v1/events/pubsub", json=payload).status_code == 403
    assert client.post("/internal/v1/events/pubsub", json=payload, headers={"X-Internal-Token": "local-push-secret"}).status_code == 204
    assert storage.get_public_status(request_id).hotspot_id == "hs-1"
    storage.update_stage_from_event(request_id, "manual_review")
    assert client.post("/internal/v1/events/pubsub", json=payload, headers={"X-Internal-Token": "local-push-secret"}).status_code == 204
    assert storage.get_public_status(request_id).processing_stage == "manual_review"


def test_citizen_status_keeps_normalized_summary_and_exposes_processing_failure(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    request_id = storage.create_request(CreateRequestPayload(channel="web_voice", country_code="IN", language_hint="hi-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True)))
    asyncio.run(citizen_main.handle_request_needs_review(EventEnvelope(event_type="request.needs_review.v1", producer="test", data={"request_id": request_id, "speech_status": "failed", "processing_mode": "degraded"})))
    public = storage.get_public_status(request_id)
    assert public.processing_stage == "processing_failed" and public.normalized_summary is None
    assert "retry" in public.public_summary
    asyncio.run(citizen_main.handle_request_normalized(EventEnvelope(event_type="request.normalized.v1", producer="test", data={"request_id": request_id, "summary": "The drain is blocked", "processing_mode": "mock"})))
    storage.update_stage_from_event(request_id, "recommended", public_summary="A proposal awaits review")
    public = storage.get_public_status(request_id)
    assert public.normalized_summary == "The drain is blocked"
    assert public.public_summary == "A proposal awaits review"
    assert public.processing_mode == "mock"


def test_grounding_rejects_invented_quantity_but_allows_ward_identifier():
    bundle = {"demographic_indicators": {"affected_population": 5000}}
    traces = EvidenceValidator.require_supported_numbers({"problem": "Ward 42 has 5,000 affected residents.", "intended_beneficiaries": 5000}, bundle)
    assert all(trace["source_field"] == "demographic_indicators.affected_population" for trace in traces)
    with pytest.raises(ValueError, match="Unsupported numerical claim"):
        EvidenceValidator.require_supported_numbers({"problem": "Ward 42 has 10,000 affected residents."}, bundle)


def test_official_pilot_requires_matching_geography_period_and_source_files(tmp_path):
    source = {"publisher": "Test publisher", "url": "https://example.test/data", "retrieved_at": "2026-09-30", "reference_year": 2025, "geography_level": "ward", "boundary_version": "wards-v1", "dataset_version": "v1", "transformation": "Test-only row", "reuse_terms": "Test only", "reuse_cleared": True}
    catalog = {"target_geography_id": "ward-1", "target_geography_level": "ward", "target_boundary_version": "wards-v1", "target_reference_year": 2026, "sources": [{**source, "source_id": kind, "kind": kind, "asset_file": f"{kind}.csv"} for kind in ("demographic", "infrastructure", "investment")]}
    for kind in ("demographic", "infrastructure", "investment"):
        (tmp_path / f"{kind}.csv").write_text(f"source_id,geography_id,boundary_version,reference_year,value\n{kind},ward-1,wards-v1,2025,1\n")
    records, errors = validate_catalog(catalog, tmp_path)
    assert not errors and len(records) == 3
    catalog["sources"][1]["geography_level"] = "suburb"
    catalog["sources"][2]["reference_year"] = 2011
    _, errors = validate_catalog(catalog, tmp_path)
    assert any("without a validated crosswalk" in error for error in errors)
    assert any("stale" in error for error in errors)


@pytest.mark.parametrize("direction,baseline,current,target,expected", [
    ("lower_is_better", 10, 8, 5, "improving"),
    ("lower_is_better", 10, 12, 5, "deteriorating"),
    ("higher_is_better", 10, 12, 15, "improving"),
    ("higher_is_better", 10, 8, 15, "deteriorating"),
    ("higher_is_better", 10, 15, 15, "target_achieved"),
    ("lower_is_better", 10, 5, 5, "target_achieved"),
    ("lower_is_better", 10, 10, 5, "unchanged"),
    ("higher_is_better", None, 12, 15, "pending"),
])
def test_metric_direction(direction, baseline, current, target, expected):
    assert classify_metric(baseline, current, target, direction) == expected


def test_staff_measurement_cannot_self_attest_independent_verification():
    with pytest.raises(ValidationError):
        ImpactMetricCreateRequest(metric_code="flooding", unit="reports/month", source_id="staff-entry", source_type="independently_verified")
