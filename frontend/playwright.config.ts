import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    env: {
      ...process.env,
      CITIZEN_CHANNELS_URL: "http://127.0.0.1:8000",
      AI_NORMALIZATION_URL: "http://127.0.0.1:8001",
      DATA_INTELLIGENCE_URL: "http://127.0.0.1:8002",
      POLICY_IMPACT_URL: "http://127.0.0.1:8003",
      FIREBASE_PROJECT_ID: "e2e-placeholder",
      AUTH_ORIGIN: "http://127.0.0.1:3100",
      NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-runtime-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "e2e-placeholder.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "e2e-placeholder",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456:web:e2e",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456",
      NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED: "false",
    },
  },
  projects: [
    { name: "Mobile Chrome", use: { ...devices["Pixel 7"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "Tablet", use: { ...devices["iPad (gen 7)"], browserName: "chromium" } },
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
  ],
});
