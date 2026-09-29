import { expect, test, type Page, type Route } from "@playwright/test";

const roleLabels = {
  analyst: ["Overview", "Hotspots", "Review", "Evidence", "More"],
  policymaker: ["Overview", "Hotspots", "Review", "Policy", "More"],
  csr_partner: ["Overview", "Projects", "Impact", "Explore", "More"],
  admin: ["Overview", "Hotspots", "Review", "Policy", "More"],
} as const;

async function mockSession(page: Page, role?: keyof typeof roleLabels) {
  await page.route("**/api/auth/me", (route) => role ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { uid: `e2e-${role}`, emailVerified: true, role } }) }) : route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Sign in" } }) }));
  await page.route("**/api/normalization/reviews", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
}

test.describe("mobile bottom navigation", () => {
  test("citizen tabs are public-safe, active, and usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockSession(page);
    await page.goto("/hotspots?country=IN");
    const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(5);
    for (const label of ["Home", "Explore", "Report", "Track", "More"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Analyst|Policy/ })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const boxes = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    expect(boxes.every((height) => height >= 44)).toBe(true);
  });

  for (const [role, labels] of Object.entries(roleLabels) as [keyof typeof roleLabels, readonly string[]][]) {
    test(`${role} receives only its verified role tabs`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockSession(page, role);
      await page.goto("/more");
      const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
      await expect(nav).toBeVisible();
      for (const label of labels) await expect(nav.getByRole("link", { name: label })).toBeVisible();
      await expect(nav.getByRole("link")).toHaveCount(5);
    });
  }

  test("secure sign-out posts to the existing logout endpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSession(page, "analyst");
    let logoutMethod = "";
    await page.route("**/api/auth/logout", (route: Route) => { logoutMethod = route.request().method(); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "signed_out" }) }); });
    await page.goto("/more");
    await page.getByRole("button", { name: "Sign out securely" }).click();
    await expect.poll(() => logoutMethod).toBe("POST");
  });

  test("navigation is hidden at the 768px breakpoint and desktop header remains", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockSession(page);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toBeHidden();
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("200 percent text scaling keeps the mobile navigation within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await mockSession(page);
    await page.goto("/more");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toBeVisible();
  });
});
