import "server-only";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { serverEnv } from "./env";

export function sessionCookieOptions(): Partial<ResponseCookie> {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: serverEnv().FIREBASE_SESSION_MAX_AGE_SECONDS };
}

export function clearedSessionCookieOptions(): Partial<ResponseCookie> {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) };
}
