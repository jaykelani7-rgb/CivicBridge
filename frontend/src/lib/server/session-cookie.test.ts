import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetServerEnvForTests } from "./env";
import { clearedSessionCookieOptions, sessionCookieOptions } from "./session-cookie";

describe("staff session cookie policy", () => {
  beforeEach(() => {
    vi.stubEnv("CITIZEN_CHANNELS_URL", "http://127.0.0.1:8000");
    vi.stubEnv("DATA_INTELLIGENCE_URL", "http://127.0.0.1:8002");
    vi.stubEnv("POLICY_IMPACT_URL", "http://127.0.0.1:8003");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvForTests();
  });

  it("uses a bounded HttpOnly SameSite=Lax cookie", () => {
    vi.stubEnv("FIREBASE_SESSION_MAX_AGE_SECONDS", "432000");
    resetServerEnvForTests();
    expect(sessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 432000,
    });
  });

  it("sets Secure in production and expires the cookie when clearing it", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions().secure).toBe(true);
    expect(clearedSessionCookieOptions()).toMatchObject({ secure: true, maxAge: 0, path: "/" });
  });
});
