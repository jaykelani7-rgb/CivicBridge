import { z } from "zod";
import { apiRequest } from "./client";
import { normalizationReviewSchema, normalizationStatusSchema } from "./schemas";

export const normalizationKeys = { reviews: ["normalization", "reviews"] as const };

export const normalizationApi = {
  reviews: () => apiRequest("/api/normalization/reviews", z.array(normalizationReviewSchema)),
  approve: (requestId: string) => apiRequest(
    `/api/normalization/reviews/${encodeURIComponent(requestId)}/approve`,
    normalizationStatusSchema,
    { method: "POST" },
  ),
};
