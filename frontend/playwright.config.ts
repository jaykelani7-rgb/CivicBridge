import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    env: { ...process.env, CITIZEN_CHANNELS_URL: "http://127.0.0.1:8000", DATA_INTELLIGENCE_URL: "http://127.0.0.1:8002", POLICY_IMPACT_URL: "http://127.0.0.1:8003", FIREBASE_PROJECT_ID: "e2e-placeholder", AUTH_ORIGIN: "http://127.0.0.1:3100" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
