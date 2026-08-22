"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntakeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ai_microservice_service_1 = require("../ai-microservice/ai-microservice.service");
const intake_persistence_service_1 = require("./intake.persistence.service");
const twilio_normalizer_1 = require("./twilio-normalizer");
function toJsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}
let IntakeService = class IntakeService {
    constructor(aiMicroservice, persistence) {
        this.aiMicroservice = aiMicroservice;
        this.persistence = persistence;
    }
    async ingestTwilioWebhook(payload, signature) {
        const normalized = (0, twilio_normalizer_1.normalizeTwilioPayload)(payload);
        const report = await this.persistence.createReport({
            source: client_1.NeedSource.WHATSAPP,
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
        const webhookAck = await this.aiMicroservice.classifyTwilioWebhook({
            MessageSid: normalized.messageSid,
            AccountSid: normalized.accountSid,
            From: normalized.fromNumber,
            To: normalized.toNumber,
            Body: normalized.body,
            NumMedia: String(normalized.mediaCount),
            ProfileName: normalized.profileName ?? "",
        }, signature);
        const downstreamActions = [];
        let needId = null;
        let documentExtractionId = null;
        if ((webhookAck.message_kind === "text" || webhookAck.message_kind === "mixed") && normalized.body) {
            const extraction = await this.aiMicroservice.extractNeed({
                report_id: report.id,
                transcript: normalized.body,
                source: "WHATSAPP",
            });
            const persisted = await this.persistence.persistNeedExtraction({
                reportId: report.id,
                source: client_1.NeedSource.WHATSAPP,
                extraction,
            });
            needId = persisted.needId;
            downstreamActions.push("text-extracted");
        }
        const audioMedia = normalized.media.find((item) => item.contentType?.startsWith("audio/"));
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
                source: client_1.NeedSource.WHATSAPP,
                extraction,
            });
            needId = persisted.needId ?? needId;
            downstreamActions.push("audio-transcribed");
        }
        const imageMedia = normalized.media.find((item) => item.contentType?.startsWith("image/"));
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
    async ingestVoice(dto) {
        const report = await this.persistence.createReport({
            source: client_1.NeedSource.VOICE,
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
            source: client_1.NeedSource.VOICE,
            extraction,
        });
        return {
            reportId: report.id,
            transcription,
            extraction,
            persisted,
        };
    }
    async ingestOcr(dto) {
        const report = await this.persistence.createReport({
            source: client_1.NeedSource.OCR,
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
    async reviewOcr(dto) {
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
};
exports.IntakeService = IntakeService;
exports.IntakeService = IntakeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_microservice_service_1.AiMicroserviceService,
        intake_persistence_service_1.IntakePersistenceService])
], IntakeService);
