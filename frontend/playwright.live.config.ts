import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.LIVE_BASE_URL;
if (!baseURL) throw new Error("LIVE_BASE_URL is required for read-only live smoke tests.");

export default defineConfig({
  testDir: "./live-e2e",
  timeout: 45_000,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "390px Mobile Safari", use: { ...devices["iPhone 13"], browserName: "webkit", viewport: { width: 390, height: 844 } } },
    { name: "Tablet", use: { ...devices["iPad (gen 7)"], browserName: "chromium", viewport: { width: 820, height: 1180 } } },
    { name: "Desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
