import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, STAFF_SESSION_COOKIE } from "@/lib/server/authorization";
import { assertSameOrigin } from "@/lib/server/csrf";
import { revokeFirebaseSessions, verifyFirebaseSessionCookie } from "@/lib/server/firebase-admin";
import { routeError } from "@/lib/server/route-response";
import { clearedSessionCookieOptions } from "@/lib/server/session-cookie";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const sessionCookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
    if (sessionCookie) {
      try {
        const decoded = await verifyFirebaseSessionCookie(sessionCookie);
        await revokeFirebaseSessions(decoded.uid);
      } catch (error) {
        const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
        if (code !== "auth/session-cookie-expired" && code !== "auth/session-cookie-revoked" && code !== "auth/argument-error") {
          throw new AuthorizationError(503, "SESSION_REVOCATION_FAILED", "The session could not be revoked. Retry sign-out.");
        }
      }
    }
    const response = NextResponse.json({ status: "signed_out" }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(STAFF_SESSION_COOKIE, "", clearedSessionCookieOptions());
    return response;
  } catch (error) {
    const response = routeError(error);
    response.cookies.set(STAFF_SESSION_COOKIE, "", clearedSessionCookieOptions());
    return response;
  }
}
