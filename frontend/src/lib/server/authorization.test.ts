import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({ verifyFirebaseSessionCookie: vi.fn() }));
vi.mock("./firebase-admin", () => ({ verifyFirebaseSessionCookie: firebaseMocks.verifyFirebaseSessionCookie }));

import { AuthorizationError, isStaffRole, requireStaffRole, safeStaffProfile, STAFF_SESSION_COOKIE } from "./authorization";

function token(role?: string): DecodedIdToken { return { uid: "uid-1", aud: "project", auth_time: 1, exp: 2, firebase: { identities: {}, sign_in_provider: "google.com" }, iat: 1, iss: "issuer", sub: "uid-1", role, email: "staff@example.com", email_verified: true } as DecodedIdToken; }
function request() { return new NextRequest("http://localhost:3000/api/protected", { headers: { Cookie: `${STAFF_SESSION_COOKIE}=session-cookie` } }); }

describe("role-based protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recognizes only validated staff roles", () => {
    expect(isStaffRole("analyst")).toBe(true);
    expect(isStaffRole("citizen")).toBe(false);
    expect(() => safeStaffProfile(token("unknown"))).toThrowError(AuthorizationError);
  });

  it("allows a verified session with an allowed custom role", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValue(token("analyst"));
    await expect(requireStaffRole(request(), ["analyst", "admin"])).resolves.toBe("analyst");
  });

  it("rejects a verified session with a forbidden role", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValue(token("csr_partner"));
    await expect(requireStaffRole(request(), ["analyst", "admin"])).rejects.toMatchObject({ status: 403, code: "ROLE_FORBIDDEN" });
  });

  it.each([
    ["auth/session-cookie-expired", "SESSION_EXPIRED"],
    ["auth/session-cookie-revoked", "SESSION_REVOKED"],
  ])("rejects %s sessions", async (firebaseCode, expectedCode) => {
    firebaseMocks.verifyFirebaseSessionCookie.mockRejectedValue({ code: firebaseCode });
    await expect(requireStaffRole(request(), ["analyst"])).rejects.toMatchObject({ status: 401, code: expectedCode });
  });
});
