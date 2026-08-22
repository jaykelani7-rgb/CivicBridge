import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthorizationError, idTokenVerificationError, safeStaffProfile, STAFF_SESSION_COOKIE } from "@/lib/server/authorization";
import { assertSameOrigin } from "@/lib/server/csrf";
import { createFirebaseSessionCookie, verifyFirebaseIdToken } from "@/lib/server/firebase-admin";
import { serverEnv } from "@/lib/server/env";
import { routeError } from "@/lib/server/route-response";
import { sessionCookieOptions } from "@/lib/server/session-cookie";

const requestSchema = z.object({ idToken: z.string().min(100).max(20_000) }).strict();
const MAX_AUTH_AGE_SECONDS = 5 * 60;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) throw new AuthorizationError(400, "ID_TOKEN_REQUIRED", "A Firebase ID token is required.");
    let decoded;
    try { decoded = await verifyFirebaseIdToken(parsed.data.idToken); }
    catch (error) { throw idTokenVerificationError(error); }
    const profile = safeStaffProfile(decoded);
    if (!decoded.auth_time || Math.floor(Date.now() / 1000) - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      throw new AuthorizationError(401, "RECENT_SIGN_IN_REQUIRED", "Sign in again before creating a staff session.");
    }
    const maxAgeSeconds = serverEnv().FIREBASE_SESSION_MAX_AGE_SECONDS;
    const sessionCookie = await createFirebaseSessionCookie(parsed.data.idToken, maxAgeSeconds * 1000);
    const response = NextResponse.json({ user: profile }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(STAFF_SESSION_COOKIE, sessionCookie, sessionCookieOptions());
    return response;
  } catch (error) { return routeError(error); }
}
