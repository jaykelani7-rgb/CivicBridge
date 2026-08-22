import "server-only";
import { NextRequest } from "next/server";
import { AuthorizationError } from "./authorization";
import { serverEnv } from "./env";

function normalizedOrigin(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (!origin) throw new AuthorizationError(403, "CSRF_ORIGIN_REQUIRED", "A same-origin request is required.");
  let actual: string;
  let expected: string;
  try {
    actual = normalizedOrigin(origin);
    expected = normalizedOrigin(serverEnv().AUTH_ORIGIN ?? request.nextUrl.origin);
  } catch {
    throw new AuthorizationError(403, "CSRF_ORIGIN_INVALID", "The request origin is invalid.");
  }
  if (actual !== expected || (fetchSite && fetchSite !== "same-origin")) {
    throw new AuthorizationError(403, "CSRF_ORIGIN_MISMATCH", "Cross-origin authentication requests are not allowed.");
  }
}
