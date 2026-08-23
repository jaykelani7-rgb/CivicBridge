import { expect, test } from "@playwright/test";

test("production public routes, map, and safe intake context work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto("/hotspots");
  await expect(page.getByRole("heading", { name: "Public infrastructure needs" })).toBeVisible();
  await expect(page.getByText("Synthetic demo data").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const affectedHref = await page.getByRole("link", { name: "I’m affected too" }).first().getAttribute("href");
  expect(affectedHref).not.toMatch(/latitude|longitude/);

  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("region", { name: "Map" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Oops! Something went wrong.")).toHaveCount(0);
  const marker = page.getByRole("button", { name: /^Select / }).first();
  if (await marker.count()) {
    await marker.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
});
