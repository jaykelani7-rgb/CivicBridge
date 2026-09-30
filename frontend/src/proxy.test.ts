import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({ verifyFirebaseSessionCookie: vi.fn() }));
vi.mock("@/lib/server/firebase-admin", () => firebaseMocks);

import { proxy } from "./proxy";

const origin = "http://localhost:3000";
function request(path: string, signedIn = true) {
  return new NextRequest(`${origin}${path}`, signedIn ? { headers: { Cookie: "civicbridge_staff_session=verified-cookie" } } : {});
}
function token(role: string): DecodedIdToken {
  const now = Math.floor(Date.now() / 1000);
  return { uid: "staff-1", role, email_verified: true, aud: "civicbridge", auth_time: now, exp: now + 3600, firebase: { identities: {}, sign_in_provider: "google.com" }, iat: now, iss: "issuer", sub: "staff-1" } as DecodedIdToken;
}

describe("direct staff workspace entry", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("preserves a direct workspace and its query string for a signed-out visitor", async () => {
    const response = await proxy(request("/csr-impact?recommendation=rec-17", false));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("reason")).toBe("authentication_required");
    expect(location.searchParams.get("returnTo")).toBe("/csr-impact?recommendation=rec-17");
    expect(firebaseMocks.verifyFirebaseSessionCookie).not.toHaveBeenCalled();
  });

  it("admits only verified roles to each direct workspace", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValueOnce(token("policymaker"));
    expect((await proxy(request("/csr-impact"))).headers.get("x-middleware-next")).toBe("1");
    firebaseMocks.verifyFirebaseSessionCookie.mockResolvedValueOnce(token("analyst"));
    const denied = await proxy(request("/csr-impact?recommendation=rec-17"));
    const location = new URL(denied.headers.get("location")!);
    expect(location.searchParams.get("reason")).toBe("permission_denied");
    expect(location.searchParams.get("returnTo")).toBe("/csr-impact?recommendation=rec-17");
  });

  it("keeps the destination and an explicit reason when the server session expires", async () => {
    firebaseMocks.verifyFirebaseSessionCookie.mockRejectedValue({ code: "auth/session-cookie-expired" });
    const response = await proxy(request("/command-center/hotspots/h-9/evidence?tab=sources"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("reason")).toBe("expired_session");
    expect(location.searchParams.get("returnTo")).toBe("/command-center/hotspots/h-9/evidence?tab=sources");
  });
});
