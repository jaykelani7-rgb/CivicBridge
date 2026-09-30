import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { normalizationStatusSchema } from "@/lib/api/schemas";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await context.params;
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "citizen", path: `/v1/requests/${encodeURIComponent(requestId)}/status`, signal: request.signal });
    if (result.data.processing_stage !== "submitted") return success(result.data, result.traceId);
    try {
      const normalization = await cloudRunRequest<unknown>({ service: "normalization", path: `/internal/v1/normalizations/${encodeURIComponent(requestId)}`, signal: request.signal });
      const parsed = normalizationStatusSchema.safeParse(normalization.data);
      if (!parsed.success) return success(result.data, result.traceId);
      const needsReview = parsed.data.status === "needs_review";
      return success({
        ...result.data,
        processing_stage: needsReview ? "under_review" : "normalizing",
        category: parsed.data.result.category,
        public_summary: needsReview
          ? "This report is awaiting human review before it can contribute to public hotspot analytics."
          : parsed.data.result.summary,
      }, normalization.traceId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return success(result.data, result.traceId);
      return success(result.data, result.traceId);
    }
  } catch (error) { return routeError(error); }
}
