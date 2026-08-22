import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(), createFirebaseSessionCookie: vi.fn(),
  verifyFirebaseSessionCookie: vi.fn(), revokeFirebaseSessions: vi.fn(),
}));
vi.mock("@/lib/server/firebase-admin", () => firebaseMocks);

import { POST as createSession } from "./session/route";
import { GET as getMe } from "./me/route";
import { POST as logout } from "./logout/route";
import { resetServerEnvForTests } from "@/lib/server/env";
import { STAFF_SESSION_COOKIE } from "@/lib/server/authorization";

const origin = "http://localhost:3000";
const idToken = "x".repeat(200);
function decoded(role?: string): DecodedIdToken { const now = Math.floor(Date.now() / 1000); return { uid: "uid-1", aud: "civicbridge-1", auth_time: now, exp: now + 3600, firebase: { identities: {}, sign_in_provider: "google.com" }, iat: now, iss: "issuer", sub: "uid-1", role, email: "staff@example.com", email_verified: true, name: "Staff User", picture: "https://example.com/photo.png", private_claim: "not-safe" } as DecodedIdToken; }
function mutationRequest(path: string, body?: unknown, requestOrigin = origin) { return new NextRequest(`${origin}${path}`, { method: "POST", headers: { Origin: requestOrigin, "Sec-Fetch-Site": requestOrigin === origin ? "same-origin" : "cross-site", "Content-Type": "application/json", ...(path === "/api/auth/logout" ? { Cookie: `${STAFF_SESSION_COOKIE}=session-value` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); }

describe("Firebase auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, { CITIZEN_CHANNELS_URL: "http://127.0.0.1:8000", DATA_INTELLIGENCE_URL: "http://127.0.0.1:8002", POLICY_IMPACT_URL: "http://127.0.0.1:8003", FIREBASE_PROJECT_ID: "civicbridge-1", AUTH_ORIGIN: origin, FIREBASE_SESSION_MAX_AGE_SECONDS: "432000" });
    resetServerEnvForTests();
  });

  it("creates a bounded HttpOnly server session from a valid ID token", async () => {
    firebaseMocks.verifyFirebaseIdToken.mockResolvedValue(decoded("analyst"));
    firebaseMocks.createFirebaseSessionCookie.mockResolvedValue("signed-session-cookie");
    const response = await createSession(mutationRequest("/api/auth/session", { idToken }));
    expect(response.status).toBe(200);
    expect((await response.json()).user).toEqual(expect.objectContaining({ uid: "uid-1", role: "analyst", email: "staff@example.com" }));
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("civicbridge_staff_session=signed-session-cookie");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Max-Age=432000/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(firebaseMocks.createFirebaseSessionCookie).toHaveBeenCalledWith(idToken, 432_000_000);
  });

  it("rejects an invalid ID token", async () => {
    firebaseMocks.verifyFirebaseIdToken.mockRejectedValue({ code: "auth/argument-error" });
    const response = await createSession(mutationRequest("/api/auth/session", { idToken }));
    expect(response.status).toBe(401); expect((await response.json()).error.code).toBe("ID_TOKEN_INVALID");
  });

  it("rejects a token without a valid custom role", async () => {
    firebaseMocks.verifyFirebaseIdToken.mockResolvedValue(decoded());
    const response = await createSession(mutationRequest("/api/auth/session", { idToken }));
    expect(response.status).toBe(403); expect((await response.json()).error.code).toBe("ROLE_CLAIM_MISSING");
  });

  it("rejects cross-origin session creation before token verification", async () => {
    const response = await createSession(mutationRequest("/api/auth/session", { idToken }, "https://attacker.example"));
    expect(response.status).toBe(403); expect((await response.json()).error.code).toBe("CSRF_ORIGIN_MISMATCH");
    expect(firebaseMocks.verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("returns only a safe profile for a valid session", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValue(decoded("admin"));
    const request = new NextRequest(`${origin}/api/auth/me`, { headers: { Cookie: `${STAFF_SESSION_COOKIE}=session-value` } });
    const response = await getMe(request); const body = await response.json();
    expect(response.status).toBe(200); expect(body.user).toEqual({ uid: "uid-1", email: "staff@example.com", emailVerified: true, displayName: "Staff User", photoURL: "https://example.com/photo.png", role: "admin" });
    expect(body.user.private_claim).toBeUndefined();
  });

  it.each([
    ["auth/session-cookie-expired", "SESSION_EXPIRED"],
    ["auth/session-cookie-revoked", "SESSION_REVOKED"],
  ])("rejects and clears %s sessions", async (firebaseCode, expectedCode) => {
    firebaseMocks.verifyFirebaseSessionCookie.mockRejectedValue({ code: firebaseCode });
    const request = new NextRequest(`${origin}/api/auth/me`, { headers: { Cookie: `${STAFF_SESSION_COOKIE}=session-value` } });
    const response = await getMe(request);
    expect(response.status).toBe(401); expect((await response.json()).error.code).toBe(expectedCode);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });

  it("revokes the Firebase session and clears the cookie on logout", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValue(decoded("analyst"));
    firebaseMocks.revokeFirebaseSessions.mockResolvedValue(undefined);
    const response = await logout(mutationRequest("/api/auth/logout"));
    expect(response.status).toBe(200); expect(firebaseMocks.revokeFirebaseSessions).toHaveBeenCalledWith("uid-1");
    expect(response.headers.get("set-cookie")).toMatch(/civicbridge_staff_session=;.*Max-Age=0/i);
  });

  it("rejects cross-origin logout and still clears the browser cookie", async () => {
    const response = await logout(mutationRequest("/api/auth/logout", undefined, "https://attacker.example"));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("CSRF_ORIGIN_MISMATCH");
    expect(firebaseMocks.verifyFirebaseSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toMatch(/civicbridge_staff_session=;.*Max-Age=0/i);
  });
});
