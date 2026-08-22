import { Injectable } from "@nestjs/common";
import { NeedSource, Prisma } from "@prisma/client";
import { AiMicroserviceService } from "../ai-microservice/ai-microservice.service";
import { VoiceIntakeDto } from "./dto/voice-intake.dto";
import { OcrIntakeDto } from "./dto/ocr-intake.dto";
import { OcrReviewDto } from "./dto/ocr-review.dto";
import { IntakePersistenceService } from "./intake.persistence.service";
import { normalizeTwilioPayload } from "./twilio-normalizer";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class IntakeService {
  constructor(
    private readonly aiMicroservice: AiMicroserviceService,
    private readonly persistence: IntakePersistenceService,
  ) {}

  async ingestTwilioWebhook(
    payload: Record<string, string | undefined>,
    signature?: string,
  ) {
    const normalized = normalizeTwilioPayload(payload);
    const report = await this.persistence.createReport({
      source: NeedSource.WHATSAPP,
      sourceMessageId: normalized.messageSid,
      externalConversationId: normalized.accountSid,
      rawText: normalized.body,
      metadata: toJsonValue({
        from: normalized.fromNumber,
        to: normalized.toNumber,
        mediaCount: normalized.mediaCount,
        media: normalized.media,
      }),
    });

    const webhookAck = await this.aiMicroservice.classifyTwilioWebhook(
      {
        MessageSid: normalized.messageSid,
        AccountSid: normalized.accountSid,
        From: normalized.fromNumber,
        To: normalized.toNumber,
        Body: normalized.body,
        NumMedia: String(normalized.mediaCount),
        ProfileName: normalized.profileName ?? "",
      },
      signature,
    );

    const downstreamActions: string[] = [];
    let needId: string | null = null;
    let documentExtractionId: string | null = null;

    if ((webhookAck.message_kind === "text" || webhookAck.message_kind === "mixed") && normalized.body) {
      const extraction = await this.aiMicroservice.extractNeed({
        report_id: report.id,
        transcript: normalized.body,
        source: "WHATSAPP",
      });

      const persisted = await this.persistence.persistNeedExtraction({
        reportId: report.id,
        source: NeedSource.WHATSAPP,
        extraction,
      });

      needId = persisted.needId;
      downstreamActions.push("text-extracted");
    }

    const audioMedia = normalized.media.find((item) =>
      item.contentType?.startsWith("audio/"),
    );

    if (audioMedia) {
      const transcription = await this.aiMicroservice.transcribeVoice({
        report_id: report.id,
        media_url: audioMedia.url,
        source: "WHATSAPP",
      });

      const extraction = await this.aiMicroservice.extractNeed({
        report_id: report.id,
        transcript: transcription.transcript,
        language: transcription.detected_language,
        source: "WHATSAPP",
      });

      const persisted = await this.persistence.persistNeedExtraction({
        reportId: report.id,
        source: NeedSource.WHATSAPP,
        extraction,
      });

      needId = persisted.needId ?? needId;
      downstreamActions.push("audio-transcribed");
    }

    const imageMedia = normalized.media.find((item) =>
      item.contentType?.startsWith("image/"),
    );

    if (imageMedia) {
      const ocr = await this.aiMicroservice.extractOcr({
        report_id: report.id,
        image_url: imageMedia.url,
        source: "WHATSAPP",
      });

      const extractionRecord = await this.persistence.persistOcrExtraction({
        reportId: report.id,
        extraction: ocr,
      });

      documentExtractionId = extractionRecord.id;
      downstreamActions.push(ocr.needs_review ? "ocr-review-needed" : "ocr-extracted");
    }

    return {
      reportId: report.id,
      normalizedEventId: webhookAck.normalized_event_id,
      messageKind: webhookAck.message_kind,
      needId,
      documentExtractionId,
      downstreamActions,
    };
  }

  async ingestVoice(dto: VoiceIntakeDto) {
    const report = await this.persistence.createReport({
      source: NeedSource.VOICE,
      metadata: toJsonValue({
        mediaUrl: dto.mediaUrl,
      }),
    });

    const transcription = await this.aiMicroservice.transcribeVoice({
      report_id: report.id,
      media_url: dto.mediaUrl,
      language_hint: dto.languageHint,
      duration_seconds: dto.durationSeconds,
      location_hint: dto.locationHint,
      source: dto.source ?? "VOICE",
    });

    const extraction = await this.aiMicroservice.extractNeed({
      report_id: report.id,
      transcript: transcription.transcript,
      language: transcription.detected_language,
      source: dto.source ?? "VOICE",
      location_hint: dto.locationHint,
    });

    const persisted = await this.persistence.persistNeedExtraction({
      reportId: report.id,
      source: NeedSource.VOICE,
      extraction,
    });

    return {
      reportId: report.id,
      transcription,
      extraction,
      persisted,
    };
  }

  async ingestOcr(dto: OcrIntakeDto) {
    const report = await this.persistence.createReport({
      source: NeedSource.OCR,
      metadata: toJsonValue({
        imageUrl: dto.imageUrl,
      }),
    });

    const extraction = await this.aiMicroservice.extractOcr({
      report_id: report.id,
      image_url: dto.imageUrl,
      language_hint: dto.languageHint,
      script_hint: dto.scriptHint,
      source: dto.source ?? "OCR",
    });

    const persisted = await this.persistence.persistOcrExtraction({
      reportId: report.id,
      extraction,
    });

    return {
      reportId: report.id,
      extraction,
      persisted,
    };
  }

  async reviewOcr(dto: OcrReviewDto) {
    const reviewResult = await this.aiMicroservice.reviewOcr({
      extraction_id: dto.extractionId,
      approved: dto.approved,
      reviewer_user_id: dto.reviewerUserId,
      review_notes: dto.reviewNotes,
    });

    const persisted = await this.persistence.persistOcrReviewDecision({
      extractionId: dto.extractionId,
      approved: dto.approved,
      reviewNotes: dto.reviewNotes,
    });

    return {
      reviewResult,
      persisted,
    };
  }
}
