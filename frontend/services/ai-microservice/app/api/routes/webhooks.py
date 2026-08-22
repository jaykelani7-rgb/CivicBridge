from __future__ import annotations

from fastapi import APIRouter, Form, Header

from app.models.webhooks import (
    InboundMessageKind,
    TwilioWebhookAck,
    TwilioWebhookEnvelope,
)
from app.services.webhook_service import classify_inbound_message

router = APIRouter()


@router.post("/twilio/whatsapp", response_model=TwilioWebhookAck)
async def receive_twilio_whatsapp_webhook(
    message_sid: str = Form(..., alias="MessageSid"),
    account_sid: str = Form(..., alias="AccountSid"),
    from_number: str = Form(..., alias="From"),
    to_number: str = Form(..., alias="To"),
    body: str = Form("", alias="Body"),
    media_count: int = Form(0, alias="NumMedia"),
    profile_name: str | None = Form(None, alias="ProfileName"),
    x_twilio_signature: str | None = Header(None, alias="X-Twilio-Signature"),
) -> TwilioWebhookAck:
    envelope = TwilioWebhookEnvelope(
        account_sid=account_sid,
        message_sid=message_sid,
        from_number=from_number,
        to_number=to_number,
        body=body,
        media_count=media_count,
        profile_name=profile_name,
        signature=x_twilio_signature,
    )

    message_kind: InboundMessageKind = classify_inbound_message(envelope)

    return TwilioWebhookAck(
        accepted=True,
        source="WHATSAPP",
        message_kind=message_kind,
        normalized_event_id=envelope.message_sid,
        queued_for_processing=True,
    )
