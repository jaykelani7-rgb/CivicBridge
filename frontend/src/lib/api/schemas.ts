import { z } from "zod";

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

export const prioritySchema = z.object({
  rank: z.number().int().positive().nullable(),
  total_ranked: z.number().int().nonnegative(),
  band: z.enum(["critical", "high", "medium", "low", "insufficient_evidence"]),
  band_reason_code: z.string(),
  ranking_scope: z.object({ country_code: z.string(), category: z.string().nullable() }),
  ranked_at: z.string(), methodology_version: z.string(),
});

export const evidenceReadinessSchema = z.object({
  state: z.enum(["ready_for_human_review", "review_with_caution", "insufficient_evidence"]),
  reason_codes: z.array(z.string()), assessed_at: z.string(), ruleset_version: z.string(),
});

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
  normalized_summary: nullableString.optional(),
  processing_mode: nullableString.optional(),
  report_confirmed: z.boolean().optional(),
  category: nullableString,
  hotspot_score: nullableNumber,
  project_title: nullableString,
  project_status: nullableString,
  hotspot_id: nullableString,
  recommendation_id: nullableString,
  project_id: nullableString,
  outcome_status: nullableString.optional(),
  measurement_source_type: nullableString.optional(),
  pii_masked: z.boolean(),
  trace_id: z.string().optional(),
});

export const normalizationStatusSchema = z.object({
  request_id: z.string(),
  status: z.enum(["normalized", "needs_review"]),
  attempts: z.number().int().positive(),
  updated_at: z.string(),
  result: z.object({
    category: z.string(),
    summary: z.string(),
    urgency: z.string(),
    confidence: z.number(),
    needs_human_review: z.boolean(),
    review_reason: nullableString,
    pii_flags: z.array(z.string()),
  }).passthrough(),
});

export const normalizationReviewSchema = z.object({
  request_id: z.string(),
  category: z.string(),
  urgency: z.string(),
  confidence: z.number(),
  review_reason: nullableString,
  public_summary: z.string(),
  pii_flags: z.array(z.string()),
  attempts: z.number().int().positive(),
  updated_at: z.string(),
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
  geography: z.object({
    geography_id: z.string(), country_code: z.string(), admin1: z.string(), admin2: z.string(), locality: z.string(),
    public_centroid: z.object({ latitude: z.number(), longitude: z.number(), precision: z.literal("administrative_area") }),
    boundary_geojson: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }).nullable(),
    boundary_source: z.string(), boundary_version: z.string(), location_precision: z.literal("administrative_area"),
    limitation: z.string().nullable(),
  }).optional(),
  provenance: z.object({ kind: z.enum(["live", "synthetic"]), is_synthetic: z.boolean(), source_ids: z.array(z.string()) }).optional(),
  priority: prioritySchema.optional(),
  evidence_readiness: evidenceReadinessSchema.nullable().optional(),
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
    public_centroid: z.object({ latitude: z.number(), longitude: z.number(), precision: z.literal("administrative_area") }),
    boundary_geojson: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }).nullable(),
    boundary_source: z.string(), boundary_version: z.string(), location_precision: z.literal("administrative_area"),
    limitation: z.string().nullable(),
  }),
});

export const systemSummarySchema = z.object({
  reports_received: z.number().int().nonnegative(), normalized: z.number().int().nonnegative(),
  clustered: z.number().int().nonnegative(), active_priorities: z.number().int().nonnegative(),
  projects_underway: z.number().int().nonnegative(), provenance: z.enum(["live", "synthetic"]),
  updated_at: z.string().nullable(),
});

export const publicHotspotSchema = z.object({
  id: z.string(),
  country_code: z.enum(["IN", "BR", "ZA"]),
  category: z.string(),
  public_title: z.string(),
  public_summary: z.string(),
  administrative_area: z.object({
    admin1: z.string(),
    admin2: z.string(),
    locality: z.string(),
  }),
  public_centroid: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precision: z.literal("administrative_area"),
  }),
  request_count: z.number().int().nonnegative(),
  priority_band: z.enum(["high", "medium", "emerging"]),
  priority: prioritySchema.omit({ band_reason_code: true }).optional(),
  public_status: z.enum(["under_review", "monitoring", "project_active", "completed"]),
  updated_at: z.string(),
  project: z.object({
    title: z.string(),
    status: z.string(),
    updated_at: z.string().optional(),
  }).nullable(),
  synthetic: z.boolean(),
});

