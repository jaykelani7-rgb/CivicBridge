import { describe, expect, it } from "vitest";
import { projectPublicHotspot } from "./public-hotspot-projection";

const internalHotspot = {
  hotspot_id: "h-1", cluster_id: "cluster-private", country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "restricted-cell", category: "drainage", calculation_date: "2026-08-22", request_count: 7, unique_request_count: 5, corroboration_count: 3, suspected_duplicates: 2, pending_review_count: 1, excluded_count: 0, request_rate: 1.4, affected_population: 1000, trend_30d: .2, infrastructure_gap: 60, equity_vulnerability: 40, evidence_confidence: .83, need_score: 54.6, action_score: 55.5, score_version: "priority-1.0.0", evidence_bundle_id: "private-evidence", calculated_at: "2026-08-22T12:00:00Z", status: "active", warnings: ["private warning"],
  geography: { geography_id: "IN-RJ-JPR-W42", country_code: "IN", admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42", public_centroid: { latitude: 26.91, longitude: 75.78, precision: "administrative_area" }, boundary_geojson: null, boundary_source: "synthetic-demo", boundary_version: "1", location_precision: "administrative_area", limitation: "Administrative centroid only" },
  provenance: { kind: "synthetic", is_synthetic: true, source_ids: ["demo-source"] },
};

describe("public hotspot projection", () => {
  it("returns an explicit privacy-safe shape and preserves demo provenance", () => {
    const result = projectPublicHotspot(internalHotspot);
    expect(result).toEqual({ id: "h-1", country_code: "IN", category: "drainage", public_title: "Recurring road flooding", public_summary: "Residents report repeated access disruption during rainfall.", administrative_area: { admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42" }, public_centroid: { latitude: 26.91, longitude: 75.78, precision: "administrative_area" }, request_count: 5, priority_band: "high", public_status: "under_review", updated_at: "2026-08-22T12:00:00Z", project: null, synthetic: true });
    const serialized = JSON.stringify(result);
    for (const forbidden of ["cluster_id", "spatial_cell", "need_score", "action_score", "evidence_confidence", "evidence_bundle_id", "source_ids", "warnings", "trace_id"]) expect(serialized).not.toContain(forbidden);
  });
});
