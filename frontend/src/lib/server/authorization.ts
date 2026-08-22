import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { verifyFirebaseSessionCookie } from "./firebase-admin";

export const STAFF_SESSION_COOKIE = "civicbridge_staff_session";
export const STAFF_ROLES = ["analyst", "policymaker", "admin", "csr_partner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type SafeStaffProfile = { uid: string; email?: string; emailVerified: boolean; displayName?: string; photoURL?: string; role: StaffRole };

export class AuthorizationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = "AuthorizationError"; }
}

export function isStaffRole(value: unknown): value is StaffRole { return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole); }
export function isAllowedRole(role: StaffRole, allowed: readonly StaffRole[]): boolean { return allowed.includes(role); }

export function safeStaffProfile(token: DecodedIdToken): SafeStaffProfile {
  if (!isStaffRole(token.role)) throw new AuthorizationError(403, "ROLE_CLAIM_MISSING", "Your account does not have a valid CivicBridge staff role.");
  return {
    uid: token.uid,
    email: typeof token.email === "string" ? token.email : undefined,
    emailVerified: token.email_verified === true,
    displayName: typeof token.name === "string" ? token.name : undefined,
    photoURL: typeof token.picture === "string" ? token.picture : undefined,
    role: token.role,
  };
}

function firebaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

export function sessionVerificationError(error: unknown): AuthorizationError {
  const code = firebaseErrorCode(error);
  if (code === "auth/session-cookie-expired" || code === "auth/id-token-expired") return new AuthorizationError(401, "SESSION_EXPIRED", "Your staff session has expired. Sign in again.");
  if (code === "auth/session-cookie-revoked" || code === "auth/id-token-revoked") return new AuthorizationError(401, "SESSION_REVOKED", "Your staff session has been revoked. Sign in again.");
  return new AuthorizationError(401, "SESSION_INVALID", "Your staff session is invalid. Sign in again.");
}

export function idTokenVerificationError(error: unknown): AuthorizationError {
  const code = firebaseErrorCode(error);
  if (code === "auth/id-token-expired") return new AuthorizationError(401, "ID_TOKEN_EXPIRED", "The Firebase ID token has expired. Sign in again.");
  if (code === "auth/id-token-revoked") return new AuthorizationError(401, "ID_TOKEN_REVOKED", "The Firebase ID token has been revoked. Sign in again.");
  return new AuthorizationError(401, "ID_TOKEN_INVALID", "The Firebase ID token is invalid.");
}

export async function verifyStaffSession(sessionCookie: string, allowed: readonly StaffRole[] = STAFF_ROLES): Promise<SafeStaffProfile> {
  let token: DecodedIdToken;
  try { token = await verifyFirebaseSessionCookie(sessionCookie); }
  catch (error) { throw sessionVerificationError(error); }
  const profile = safeStaffProfile(token);
  if (!isAllowedRole(profile.role, allowed)) throw new AuthorizationError(403, "ROLE_FORBIDDEN", "Your account does not have permission to access this workspace.");
  return profile;
}

export async function requireStaffProfile(request: NextRequest, allowed: readonly StaffRole[] = STAFF_ROLES): Promise<SafeStaffProfile> {
  const cookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (!cookie) throw new AuthorizationError(401, "AUTH_REQUIRED", "A verified Firebase staff session is required.");
  return verifyStaffSession(cookie, allowed);
}

export async function requireStaffRole(request: NextRequest, allowed: readonly StaffRole[]): Promise<StaffRole> {
  return (await requireStaffProfile(request, allowed)).role;
}
