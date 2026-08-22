"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

const clientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

let authPromise: Promise<Auth> | undefined;
let emulatorConnected = false;

export function firebaseClientConfigured(): boolean {
  return Boolean(clientConfig.apiKey && clientConfig.authDomain && clientConfig.projectId && clientConfig.appId);
}

export function emailPasswordSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED === "true";
}

export async function browserFirebaseAuth(): Promise<Auth> {
  if (!firebaseClientConfigured()) throw new Error("Firebase web configuration is incomplete.");
  authPromise ??= (async () => {
    const app = getApps().length ? getApp() : initializeApp(clientConfig);
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    if (!emulatorConnected && process.env.NODE_ENV !== "production" && emulatorHost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(emulatorHost)) {
      connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
      emulatorConnected = true;
    }
    return auth;
  })();
  return authPromise;
}
