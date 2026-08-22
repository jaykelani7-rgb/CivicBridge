import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { NextRequest } from "next/server";
import { serverEnv } from "./env";

export type StaffRole = "analyst" | "policymaker" | "admin" | "csr_partner";
const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
export function isAllowedRole(role: string | undefined, allowed: StaffRole[]): role is StaffRole { return Boolean(role && allowed.includes(role as StaffRole)); }
export class AuthorizationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export async function requireStaffRole(request: NextRequest, allowed: StaffRole[]): Promise<StaffRole> {
  const env = serverEnv();
  if (env.STAFF_AUTH_MODE === "development") {
    if (process.env.NODE_ENV === "production") throw new AuthorizationError(503, "AUTH_CONFIGURATION_INVALID", "Development authorization cannot run in production.");
    const role = request.headers.get("X-CivicBridge-Dev-Role") as StaffRole | null;
    if (!role) throw new AuthorizationError(401, "AUTH_REQUIRED", "Set NEXT_PUBLIC_CIVICBRIDGE_DEV_ROLE for local staff workspace testing.");
    if (!isAllowedRole(role, allowed)) throw new AuthorizationError(403, "ROLE_FORBIDDEN", "Your development role cannot access this workspace.");
    return role;
  }
  if (!env.FIREBASE_PROJECT_ID) throw new AuthorizationError(503, "AUTH_NOT_CONFIGURED", "Staff authentication is not configured. Public citizen submission remains available.");
  const authorization = request.headers.get("Authorization");
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : request.cookies.get("civicbridge_staff_token")?.value;
  if (!idToken) throw new AuthorizationError(401, "AUTH_REQUIRED", "A Firebase ID token is required.");
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(idToken, firebaseKeys, { algorithms: ["RS256"], audience: env.FIREBASE_PROJECT_ID, issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` });
    payload = verified.payload;
  }
  catch { throw new AuthorizationError(401, "AUTH_TOKEN_INVALID", "The Firebase session is invalid or expired."); }
  const role = typeof payload.role === "string" ? payload.role as StaffRole : undefined;
  if (!isAllowedRole(role, allowed)) throw new AuthorizationError(403, "ROLE_FORBIDDEN", "Your account does not have the required CivicBridge role.");
  return role;
}
