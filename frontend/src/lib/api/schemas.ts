import { z } from "zod";

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

export const locationSchema = z.object({
  precision: z.string().default("approximate"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  admin_hint: nullableString,
});

export const citizenReceiptSchema = z.object({
  request_id: z.string(),
  status: z.string(),
  receipt_id: z.string(),
  message: z.string(),
  submitted_at: z.string(),
  trace_id: z.string().optional(),
});

export const citizenStatusSchema = z.object({
  request_id: z.string(),
  channel: z.string(),
  country_code: z.string(),
  submitted_at: z.string(),
  processing_stage: z.string(),
  public_summary: nullableString,
  category: nullableString,
  hotspot_score: nullableNumber,
  project_title: nullableString,
  project_status: nullableString,
  pii_masked: z.boolean(),
  trace_id: z.string().optional(),
});

export const mediaReceiptSchema = z.object({
  request_id: z.string(),
  media_ref: z.string(),
  filename: z.string(),
  size_bytes: z.number(),
  status: z.string(),
});

export const confirmationSchema = z.object({
  request_id: z.string(),
  status: z.string(),
  confirmed_at: z.string(),
});

export const hotspotDtoSchema = z.object({
  hotspot_id: z.string(),
  cluster_id: z.string(),
  country_code: z.string(),
  geography_id: z.string(),
  spatial_cell: z.string(),
  category: z.string(),
  calculation_date: z.string(),
  request_count: z.number(),
  unique_request_count: z.number(),
  corroboration_count: z.number(),
  suspected_duplicates: z.number(),
  pending_review_count: z.number(),
  excluded_count: z.number(),
  request_rate: z.number(),
  affected_population: z.number(),
  trend_30d: z.number(),
  infrastructure_gap: nullableNumber,
  equity_vulnerability: nullableNumber,
  evidence_confidence: z.number(),
  need_score: z.number(),
  action_score: z.number(),
  score_version: z.string(),
  evidence_bundle_id: nullableString,
  calculated_at: z.string(),
  status: z.string(),
  warnings: z.array(z.string()).optional(),
  warnings_json: z.string().optional(),
});

export const hotspotPageSchema = z.object({
  items: z.array(hotspotDtoSchema),
  pagination: z.object({
    page: z.number(),
    page_size: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});

export const hotspotDetailSchema = z.object({
  hotspot: hotspotDtoSchema,
  geography: z.object({
    geography_id: z.string(),
    country_code: z.string(),
    admin1: z.string(),
    admin2: z.string(),
    locality: z.string(),
    boundary_source: z.string(),
    boundary_version: z.string(),
  }),
});

export const scoreComponentSchema = z.object({
  name: z.string(),
  raw_value: nullableNumber,
  normalized_value: z.number(),
  weight: z.number(),
  weighted_contribution: z.number(),
  source_ids: z.array(z.string()),
  missing: z.boolean(),
  fallback_used: nullableNumber,
  confidence: z.number(),
  formula_version: z.string(),
  calculated_at: z.string(),
}).passthrough();

export const evidenceBundleSchema = z.object({
  evidence_bundle_id: z.string(),
  hotspot_id: z.string(),
  hotspot_snapshot: hotspotDtoSchema.pick({
    hotspot_id: true, country_code: true, geography_id: true, spatial_cell: true,
    category: true, request_count: true, unique_request_count: true,
    corroboration_count: true, affected_population: true, trend_30d: true,
    need_score: true, action_score: true, evidence_confidence: true,
    score_version: true, calculated_at: true,
  }),
  geography: z.object({
    geography_id: z.string(), country_code: z.string(), admin1: z.string(),
    admin2: z.string(), locality: z.string(), spatial_cell: z.string(),
    confidence: z.number(), boundary_source: z.string(), boundary_version: z.string(),
  }),
  score_explanation: z.array(scoreComponentSchema),
  representative_anonymized_request_summaries: z.array(z.string()),
  request_and_cluster_evidence_ids: z.array(z.string()),
  data_sources: z.array(z.record(z.string(), z.unknown())),
  missing_information: z.array(z.string()),
  known_limitations: z.array(z.string()),
  investment_plan_records: z.array(z.record(z.string(), z.unknown())),
  bundle_version: z.number(),
  created_at: z.string(),
  bundle_hash: z.string(),
}).passthrough();

export const recommendationSchema = z.object({
  recommendation_id: z.string(), hotspot_id: z.string(), evidence_bundle_id: z.string(),
  title: z.string(), problem: z.string(), proposed_intervention: z.string(),
  intended_beneficiaries: z.number(), supporting_evidence_ids: z.array(z.string()),
  risks: z.array(z.string()), missing_information: z.array(z.string()), confidence: z.number(),
  status: z.string(), ai_draft: z.boolean(), human_approved: z.boolean(),
  assigned_department: nullableString, assigned_reviewer: nullableString,
  created_at: z.string(), updated_at: z.string(), schema_version: z.string(),
});

export const projectSchema = z.object({
  project_id: z.string(), recommendation_id: z.string(), hotspot_id: z.string(),
  country_code: z.string(), title: z.string(), sector: z.string(), status: z.string(),
  assigned_department: nullableString, milestones: z.array(z.record(z.string(), z.unknown())),
  created_at: z.string(), updated_at: z.string(), schema_version: z.string(),
});

export const metricSchema = z.object({
  metric_id: z.string(), project_id: z.string(), metric_code: z.string(),
  baseline: z.number(), target: z.number(), current: z.number(), unit: z.string(),
  source_id: z.string(), measured_at: z.string(), confidence: z.number(),
  outcome_status: z.string(), recorded_at: z.string(), schema_version: z.string(),
});
