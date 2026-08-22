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
exports.IntakePersistenceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
function toJsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}
let IntakePersistenceService = class IntakePersistenceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createReport(input) {
        return this.prisma.needReport.create({
            data: {
                source: input.source,
                sourceMessageId: input.sourceMessageId,
                externalConversationId: input.externalConversationId,
                rawText: input.rawText,
                metadata: input.metadata,
            },
        });
    }
    async persistNeedExtraction(params) {
        const reviewStatus = params.extraction.needs_review
            ? client_1.ReviewStatus.PENDING
            : client_1.ReviewStatus.APPROVED;
        await this.prisma.needReport.update({
            where: { id: params.reportId },
            data: {
                normalizedText: params.extraction.normalized_text,
                transcriptText: params.extraction.normalized_text,
                confidenceScore: new client_1.Prisma.Decimal(params.extraction.confidence_score),
                needsReview: params.extraction.needs_review,
                reviewStatus,
                metadata: toJsonValue({
                    extractionJobId: params.extraction.job_id,
                    candidateCategory: params.extraction.candidate.category,
                }),
            },
        });
        const needId = await this.createCanonicalNeed(params.source, params.extraction);
        if (needId) {
            await this.prisma.needReport.update({
                where: { id: params.reportId },
                data: {
                    needId,
                },
            });
            await this.upsertNeedInsight(needId, params.extraction.explainability);
        }
        return {
            reportId: params.reportId,
            needId,
            needsReview: params.extraction.needs_review,
        };
    }
    async persistOcrExtraction(params) {
        const reviewStatus = params.extraction.needs_review
            ? client_1.ReviewStatus.PENDING
            : client_1.ReviewStatus.APPROVED;
        const extractionRecord = await this.prisma.documentExtraction.upsert({
            where: { needReportId: params.reportId },
            update: {
                engine: params.extraction.engine,
                sourceLanguage: params.extraction.detected_language,
                confidenceScore: new client_1.Prisma.Decimal(params.extraction.confidence_score),
                extractedPayload: toJsonValue({
                    text: params.extraction.extracted_text,
                    fields: params.extraction.parsed_fields,
                }),
                parsedEntities: toJsonValue({
                    explainability: params.extraction.explainability,
                }),
                needsReview: params.extraction.needs_review,
                reviewStatus,
            },
            create: {
                needReportId: params.reportId,
                engine: params.extraction.engine,
                sourceLanguage: params.extraction.detected_language,
                confidenceScore: new client_1.Prisma.Decimal(params.extraction.confidence_score),
                extractedPayload: toJsonValue({
                    text: params.extraction.extracted_text,
                    fields: params.extraction.parsed_fields,
                }),
                parsedEntities: toJsonValue({
                    explainability: params.extraction.explainability,
                }),
                needsReview: params.extraction.needs_review,
                reviewStatus,
            },
        });
        await this.prisma.needReport.update({
            where: { id: params.reportId },
            data: {
                normalizedText: params.extraction.extracted_text,
                confidenceScore: new client_1.Prisma.Decimal(params.extraction.confidence_score),
                needsReview: params.extraction.needs_review,
                reviewStatus,
            },
        });
        return extractionRecord;
    }
    async persistOcrReviewDecision(params) {
        return this.prisma.documentExtraction.update({
            where: { id: params.extractionId },
            data: {
                needsReview: false,
                reviewStatus: params.approved ? client_1.ReviewStatus.APPROVED : client_1.ReviewStatus.REJECTED,
                reviewNotes: params.reviewNotes,
                reviewedAt: new Date(),
            },
        });
    }
    async persistDecayUpdates(updates) {
        await Promise.all(updates.map((update) => this.prisma.need.update({
            where: { id: update.need_id },
            data: {
                heatScore: new client_1.Prisma.Decimal(update.recalculated_heat_score),
                latestActivityAt: new Date(),
            },
        })));
    }
    async createCanonicalNeed(source, extraction) {
        const location = extraction.candidate.location;
        if (!location) {
            return null;
        }
        const now = new Date();
        const needId = (0, node_crypto_1.randomUUID)();
        const tags = extraction.candidate.tags.length > 0
            ? client_1.Prisma.sql `ARRAY[${client_1.Prisma.join(extraction.candidate.tags)}]::text[]`
            : client_1.Prisma.sql `ARRAY[]::text[]`;
        await this.prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO "needs" (
          "id",
          "primarySource",
          "title",
          "summary",
          "description",
          "resourceCategory",
          "tags",
          "status",
          "urgencyScore",
          "heatScore",
          "beneficiaryCount",
          "autoFlagged",
          "location",
          "latestActivityAt",
          "reportedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${needId}::uuid,
          CAST(${source} AS "NeedSource"),
          ${extraction.candidate.title},
          ${extraction.candidate.summary},
          ${extraction.candidate.summary},
          ${extraction.candidate.category},
          ${tags},
          CAST(${client_1.NeedStatus.NEW} AS "NeedStatus"),
          ${new client_1.Prisma.Decimal(extraction.candidate.urgency_score)},
          ${new client_1.Prisma.Decimal(extraction.candidate.urgency_score)},
          ${extraction.candidate.beneficiary_count_hint ?? null},
          true,
          ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography,
          ${now},
          ${now},
          ${now},
          ${now}
        )
      `);
        return needId;
    }
    async upsertNeedInsight(needId, explainability) {
        await this.prisma.needInsight.upsert({
            where: { needId },
            update: {
                reasonSummary: explainability.summary,
                evidence: toJsonValue(explainability),
                generatedAt: new Date(),
            },
            create: {
                needId,
                modelName: "fastapi-ai-microservice",
                reasonSummary: explainability.summary,
                evidence: toJsonValue(explainability),
            },
        });
    }
};
exports.IntakePersistenceService = IntakePersistenceService;
exports.IntakePersistenceService = IntakePersistenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IntakePersistenceService);
