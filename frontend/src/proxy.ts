import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, STAFF_SESSION_COOKIE, type StaffRole, verifyStaffSession } from "@/lib/server/authorization";

function rolesForPath(pathname: string): readonly StaffRole[] {
  if (pathname.startsWith("/csr-impact")) return ["policymaker", "admin", "csr_partner"];
  return ["analyst", "policymaker", "admin"];
}

function authRedirect(request: NextRequest, reason: string) {
  const auth = new URL("/auth", request.url);
  auth.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  auth.searchParams.set("reason", reason);
  return NextResponse.redirect(auth);
}

export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (!cookie) return authRedirect(request, "authentication_required");
  try {
    await verifyStaffSession(cookie, rolesForPath(request.nextUrl.pathname));
    return NextResponse.next();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 403) return authRedirect(request, "permission_denied");
    if (error instanceof AuthorizationError && error.code === "SESSION_EXPIRED") return authRedirect(request, "expired_session");
    return authRedirect(request, "invalid_session");
  }
}

export const config = { matcher: ["/command-center/:path*", "/csr-impact/:path*"] };
