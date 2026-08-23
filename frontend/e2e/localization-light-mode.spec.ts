import { expect, test } from "@playwright/test";

test("selected language follows the citizen across pages and the UI is light-only", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/more");
  await page.locator("#more-locale").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "अधिक" })).toBeVisible();
  await expect(page.getByText("सुलभता प्राथमिकताएँ")).toBeVisible();

  await page.goto("/volunteer");
  await expect(page.getByRole("heading", { name: "सार्वजनिक बुनियादी ढाँचा अनुरोध" })).toBeVisible();
  await expect(page.getByText("लिखित रिपोर्ट विकल्प")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "सार्वजनिक बुनियादी ढाँचा अनुरोध" })).toBeVisible();

  await page.goto("/track");
  await expect(page.getByRole("heading", { name: "भेजी गई रिपोर्ट ट्रैक करें" })).toBeVisible();
  await expect(page.locator(".dark")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /dark|light|theme/i })).toHaveCount(0);

  await page.goto("/more");
  await page.locator("#more-locale").selectOption("pt");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes("Hydration") || message.includes("React error #418"))).toEqual([]);
});
