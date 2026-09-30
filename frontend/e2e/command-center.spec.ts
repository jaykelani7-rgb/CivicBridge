import { expect, test } from "@playwright/test";

test("an unauthenticated visitor cannot enter the command center", async ({ page }) => {
  const analystApi = await page.request.get("/api/intelligence/hotspots");
  expect(analystApi.status()).toBe(401);
  expect((await analystApi.json()).error.code).toBe("AUTH_REQUIRED");
  const reviewApi = await page.request.get("/api/normalization/reviews");
  expect(reviewApi.status()).toBe(401);
  expect((await reviewApi.json()).error.code).toBe("AUTH_REQUIRED");
  const approveApi = await page.request.post("/api/normalization/reviews/request-id/approve");
  expect(approveApi.status()).toBe(401);
  expect((await approveApi.json()).error.code).toBe("AUTH_REQUIRED");
  await page.goto("/command-center");

  await expect(page).toHaveURL(/\/auth\?.*reason=authentication_required/);
  await expect(page.getByRole("heading", { name: "Secure staff access" })).toBeVisible();
  await expect(page.getByText("Staff sign-in required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});
