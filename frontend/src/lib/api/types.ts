import type { z } from "zod";
import type {
  citizenReceiptSchema, citizenStatusSchema, evidenceBundleSchema, hotspotDetailSchema,
  hotspotDtoSchema, mediaReceiptSchema, metricSchema, projectSchema, recommendationSchema,
} from "./schemas";

export type CitizenReceipt = z.infer<typeof citizenReceiptSchema>;
export type CitizenStatus = z.infer<typeof citizenStatusSchema>;
export type MediaReceipt = z.infer<typeof mediaReceiptSchema>;
export type HotspotDto = z.infer<typeof hotspotDtoSchema>;
export type HotspotDetailDto = z.infer<typeof hotspotDetailSchema>;
export type EvidenceBundleDto = z.infer<typeof evidenceBundleSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type DevelopmentProject = z.infer<typeof projectSchema>;
export type ImpactMetric = z.infer<typeof metricSchema>;

export type ApproximateLocation = {
  precision: "approximate";
  latitude: number;
  longitude: number;
  admin_hint?: string;
};

export type CreateCitizenRequest = {
  channel: "web_text" | "web_voice";
  country_code: "IN" | "BR" | "ZA";
  language_hint: string;
  location: ApproximateLocation;
  consent: { accepted: true; version: "2026-08-01" };
  text?: string;
};

export type CitizenFormInput = Omit<CreateCitizenRequest, "consent"> & { consentAccepted: boolean };

export type HotspotFilters = {
  country_code?: string;
  category?: string;
  geography_id?: string;
  min_need_score?: number;
  min_action_score?: number;
  min_confidence?: number;
  status?: string;
  page?: number;
  page_size?: number;
};

export type HotspotViewModel = {
  id: string;
  countryCode: string;
  geographyId: string;
  category: string;
  status: string;
  requestCount: number;
  uniqueRequestCount: number;
  duplicateCount: number;
  relatedCount: number;
  affectedPopulation: number;
  needScore: number;
  actionScore: number;
  evidenceConfidence: number;
  calculatedAt: string;
  evidenceBundleId?: string;
  warnings: string[];
};

export type HotspotPage = {
  items: HotspotViewModel[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

export type RecommendationViewModel = { id: string; hotspotId: string; title: string; status: string; confidencePercent: number; evidenceCount: number; humanApproved: boolean };
export type ProjectMetricViewModel = { id: string; code: string; baseline: number; target: number; current: number; unit: string; progressPercent: number | null; sourceId: string; confidencePercent: number };
