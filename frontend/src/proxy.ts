import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (process.env.STAFF_AUTH_MODE === "development" && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (request.cookies.has("civicbridge_staff_token")) return NextResponse.next();
  const auth = new URL("/auth", request.url);
  auth.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(auth);
}

export const config = { matcher: ["/command-center/:path*", "/csr-impact/:path*"] };
