import type { EvidenceBundleDto, HotspotDetailDto, ScoreResponseDto } from "@/lib/api/types";

const component = (name: string, weighted: number, options: { missing?: boolean; confidence?: number; fallback?: number | null } = {}) => ({ name, raw_value: options.missing ? null : 70, normalized_value: 70, weight: .2, weighted_contribution: weighted, source_ids: ["demo-source"], missing: options.missing ?? false, fallback_used: options.fallback ?? null, confidence: options.confidence ?? .85, formula_version: "priority-1.0.0", calculated_at: "2026-08-22T10:00:00Z" });

export const evidenceFixture: EvidenceBundleDto = {
  evidence_bundle_id: "bundle-1", hotspot_id: "hotspot-1",
  hotspot_snapshot: { hotspot_id: "hotspot-1", country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "admin", category: "drainage", request_count: 6, unique_request_count: 6, corroboration_count: 5, affected_population: 12400, trend_30d: 0, need_score: 55, action_score: 40, evidence_confidence: .83, score_version: "priority-1.0.0", calculated_at: "2026-08-22T10:00:00Z" },
  geography: { geography_id: "IN-RJ-JPR-W42", country_code: "IN", admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42", spatial_cell: "admin", confidence: .8, boundary_source: "demo", boundary_version: "v1" },
  score_explanation: [component("infrastructure_gap", 16.4), component("severity", 10.5), component("equity_vulnerability", 8.2), component("existing_coverage_penalty", -8), component("recent_trend", 5, { missing: true, fallback: 50, confidence: .5 })],
  representative_anonymized_request_summaries: ["Road flooding repeatedly blocks access during rainfall.", "Road flooding repeatedly blocks access during rainfall."],
  request_and_cluster_evidence_ids: ["private-id-not-for-rendering"],
  data_sources: [{ source_id: "demo-source", publisher: "Fixture publisher", dataset_title: "Drainage demo fixture", geographic_coverage: "Ward 42", time_coverage: "2025", retrieved_at: "2026-08-20", transformation_notes: "Synthetic fixture; not official statistics.", confidence: .7, freshness_status: "current", synthetic: true }],
  missing_information: ["recent_trend: fallback used"], known_limitations: ["Demo fixtures are not official statistics.", "Administrative centroids are approximate."], investment_plan_records: [], bundle_version: 1, created_at: "2026-08-22T10:00:00Z", bundle_hash: "sha256:test",
};

export const detailFixture: HotspotDetailDto = {
  hotspot: { hotspot_id: "hotspot-1", cluster_id: "cluster-1", country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "admin", category: "drainage", calculation_date: "2026-08-22", request_count: 6, unique_request_count: 6, corroboration_count: 5, suspected_duplicates: 0, pending_review_count: 0, excluded_count: 0, request_rate: 4.8, affected_population: 12400, trend_30d: 0, infrastructure_gap: 82, equity_vulnerability: 72, evidence_confidence: .83, need_score: 55, action_score: 40, score_version: "priority-1.0.0", evidence_bundle_id: "bundle-1", calculated_at: "2026-08-22T10:00:00Z", status: "active", provenance: { kind: "synthetic", is_synthetic: true, source_ids: ["demo-source"] } },
  geography: { geography_id: "IN-RJ-JPR-W42", country_code: "IN", admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42", public_centroid: { latitude: 26.9, longitude: 75.8, precision: "administrative_area" }, boundary_geojson: null, boundary_source: "demo", boundary_version: "v1", location_precision: "administrative_area", limitation: "Administrative centroid only" },
};

export const scoreFixture: ScoreResponseDto = {
  hotspot_id: "hotspot-1", need_score: 55, action_score: 40, evidence_confidence: .83, components: [component("strategic_alignment", 16), component("delivery_readiness", 5), component("data_confidence", 4), component("existing_coverage_penalty", -18)], warnings: [], score_version: "priority-1.0.0", calculation_timestamp: "2026-08-22T10:00:00Z", history: [], change_since_previous: null,
};
