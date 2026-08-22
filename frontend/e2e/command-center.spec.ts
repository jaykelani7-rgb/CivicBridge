import { expect, test } from "@playwright/test";

const hotspot = { hotspot_id: "22222222-2222-4222-8222-222222222222", cluster_id: "c", country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "cell", category: "drainage", calculation_date: "2026-08-22", request_count: 4, unique_request_count: 3, corroboration_count: 2, suspected_duplicates: 1, pending_review_count: 0, excluded_count: 0, request_rate: 1.2, affected_population: 12000, trend_30d: 2, infrastructure_gap: 80, equity_vulnerability: 70, evidence_confidence: .8, need_score: 60, action_score: 55, score_version: "v1", evidence_bundle_id: "evb_1", calculated_at: "2026-08-22T00:00:00Z", status: "active", warnings: [] };

test("analyst selects a hotspot and sees its evidence bundle", async ({ page }) => {
  await page.context().addCookies([{ name: "civicbridge_staff_token", value: "mocked-by-network-routes", url: "http://127.0.0.1:3100", sameSite: "Strict" }]);
  await page.route(/\/api\/intelligence\/hotspots\?.*$/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [hotspot], pagination: { page: 1, page_size: 12, total: 1, pages: 1 } }) }));
  await page.route(/\/api\/intelligence\/hotspots\/[^/]+$/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hotspot, geography: { geography_id: "IN-RJ-JPR-W42", country_code: "IN", admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42", boundary_source: "public boundary", boundary_version: "v1" } }) }));
  await page.route(/\/api\/intelligence\/hotspots\/[^/]+\/evidence$/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ evidence_bundle_id: "evb_1", hotspot_id: hotspot.hotspot_id, hotspot_snapshot: { hotspot_id: hotspot.hotspot_id, country_code: "IN", geography_id: "IN-RJ-JPR-W42", spatial_cell: "cell", category: "drainage", request_count: 4, unique_request_count: 3, corroboration_count: 2, affected_population: 12000, trend_30d: 2, need_score: 60, action_score: 55, evidence_confidence: .8, score_version: "v1", calculated_at: "2026-08-22T00:00:00Z" }, geography: { geography_id: "IN-RJ-JPR-W42", country_code: "IN", admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42", spatial_cell: "cell", confidence: .9, boundary_source: "public boundary", boundary_version: "v1" }, score_explanation: [], representative_anonymized_request_summaries: ["Recurring road flooding near the school."], request_and_cluster_evidence_ids: ["request-1"], data_sources: [{ source_id: "source-1", synthetic: false }], missing_information: [], known_limitations: ["Approximate administrative geography."], investment_plan_records: [], bundle_version: 1, created_at: "2026-08-22T00:00:00Z", bundle_hash: "sha256:test" }) }));

  await page.goto("/command-center");
  await expect(page.getByText("IN-RJ-JPR-W42", { exact: true })).toBeVisible();
  await page.getByText("IN-RJ-JPR-W42", { exact: true }).click();
  await expect(page.getByText("Recurring road flooding near the school.")).toBeVisible();
  await expect(page.getByText("Approximate administrative geography.")).toBeVisible();
});
