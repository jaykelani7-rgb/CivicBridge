from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

InboundMessageKind = Literal["text", "image", "audio", "mixed", "unknown"]


class TwilioWebhookEnvelope(BaseModel):
    account_sid: str
    message_sid: str
    from_number: str
    to_number: str
    body: str = ""
    media_count: int = Field(default=0, ge=0)
    profile_name: str | None = None
    signature: str | None = None


class TwilioWebhookAck(BaseModel):
    accepted: bool
    source: Literal["WHATSAPP"] = "WHATSAPP"
    message_kind: InboundMessageKind
    normalized_event_id: str
    queued_for_processing: bool = True
