"""Telegram webhook adapter. Shares the canonical citizen request and media store."""
import hmac
import os
from pathlib import PurePosixPath
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException

from packages.contracts.citizen import ConsentPayload, CreateRequestPayload
from services.citizen_channels.storage import citizen_storage

router = APIRouter()


def _settings() -> tuple[str, str]:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    secret = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    if not token or not secret:
        raise HTTPException(503, "Telegram is not configured")
    return token, secret


async def _telegram_call(token: str, method: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"https://api.telegram.org/bot{token}/{method}", json=payload)
        response.raise_for_status()
        result = response.json()
    if not result.get("ok"):
        raise RuntimeError(f"Telegram {method} failed")
    return result["result"]


async def _download_voice(token: str, file_id: str) -> tuple[str, bytes]:
    info = await _telegram_call(token, "getFile", {"file_id": file_id})
    path = info.get("file_path", "")
    if not path or PurePosixPath(path).is_absolute() or ".." in PurePosixPath(path).parts:
        raise ValueError("Invalid Telegram media path")
    if info.get("file_size", 0) > 10 * 1024 * 1024:
        raise ValueError("Voice message exceeds the 10 MB limit")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"https://api.telegram.org/file/bot{token}/{path}")
        response.raise_for_status()
        content = response.content
    return path, content


@router.post("/v1/channels/telegram/webhook")
async def telegram_webhook(update: dict[str, Any], secret_header: str = Header("", alias="X-Telegram-Bot-Api-Secret-Token")):
    token, secret = _settings()
    if not hmac.compare_digest(secret_header, secret):
        raise HTTPException(403, "Invalid Telegram webhook secret")
    update_id = update.get("update_id")
    if not isinstance(update_id, int):
        raise HTTPException(422, "Missing Telegram update ID")
    event_id = f"telegram:{update_id}"
    if citizen_storage.event_seen(event_id):
        return {"status": "duplicate"}
    message = update.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("chat"), dict):
        citizen_storage.mark_event(event_id)
        return {"status": "ignored"}
    chat_id = str(message["chat"]["id"])
    channel_id = f"telegram:{chat_id}"
    state = citizen_storage.get_channel_session(channel_id)
    text = str(message.get("text") or message.get("caption") or "").strip()
    command, _, argument = text.partition(" ")
    command = command.split("@", 1)[0].lower()
    answer = ""
    if command in ("/start", "/help"):
        answer = "CivicBridge records development requests. Set /country IN, BR or ZA; /language en-IN (or your language); /area your district or ward; then /agree to consent. Send text or a voice note after that. /privacy explains access."
    elif command == "/privacy":
        answer = "Your report and voice are stored privately for review and aggregation. Staff can access the report; public tracking shows status only. Do not send names or sensitive details."
    elif command == "/country":
        country = argument.strip().upper()
        if country not in {"IN", "BR", "ZA"}:
            answer = "Choose /country IN, BR or ZA."
        else:
            state["country_code"] = country
            answer = f"Country set to {country}."
    elif command == "/language":
        language = argument.strip()
        if not language or len(language) > 24 or not all(c.isalnum() or c == "-" for c in language):
            answer = "Use a language code such as /language en-IN or /language hi-IN."
        else:
            state["language_hint"] = language
            answer = f"Language set to {language}."
    elif command == "/area":
        area = argument.strip()
        if len(area) < 2 or len(area) > 160:
            answer = "Use /area followed by your district, ward or municipality."
        else:
            state["administrative_area"] = area
            answer = "Area recorded."
    elif command == "/agree":
        state["consent"] = True
        answer = "Consent recorded. Send a development request by text or voice."
    elif command == "/withdraw":
        state["consent"] = False
        answer = "Consent withdrawn for future requests. Contact the operator about deleting an existing report."
    elif command.startswith("/"):
        answer = "Unknown command. Send /help for setup instructions."
    else:
        missing = [name for key, name in (("country_code", "country"), ("language_hint", "language"), ("administrative_area", "area")) if not state.get(key)]
        if missing:
            answer = "Before reporting, provide " + ", ".join(missing) + ". Send /help for commands."
        elif not state.get("consent"):
            answer = "Please read /privacy and send /agree before submitting."
        elif not text and not message.get("voice"):
            answer = "Send report text or a voice note."
        else:
            voice = message.get("voice")
            payload = CreateRequestPayload(
                channel="telegram_voice" if voice else "telegram_text",
                country_code=state["country_code"], language_hint=state["language_hint"],
                administrative_area=state["administrative_area"],
                consent=ConsentPayload(accepted=True), text=text or None,
            )
            request_id = citizen_storage.create_request(payload, idempotency_key=event_id)
            if voice:
                from services.citizen_channels.main import _publish_created, _validate_media
                path, audio = await _download_voice(token, str(voice["file_id"]))
                extension = ".ogg" if path.lower().endswith((".oga", ".ogg")) else ".mp3" if path.lower().endswith(".mp3") else ""
                if not extension:
                    raise HTTPException(422, "Unsupported Telegram voice format")
                _validate_media(extension, audio)
                record = citizen_storage.get_request(request_id)
                if not record.get("media_ref"):
                    citizen_storage.attach_media(request_id, f"telegram-voice{extension}", audio, "audio/ogg" if extension == ".ogg" else "audio/mpeg")
                await _publish_created(request_id, event_id)
            else:
                from services.citizen_channels.main import _publish_created
                await _publish_created(request_id, event_id)
            answer = f"Report received. Tracking reference: {request_id}. Keep this reference to check your report status."
    citizen_storage.save_channel_session(channel_id, state)
    try:
        await _telegram_call(token, "sendMessage", {"chat_id": chat_id, "text": answer})
    except (httpx.HTTPError, RuntimeError) as error:
        raise HTTPException(502, "Telegram reply failed; delivery can be retried") from error
    citizen_storage.mark_event(event_id)
    return {"status": "processed"}
