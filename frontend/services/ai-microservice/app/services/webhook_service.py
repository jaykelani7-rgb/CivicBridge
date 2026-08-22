from app.models.webhooks import InboundMessageKind, TwilioWebhookEnvelope


def classify_inbound_message(envelope: TwilioWebhookEnvelope) -> InboundMessageKind:
    has_text = bool(envelope.body.strip())
    has_media = envelope.media_count > 0

    if has_text and has_media:
        return "mixed"
    if has_media:
        return "image" if envelope.media_count == 1 else "unknown"
    if has_text:
        return "text"
    return "unknown"
