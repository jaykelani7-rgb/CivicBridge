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
from packages.contracts.project import Project
from packages.contracts.impact import ImpactMetricCreateRequest
from services.citizen_channels import main as citizen_main
from services.citizen_channels import telegram
from services.citizen_channels.storage import CitizenStorage
from services.citizen_channels.status_events import apply_status_event
from services.ai_normalization.clients.citizen_channels_client import CitizenChannelsClient
from services.ai_normalization.pipeline.speech import SpeechToTextAdapter
from services.ai_normalization.database import NormalizationRepository
from services.ai_normalization.config import Settings as AISettings
from services.ai_normalization.pipeline.normalization_service import NormalizationService
from packages.event_bus.bus import EventBus
from services.policy_impact.app.database import PolicyImpactRepository
from services.policy_impact.app.services.evidence_validator import EvidenceValidator
from services.policy_impact.app.services.project_impact_service import classify_metric
from services.policy_impact.app.main import app as policy_app
from services.policy_impact.app.api import health as policy_health
from services.policy_impact.app.api import pubsub as policy_pubsub
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
        def publish(self, event):
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


def test_citizen_commit_before_publish_and_confirmation_recover_from_outbox(tmp_path):
    path = str(tmp_path / "citizen.db")
    first = CitizenStorage(database_url=path, media_dir=str(tmp_path / "media"))
    request_id = first.create_request(CreateRequestPayload(channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Drain blocked"))
    first.confirm_request(request_id, notes="The public drain beside the market")
    assert first.pending_outbox_count() == 2
    second = CitizenStorage(database_url=path, media_dir=str(tmp_path / "media"))
    delivered = []
    publisher = SimpleNamespace(publish=lambda event: delivered.append((event.event_id, event.event_type)))
    assert len(second.dispatch_outbox(publisher)) == 2
    assert {kind for _, kind in delivered} == {"request.created.v1", "request.confirmed.v1"}
    assert second.pending_outbox_count() == 0
    assert second.dispatch_outbox(publisher) == []
    assert len(delivered) == 2


def test_startup_keeps_services_available_during_publisher_outage(tmp_path, monkeypatch):
    from services.ai_normalization.main import create_app as create_normalization_app
    class Publisher:
        def __init__(self): self.fail = True; self.events = []
        def subscribe(self, *args): pass
        def publish(self, event):
            if self.fail:
                raise RuntimeError("publisher unavailable")
            self.events.append(event.event_id)

    publisher = Publisher()
    citizen = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    request_id = citizen.create_request(CreateRequestPayload(
        channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur",
        consent=ConsentPayload(accepted=True), text="Drain blocked",
    ))
    monkeypatch.setattr(citizen_main, "citizen_storage", citizen)
    monkeypatch.setattr(citizen_main, "event_bus", publisher)
    with TestClient(citizen_main.app) as client:
        assert client.get("/health").status_code == 200
        assert citizen.pending_outbox_count() == 1

    normalization = NormalizationRepository(str(tmp_path / "normalization.db"))
    result = NormalizedRequestData(
        request_id=request_id, country_code="IN", original_language="en-IN",
        transcript_original="Drain blocked", translation_working="Drain blocked",
        category="drainage", subcategory="blockage", summary="Blocked drain",
        problem_description="Blocked drain", requested_outcome="Clear drain",
        urgency="medium", affected_scope="neighborhood", confidence=.8,
        processing_mode="mock", model="mock-rule-engine",
    )
    event = EventEnvelope(event_type="request.normalized.v1", producer="ai-normalization", data=result.model_dump())
    normalization.save_if_absent(request_id, result, "normalized", event)
    app = create_normalization_app(settings=AISettings(USE_MOCK_SERVICES=True),
                                   repository=normalization, event_bus=publisher)
    with TestClient(app):
        assert normalization.pending_event_count() == 1

    publisher.fail = False
    assert asyncio.run(citizen_main._replay_unpublished()) == 1
    assert normalization.dispatch_pending(publisher) == [event.event_id]
    assert citizen.pending_outbox_count() == normalization.pending_event_count() == 0


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


def test_normalization_commit_retries_same_event_after_publish_ack_crash(tmp_path):
    path = str(tmp_path / "normalization.db")
    repository = NormalizationRepository(path)
    result = NormalizedRequestData(
        request_id="voice-1", country_code="IN", original_language="hi-IN",
        transcript_original="मूल", translation_working="original", category="water",
        subcategory="access", summary="Water access", problem_description="No water",
        requested_outcome="Restore water", urgency="medium", affected_scope="neighborhood",
        confidence=.7, needs_human_review=True, processing_mode="mock", model="mock-rule-engine",
    )
    event = EventEnvelope(event_id="normalization-event-1", event_type="request.needs_review.v1",
                          producer="ai-normalization", data=result.model_dump())
    repository.save("voice-1", result, "needs_review", event)
    delivered = []

    def crash_after_publish(envelope):
        delivered.append(envelope.event_id)
        raise RuntimeError("ack lost after publish")

    with pytest.raises(RuntimeError, match="ack lost"):
        repository.dispatch_pending(SimpleNamespace(publish=crash_after_publish))
    restarted = NormalizationRepository(path)
    assert restarted.get("voice-1").status == "needs_review"
    assert restarted.pending_event_count() == 1
    assert restarted.dispatch_pending(SimpleNamespace(publish=lambda envelope: delivered.append(envelope.event_id))) == [event.event_id]
    assert delivered == [event.event_id, event.event_id]
    assert restarted.dispatch_pending(SimpleNamespace(publish=lambda envelope: delivered.append(envelope.event_id))) == []


def test_normalization_duplicate_delivery_only_queues_one_result(tmp_path):
    path = str(tmp_path / "normalization.db")
    first = NormalizationRepository(path)
    second = NormalizationRepository(path)
    result = NormalizedRequestData(
        request_id="report-1", country_code="IN", original_language="en-IN",
        transcript_original="Drain blocked", translation_working="Drain blocked",
        category="drainage", subcategory="blockage", summary="Blocked drain",
        problem_description="Blocked drain", requested_outcome="Clear drain",
        urgency="medium", affected_scope="neighborhood", confidence=.8,
        processing_mode="mock", model="mock-rule-engine",
    )
    one = EventEnvelope(event_id="normalized-once", event_type="request.normalized.v1",
                        producer="ai-normalization", data=result.model_dump())
    two = EventEnvelope(event_id="duplicate-delivery", event_type="request.normalized.v1",
                        producer="ai-normalization", data=result.model_dump())
    assert first.save_if_absent("report-1", result, "normalized", one)[1] is True
    assert second.save_if_absent("report-1", result, "normalized", two)[1] is False
    assert second.get("report-1").attempts == 1
    delivered = []
    assert second.dispatch_pending(SimpleNamespace(publish=lambda event: delivered.append(event.event_id))) == [one.event_id]
    assert delivered == ["normalized-once"]


def test_policy_project_retry_and_legacy_duplicates_are_preserved(tmp_path):
    path = str(tmp_path / "policy.db")
    timestamp = "2026-09-30T00:00:00Z"
    def make_project(project_id, recommendation_id):
        return Project(project_id=project_id, recommendation_id=recommendation_id,
                       hotspot_id="hotspot-1", title="Assess drainage", created_at=timestamp, updated_at=timestamp)

    # A pre-existing database can already contain two projects for one
    # recommendation; migration must retain both records.
    with sqlite3.connect(path) as connection:
        connection.execute("""CREATE TABLE projects (project_id TEXT PRIMARY KEY, recommendation_id TEXT NOT NULL,
            hotspot_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
            data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")
        for project_id in ("legacy-a", "legacy-b"):
            project = make_project(project_id, "old-rec")
            connection.execute("INSERT INTO projects VALUES(?,?,?,?,?,?,?,?)", (
                project.project_id, project.recommendation_id, project.hotspot_id,
                project.title, project.status.value, json.dumps(project.model_dump()),
                timestamp, timestamp,
            ))
    assert migrate("policy", path) == ["001_initial", "002_outbox"]
    repository = PolicyImpactRepository(path)
    assert repository.get_project_by_recommendation("old-rec").project_id == "legacy-a"
    assert len(repository.list_projects()) == 2
    old_event = EventEnvelope(event_type="project.status.updated.v1", producer="policy-impact", data={})
    selected, created = repository.create_project_once(make_project("new-legacy", "old-rec"), old_event)
    assert selected.project_id == "legacy-a" and not created
    assert len(repository.list_projects()) == 2

    project = make_project("project-1", "rec-1")
    event = EventEnvelope(event_id="project-event-1", event_type="project.status.updated.v1",
                          producer="policy-impact", data=project.model_dump())
    first, created = repository.create_project_once(project, event)
    assert first.project_id == "project-1" and created
    restarted = PolicyImpactRepository(path)
    second, created = restarted.create_project_once(make_project("project-2", "rec-1"), event)
    assert second.project_id == "project-1" and not created
    assert len(restarted.list_projects()) == 3
    assert restarted.pending_event_count() == 1
    delivered = []
    restarted.dispatch_pending(SimpleNamespace(publish=lambda envelope: delivered.append(envelope.event_id)))
    assert delivered == [event.event_id]
    assert restarted.pending_event_count() == 0


def test_policy_readiness_does_not_claim_an_exercised_integration(monkeypatch):
    monkeypatch.setattr(policy_health.httpx, "get", lambda *args, **kwargs: SimpleNamespace(status_code=200))
    client = TestClient(policy_app)
    assert client.get("/health").json()["probe"] == "process_only"
    ready = client.get("/ready").json()
    assert ready["status"] == "ready"
    assert ready["reachable"] == {"database": True, "ai_health": True, "intelligence_health": True}
    assert ready["exercised"] is False


def test_real_hotspot_and_nested_decision_envelopes_cross_service_boundaries(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    request_id = storage.create_request(CreateRequestPayload(
        channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur",
        consent=ConsentPayload(accepted=True), text="Blocked public drain",
    ))
    hotspot_data = {
        "hotspot_id": "hotspot-1", "request_ids": [request_id], "country_code": "IN",
        "geography_id": "IN-RJ-JPR-W42", "category": "drainage", "request_count": 1,
        "unique_request_count": 1, "affected_population": 0, "trend_30d": 0,
        "need_score": 66, "action_score": 61, "evidence_confidence": .6,
        "score_version": "priority-1.0.0", "evidence_bundle_id": "bundle-1",
        "calculated_at": "2026-09-30T00:00:00Z",
    }
    hotspot_event = EventEnvelope(event_id="real-hotspot-1", event_type="hotspot.updated.v1",
                                  producer="data-intelligence", data=hotspot_data)
    captured = []
    fake_repo = SimpleNamespace(get_recommendation_for_inbound_event=lambda event_id: None)
    fake_service = SimpleNamespace(repo=fake_repo, create_recommendation=lambda req, **kwargs: captured.append(req))
    monkeypatch.setattr(policy_pubsub, "service", fake_service)
    wrapped = {"message": {"data": base64.b64encode(json.dumps(hotspot_event.model_dump(mode="json")).encode()).decode(),
                           "messageId": "pubsub-message-1"}, "subscription": "test-sub"}
    assert TestClient(policy_app).post("/pubsub/hotspot-updated", json=wrapped).status_code == 204
    assert captured[0].hotspot_id == "hotspot-1"
    monkeypatch.setattr(policy_app.state, "delivery_ledger", SimpleNamespace(begin=lambda *args: "duplicate"))
    assert TestClient(policy_app).post("/pubsub/hotspot-updated", json=wrapped).status_code == 503
    monkeypatch.setattr(policy_app.state, "delivery_ledger", None)

    apply_status_event(storage, hotspot_event)
    apply_status_event(storage, EventEnvelope(event_id="real-rec-1", event_type="recommendation.created.v1",
                                             producer="policy-impact", data={"hotspot_id": "hotspot-1", "recommendation_id": "rec-1"}))
    decision_event = EventEnvelope(event_id="real-decision-1", event_type="policy.decision.recorded.v1",
                                   producer="policy-impact", data={"decision": {
                                       "decision_id": "decision-1", "recommendation_id": "rec-1",
                                       "action": "approve_for_assessment", "decided_at": "2026-09-30T00:01:00Z",
                                   }, "recommendation_status": "approved_for_assessment", "human_approved": True})
    apply_status_event(storage, decision_event)
    assert storage.get_request(request_id)["processing_stage"] == "policy_approved"


@pytest.mark.parametrize("service,table", [
    ("citizen", "citizen_requests"),
    ("normalization", "normalization_records"),
    ("policy", "impact_metrics"),
])
def test_additive_schema_migration_is_repeatable_and_preserves_rows(tmp_path, service, table):
    path = str(tmp_path / f"{service}.db")
    applied = migrate(service, path)
    assert applied[0] == "001_initial" and all(version[:3].isdigit() for version in applied)
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


def test_out_of_order_events_wait_for_relationship_and_never_regress_progress(tmp_path, monkeypatch):
    storage = CitizenStorage(database_url=str(tmp_path / "citizen.db"), media_dir=str(tmp_path / "media"))
    monkeypatch.setattr(citizen_main, "citizen_storage", storage)
    request_id = storage.create_request(CreateRequestPayload(channel="web_text", country_code="IN", language_hint="en-IN", administrative_area="Jaipur", consent=ConsentPayload(accepted=True), text="Drain blocked"))

    def emit(kind, event_id, occurred_at, **data):
        event = EventEnvelope(event_id=event_id, event_type=kind, producer="test", occurred_at=occurred_at, data=data)
        asyncio.run(citizen_main.PUSH_HANDLERS[kind](event))
        return event

    metric = emit("impact.metric.updated.v1", "metric-1", "2026-09-30T05:00:00Z", project_id="project-1", outcome_status="improving", source_type="manual")
    emit("project.status.updated.v1", "project-completed", "2026-09-30T04:00:00Z", recommendation_id="rec-1", project_id="project-1", status="completed", updated_at="2026-09-30T04:00:00Z")
    emit("policy.decision.recorded.v1", "decision-1", "2026-09-30T03:00:00Z", recommendation_id="rec-1", action="approve_for_assessment", decided_at="2026-09-30T03:00:00Z")
    emit("recommendation.created.v1", "rec-event", "2026-09-30T02:00:00Z", hotspot_id="hotspot-1", recommendation_id="rec-1")
    assert storage.get_public_status(request_id).processing_stage == "submitted"
    assert not storage.event_seen(metric.event_id)
    emit("hotspot.updated.v1", "hotspot-event", "2026-09-30T01:00:00Z", hotspot_id="hotspot-1", request_ids=[request_id], action_score=71)
    public = storage.get_public_status(request_id)
    assert public.processing_stage == "outcome_tracking"
    assert (public.hotspot_id, public.recommendation_id, public.project_id) == ("hotspot-1", "rec-1", "project-1")
    assert public.project_status == "completed" and public.outcome_status == "improving"
    assert storage.event_seen(metric.event_id)
    emit("project.status.updated.v1", "project-old", "2026-09-30T00:00:00Z", recommendation_id="rec-1", project_id="project-1", status="candidate", updated_at="2026-09-30T00:00:00Z")
    emit("request.normalized.v1", "normalized-old", "2026-09-30T00:30:00Z", request_id=request_id, summary="Blocked drain", category="drainage")
    again = storage.get_public_status(request_id)
    assert again.processing_stage == "outcome_tracking" and again.project_status == "completed"
    assert again.public_summary == public.public_summary
    assert again.normalized_summary == "Blocked drain"
    asyncio.run(citizen_main.handle_impact_metric(metric))
    assert storage.get_public_status(request_id).model_dump() == again.model_dump()


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