export const publicHotspotPageSchema = z.object({
  items: z.array(publicHotspotSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
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

export const scoreResponseSchema = z.object({
  hotspot_id: z.string(),
  need_score: z.number(),
  action_score: z.number(),
  evidence_confidence: z.number(),
  components: z.array(scoreComponentSchema),
  warnings: z.array(z.string()).default([]),
  score_version: z.string(),
  calculation_timestamp: z.string(),
  history: z.array(z.record(z.string(), z.unknown())).default([]),
  change_since_previous: nullableNumber,
}).passthrough();

export const evidenceDataSourceSchema = z.object({
  source_id: z.string().optional(),
  dataset_id: z.string().optional(),
  dataset_title: z.string().optional(),
  dataset_version: z.string().optional(),
  snapshot_id: z.string().optional(),
  publisher: z.string().optional(),
  country_code: z.string().optional(),
  geographic_coverage: z.string().optional(),
  time_coverage: z.string().optional(),
  retrieved_at: z.string().optional(),
  license: z.string().nullable().optional(),
  source_url: z.string().url().optional(),
  transformation_notes: z.string().optional(),
  confidence: z.number().optional(),
  freshness_status: z.string().optional(),
  synthetic: z.union([z.boolean(), z.number()]).optional(),
  classification: z.enum(["official_public", "public_nonofficial", "citizen_aggregate", "ai_normalized", "derived", "estimated", "synthetic_demo", "unclassified"]).optional(),
  dataset_name: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  country_codes: z.array(z.string()).optional(),
  observation_period: z.string().nullable().optional(),
  public_url: z.string().url().nullable().optional(),
  supports_components: z.array(z.string()).optional(),
  upstream_source_ids: z.array(z.string()).optional(),
  known_limitations: z.array(z.string()).optional(),
}).passthrough();

export const evidenceGroupSchema = z.object({
  group_id: z.string(), representative_summary: z.string(), representative_original_summary: z.string().nullable().optional(),
  original_language: z.string().nullable().optional(), working_language: z.string(), report_count: z.number().int().positive(),
  relationship: z.enum(["probable_duplicate", "related", "distinct_theme"]), evidence_types: z.array(z.string()),
  first_reported_at: z.string(), last_reported_at: z.string(), translation_performed: z.boolean(),
  translation: z.object({ performed: z.boolean(), provider: z.string().nullable().optional(), confidence: z.number().nullable().optional() }).nullable().optional(),
});

export const structuredLimitationSchema = z.object({
  code: z.string(),
  category: z.enum(["missing_data", "estimated_value", "data_recency", "geographic_precision", "synthetic_source", "methodology", "evidence_completeness", "source_classification", "other"]),
  severity: z.enum(["information", "warning", "blocking"]), message: z.string(),
  affected_components: z.array(z.string()), reviewer_action_code: z.string(), reviewer_action: z.string(), public_safe: z.boolean(),
});

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
  data_sources: z.array(evidenceDataSourceSchema),
  missing_information: z.array(z.string()),
  known_limitations: z.array(z.string()),
  investment_plan_records: z.array(z.record(z.string(), z.unknown())),
  bundle_version: z.number(),
  created_at: z.string(),
  bundle_hash: z.string(),
  priority: prioritySchema.optional(),
  evidence_groups: z.array(evidenceGroupSchema).optional(),
  limitations_structured: z.array(structuredLimitationSchema).optional(),
  evidence_readiness: evidenceReadinessSchema.optional(),
  sources: z.array(evidenceDataSourceSchema).optional(),
  metadata_schema_version: z.string().optional(),
}).passthrough();

export const recommendationSchema = z.object({
  recommendation_id: z.string(), hotspot_id: z.string(), evidence_bundle_id: z.string(),
  country_code: nullableString, category: nullableString,
  title: z.string(), problem: z.string(), proposed_intervention: z.string(),
  intended_beneficiaries: nullableNumber, supporting_evidence_ids: z.array(z.string()),
  risks: z.array(z.string()), missing_information: z.array(z.string()), confidence: nullableNumber,
  processing_mode: nullableString, draft_provider: nullableString, draft_model: nullableString,
  evidence_sources: z.array(z.object({ source_id: z.string(), title: nullableString, publisher: nullableString, url: nullableString, reference_period: nullableString, retrieved_at: nullableString, finding: nullableString, provenance: nullableString })).optional(),
  quantitative_claims: z.array(z.object({ claim_field: z.string(), value: z.number(), source_field: z.string(), source_id: z.string(), calculation: z.string() })).optional(),
  status: z.string(), ai_draft: z.boolean(), human_approved: z.boolean(),
  assigned_department: nullableString, assigned_reviewer: nullableString,
  created_at: z.string(), updated_at: z.string(), schema_version: z.string(),
});

export const policyDecisionSchema = z.object({
  decision_id: z.string(), recommendation_id: z.string(),
  action: z.enum(["approve_for_assessment", "request_evidence", "edit", "assign", "defer", "reject"]),
  reason: z.string(), actor_id: z.string(), actor_role: z.string(), decided_at: z.string(),
  schema_version: z.string(),
});

export const projectSchema = z.object({
  project_id: z.string(), recommendation_id: z.string(), hotspot_id: z.string(),
  country_code: z.string(), title: z.string(), sector: z.string(), status: z.string(),
  assigned_department: nullableString, milestones: z.array(z.record(z.string(), z.unknown())),
  created_at: z.string(), updated_at: z.string(), schema_version: z.string(),
});

export const metricSchema = z.object({
  metric_id: z.string(), project_id: z.string(), metric_code: z.string(),
  baseline: nullableNumber, target: nullableNumber, current: nullableNumber, unit: z.string(),
  direction: z.enum(["higher_is_better", "lower_is_better"]).default("lower_is_better"),
  source_id: z.string(), measured_at: z.string(), confidence: nullableNumber,
  source_type: z.enum(["manual", "independently_verified"]).default("manual"), methodology: nullableString,
  outcome_status: z.string(), recorded_at: z.string(), schema_version: z.string(),
});
