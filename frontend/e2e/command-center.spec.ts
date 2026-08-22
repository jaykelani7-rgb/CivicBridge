import { expect, test } from "@playwright/test";

test("an unauthenticated visitor cannot enter the command center", async ({ page }) => {
  await page.goto("/command-center");

  await expect(page).toHaveURL(/\/auth\?.*reason=authentication_required/);
  await expect(page.getByRole("heading", { name: "Sign in to a protected workspace." })).toBeVisible();
  await expect(page.getByText("Staff sign-in required")).toBeVisible();
});
