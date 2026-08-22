import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireStaffProfile, STAFF_SESSION_COOKIE } from "@/lib/server/authorization";
import { routeError } from "@/lib/server/route-response";
import { clearedSessionCookieOptions } from "@/lib/server/session-cookie";

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffProfile(request);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = routeError(error);
    if (error instanceof AuthorizationError && error.status === 401) response.cookies.set(STAFF_SESSION_COOKIE, "", clearedSessionCookieOptions());
    return response;
  }
}
