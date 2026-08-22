import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function setValidPublicEnvironment(): void {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "public-api-key");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "civicbridge-1.firebaseapp.com");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "civicbridge-1");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:123456:web:abcdef");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "123456");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED", "false");
}

describe("GET /api/auth/config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns only the allowlisted public Firebase values", async () => {
    setValidPublicEnvironment();
    vi.stubEnv("CITIZEN_CHANNELS_URL", "https://citizen-private.run.app");
    vi.stubEnv("DATA_INTELLIGENCE_URL", "https://intelligence-private.run.app");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/private/service-account.json");
    vi.stubEnv("UNRELATED_PRIVATE_SECRET", "must-not-leak");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      apiKey: "public-api-key",
      authDomain: "civicbridge-1.firebaseapp.com",
      projectId: "civicbridge-1",
      appId: "1:123456:web:abcdef",
      messagingSenderId: "123456",
      emailPasswordEnabled: false,
    });
  });

  it("cannot expose backend URLs or arbitrary environment variables", async () => {
    setValidPublicEnvironment();
    vi.stubEnv("POLICY_IMPACT_URL", "https://policy-private.run.app");
    vi.stubEnv("ACCESS_TOKEN", "private-access-token");

    const serialized = JSON.stringify(await (await GET()).json());
    expect(serialized).not.toContain("run.app");
    expect(serialized).not.toContain("private-access-token");
    expect(serialized).not.toContain("ACCESS_TOKEN");
    expect(serialized).not.toContain("POLICY_IMPACT_URL");
  });

  it("returns a safe error when runtime configuration is missing", async () => {
    setValidPublicEnvironment();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    vi.stubEnv("UNRELATED_PRIVATE_SECRET", "must-not-leak");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: { code: "FIREBASE_PUBLIC_CONFIG_INVALID", message: "Staff sign-in is not configured correctly.", retryable: false, details: [] } });
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    expect(consoleError).toHaveBeenCalledWith("firebase_public_config_invalid");
    consoleError.mockRestore();
  });
});
