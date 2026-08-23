import { expect, test } from "@playwright/test";

const viewports = [[320,568],[360,800],[375,812],[390,844],[412,915],[430,932],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900],[1920,1080]] as const;

test("public pages have no horizontal overflow at every required viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "Desktop Chrome", "The explicit viewport matrix runs once in Chromium.");
  await page.route(/\/api\/public\/hotspots(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], pagination: { page: 1, page_size: 50, total: 0, pages: 0 } }) }));
  await page.route("**/api/system/summary", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reports_received: 0, normalized: 0, clustered: 0, active_priorities: 0, projects_underway: 0, provenance: "synthetic", updated_at: null }) }));
  for (const [width,height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const path of ["/", "/hotspots", "/volunteer", "/track", "/more"]) {
      await page.goto(path);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits, `${path} overflows at ${width}x${height}`).toBe(true);
    }
  }
});
