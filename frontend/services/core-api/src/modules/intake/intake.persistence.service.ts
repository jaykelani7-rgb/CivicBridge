import { Injectable } from "@nestjs/common";
import {
  NeedSource,
  NeedStatus,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  ExplainabilityEvidence,
  NeedExtractionResponse,
  OCRExtractionResponse,
} from "../ai-microservice/ai-contracts";
import { PrismaService } from "../prisma/prisma.service";

type CreateReportInput = {
  source: NeedSource;
  sourceMessageId?: string;
  externalConversationId?: string;
  rawText?: string;
  metadata?: Prisma.InputJsonValue;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class IntakePersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(input: CreateReportInput) {
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

  async persistNeedExtraction(params: {
    reportId: string;
    source: NeedSource;
    extraction: NeedExtractionResponse;
  }) {
    const reviewStatus = params.extraction.needs_review
      ? ReviewStatus.PENDING
      : ReviewStatus.APPROVED;

    await this.prisma.needReport.update({
      where: { id: params.reportId },
      data: {
        normalizedText: params.extraction.normalized_text,
        transcriptText: params.extraction.normalized_text,
        confidenceScore: new Prisma.Decimal(params.extraction.confidence_score),
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

  async persistOcrExtraction(params: {
    reportId: string;
    extraction: OCRExtractionResponse;
  }) {
    const reviewStatus = params.extraction.needs_review
      ? ReviewStatus.PENDING
      : ReviewStatus.APPROVED;

    const extractionRecord = await this.prisma.documentExtraction.upsert({
      where: { needReportId: params.reportId },
      update: {
        engine: params.extraction.engine,
        sourceLanguage: params.extraction.detected_language,
        confidenceScore: new Prisma.Decimal(params.extraction.confidence_score),
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
        confidenceScore: new Prisma.Decimal(params.extraction.confidence_score),
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
        confidenceScore: new Prisma.Decimal(params.extraction.confidence_score),
        needsReview: params.extraction.needs_review,
        reviewStatus,
      },
    });

    return extractionRecord;
  }

  async persistOcrReviewDecision(params: {
    extractionId: string;
    approved: boolean;
    reviewNotes?: string;
  }) {
    return this.prisma.documentExtraction.update({
      where: { id: params.extractionId },
      data: {
        needsReview: false,
        reviewStatus: params.approved ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
        reviewNotes: params.reviewNotes,
        reviewedAt: new Date(),
      },
    });
  }

  async persistDecayUpdates(
    updates: Array<{ need_id: string; recalculated_heat_score: number }>,
  ) {
    await Promise.all(
      updates.map((update) =>
        this.prisma.need.update({
          where: { id: update.need_id },
          data: {
            heatScore: new Prisma.Decimal(update.recalculated_heat_score),
            latestActivityAt: new Date(),
          },
        }),
      ),
    );
  }

  private async createCanonicalNeed(
    source: NeedSource,
    extraction: NeedExtractionResponse,
  ): Promise<string | null> {
    const location = extraction.candidate.location;

    if (!location) {
      return null;
    }

    const now = new Date();
    const needId = randomUUID();
    const tags =
      extraction.candidate.tags.length > 0
        ? Prisma.sql`ARRAY[${Prisma.join(extraction.candidate.tags)}]::text[]`
        : Prisma.sql`ARRAY[]::text[]`;

    await this.prisma.$executeRaw(
      Prisma.sql`
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
          CAST(${NeedStatus.NEW} AS "NeedStatus"),
          ${new Prisma.Decimal(extraction.candidate.urgency_score)},
          ${new Prisma.Decimal(extraction.candidate.urgency_score)},
          ${extraction.candidate.beneficiary_count_hint ?? null},
          true,
          ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography,
          ${now},
          ${now},
          ${now},
          ${now}
        )
      `,
    );

    return needId;
  }

  private async upsertNeedInsight(
    needId: string,
    explainability: ExplainabilityEvidence,
  ) {
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
}
