import { expect, test } from "@playwright/test";

const publicItem = { id: "hotspot-1", country_code: "IN", category: "drainage", public_title: "Recurring road flooding", public_summary: "Residents report repeated access disruption during rainfall.", administrative_area: { admin1: "Rajasthan", admin2: "Jaipur", locality: "Ward 42" }, public_centroid: { latitude: 26.91, longitude: 75.78, precision: "administrative_area" }, request_count: 5, priority_band: "high", public_status: "under_review", updated_at: "2026-08-22T12:00:00Z", project: null, synthetic: true };

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/public\/hotspots(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [publicItem], pagination: { page: 1, page_size: 50, total: 1, pages: 1 } }) }));
  await page.route("**/api/runtime-config/maps", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false }) }));
});

test("public list is privacy-safe, filterable, and carries coordinate-free intake context", async ({ page }) => {
  await page.goto("/hotspots");
  await expect(page.getByRole("heading", { name: "Public infrastructure needs" })).toBeVisible();
  await expect(page.getByText("Ward 42, Jaipur, Rajasthan")).toBeVisible();
  await expect(page.getByText("Synthetic demo data")).toBeVisible();
  await expect(page.getByText(/Need Score|Action Score|hotspot-1/)).toHaveCount(0);
  await page.getByLabel("Search public updates").fill("water");
  await expect(page.getByText("No public updates match")).toBeVisible();
  await page.getByRole("button", { name: /water/ }).click();
  await expect(page.getByText("Recurring road flooding")).toBeVisible();
  const affected = page.getByRole("link", { name: "I’m affected too" }).first();
  const href = await affected.getAttribute("href");
  expect(href).not.toMatch(/latitude|longitude|26\.91|75\.78/);
  await affected.click();
  await expect(page).toHaveURL(/\/volunteer\?/);
  await expect(page.getByText(/nothing is submitted automatically/i)).toBeVisible();
  await page.getByLabel("Written report alternative").fill("Flooding blocks my route during rainfall.");
  await page.getByRole("button", { name: /Continue to location/i }).click();
  await expect(page.getByLabel("Administrative area or landmark")).toHaveValue("Ward 42, Jaipur, Rajasthan");
});

test("map dependencies warm up early while the map stays lazy", async ({ page }) => {
  let configRequests = 0;
  await page.route("**/api/runtime-config/maps", (route) => { configRequests += 1; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false }) }); });
  await page.goto("/hotspots");
  await expect.poll(() => configRequests).toBe(1);
  await expect(page.getByRole("region", { name: "Map" })).toHaveCount(0);
  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.getByText(/map is unavailable/i)).toBeVisible();
  expect(configRequests).toBe(1);
  await expect(page.getByText("Recurring road flooding")).toBeVisible();
});
