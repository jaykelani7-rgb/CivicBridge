import { describe, expect, it } from "vitest";
import { adaptCitizenRequest, adaptCitizenStatus, adaptHotspotPage, adaptProjectMetric, adaptRecommendation, demoModeEnabled, evidenceUsesDemoData } from "./adapters";
import { citizenStatusSchema, evidenceBundleSchema, metricSchema, recommendationSchema } from "./schemas";

describe("contract adapters", () => {
  it("creates the canonical citizen request and rejects missing consent", () => {
    const base = { channel: "web_text" as const, country_code: "IN" as const, language_hint: "hi-IN", location: { precision: "approximate" as const, latitude: 26.9, longitude: 75.8 }, text: "Blocked drain", consentAccepted: true };
    expect(adaptCitizenRequest(base).consent).toEqual({ accepted: true, version: "2026-08-01" });
    expect(() => adaptCitizenRequest({ ...base, consentAccepted: false })).toThrow(/Consent/);
  });

  it("preserves only supplied citizen status fields", () => {
    const status = citizenStatusSchema.parse({ request_id: "r", channel: "web_text", country_code: "IN", submitted_at: "2026-08-22T00:00:00Z", processing_stage: "normalizing", public_summary: null, category: null, hotspot_score: null, project_title: null, project_status: null, pii_masked: true });
    expect(adaptCitizenStatus(status)).toEqual(status);
    expect(adaptCitizenStatus(status).category).toBeNull();
  });

  it("adapts paginated hotspots and duplicate/related counts", () => {
    const item = { hotspot_id: "h", cluster_id: "c", country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "cell", category: "drainage", calculation_date: "2026-08-22", request_count: 4, unique_request_count: 3, corroboration_count: 2, suspected_duplicates: 1, pending_review_count: 0, excluded_count: 0, request_rate: 1.2, affected_population: 100, trend_30d: 2, infrastructure_gap: 50, equity_vulnerability: 40, evidence_confidence: .8, need_score: 60, action_score: 55, score_version: "v1", evidence_bundle_id: "evb", calculated_at: "2026-08-22T00:00:00Z", status: "active", warnings_json: "[\"missing trend\"]" };
    const result = adaptHotspotPage({ items: [item], pagination: { page: 1, page_size: 10, total: 1, pages: 1 } });
    expect(result.items[0]).toMatchObject({ duplicateCount: 1, relatedCount: 2, warnings: ["missing trend"] });
  });

  it("adapts recommendations and real project metrics", () => {
    const recommendation = recommendationSchema.parse({ recommendation_id: "r", hotspot_id: "h", evidence_bundle_id: "e", title: "Drainage assessment", problem: "Flooding", proposed_intervention: "Survey", intended_beneficiaries: 0, supporting_evidence_ids: ["s1"], risks: [], missing_information: [], confidence: .81, status: "under_review", ai_draft: true, human_approved: false, assigned_department: null, assigned_reviewer: null, created_at: "2026-08-22", updated_at: "2026-08-22", schema_version: "recommendation-1.0.0" });
    expect(adaptRecommendation(recommendation)).toMatchObject({ confidencePercent: 81, evidenceCount: 1 });
    const metric = metricSchema.parse({ metric_id: "m", project_id: "p", metric_code: "access", baseline: 10, target: 20, current: 15, unit: "percent", source_id: "source", measured_at: "2026-08-22", confidence: .9, outcome_status: "improving", recorded_at: "2026-08-22", schema_version: "impact-metric-1.0.0" });
    expect(adaptProjectMetric(metric)).toMatchObject({ progressPercent: 50, confidencePercent: 90 });
  });

  it("isolates demo mode and detects synthetic evidence provenance", () => {
    expect(demoModeEnabled("false")).toBe(false); expect(demoModeEnabled("true")).toBe(true);
    const bundle = evidenceBundleSchema.parse({ evidence_bundle_id: "e", hotspot_id: "h", hotspot_snapshot: { hotspot_id: "h", country_code: "IN", geography_id: "g", spatial_cell: "s", category: "water", request_count: 1, unique_request_count: 1, corroboration_count: 0, affected_population: 1, trend_30d: 0, need_score: 1, action_score: 1, evidence_confidence: .5, score_version: "v", calculated_at: "2026-08-22" }, geography: { geography_id: "g", country_code: "IN", admin1: "a", admin2: "b", locality: "c", spatial_cell: "s", confidence: .5, boundary_source: "fixture", boundary_version: "v" }, score_explanation: [], representative_anonymized_request_summaries: [], request_and_cluster_evidence_ids: [], data_sources: [{ synthetic: 1 }], missing_information: [], known_limitations: [], investment_plan_records: [], bundle_version: 1, created_at: "2026-08-22", bundle_hash: "sha256:x" });
    expect(evidenceUsesDemoData(bundle)).toBe(true);
  });
});
