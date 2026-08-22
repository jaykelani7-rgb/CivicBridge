import "server-only";
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { serverEnv } from "./env";

const ADMIN_APP_NAME = "civicbridge-frontend";

function adminApp(): App {
  const projectId = serverEnv().FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required for staff authentication.");
  return getApps().find((app) => app.name === ADMIN_APP_NAME) ?? initializeApp({ credential: applicationDefault(), projectId }, ADMIN_APP_NAME);
}

export function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth(adminApp()).verifyIdToken(idToken, true);
}

export function createFirebaseSessionCookie(idToken: string, expiresInMs: number): Promise<string> {
  return getAuth(adminApp()).createSessionCookie(idToken, { expiresIn: expiresInMs });
}

export function verifyFirebaseSessionCookie(sessionCookie: string): Promise<DecodedIdToken> {
  return getAuth(adminApp()).verifySessionCookie(sessionCookie, true);
}

export function revokeFirebaseSessions(uid: string): Promise<void> {
  return getAuth(adminApp()).revokeRefreshTokens(uid);
}
