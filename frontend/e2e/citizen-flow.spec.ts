import { expect, test } from "@playwright/test";

test("citizen submits, sees processing summary, and confirms", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.route(/\/api\/citizen\/requests$/, async (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ request_id: "11111111-1111-4111-8111-111111111111", status: "accepted", receipt_id: "RCT-11111111", message: "accepted", submitted_at: "2026-08-22T00:00:00Z" }) }));
  await page.route(/\/api\/citizen\/requests\/[^/]+\/status$/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request_id: "11111111-1111-4111-8111-111111111111", channel: "web_text", country_code: "IN", submitted_at: "2026-08-22T00:00:00Z", processing_stage: "normalizing", public_summary: "Stormwater drainage is blocked near the school.", category: "drainage", hotspot_score: null, project_title: null, project_status: null, pii_masked: true }) }));
  await page.route(/\/api\/citizen\/requests\/[^/]+\/confirmation$/, async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ request_id: "11111111-1111-4111-8111-111111111111", status: "confirmed", confirmed_at: "2026-08-22T00:01:00Z" }) }));

  await page.goto("/volunteer");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByLabel("Administrative area or landmark").fill("Ward 42, Jaipur");
  await page.getByLabel("Written report").fill("The stormwater drain near the school is blocked.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Stormwater drainage is blocked near the school.")).toBeVisible();
  await expect(page.getByText("drainage", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm report" }).click();
  await expect(page.getByText(/Report confirmed/i)).toBeVisible();
});
