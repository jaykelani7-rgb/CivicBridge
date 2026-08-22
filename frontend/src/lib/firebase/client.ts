"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { firebasePublicConfigSchema, type FirebasePublicConfig } from "./config";

const BROWSER_APP_NAME = "civicbridge-browser";
let configPromise: Promise<FirebasePublicConfig> | undefined;
let authPromise: Promise<Auth> | undefined;
let emulatorConnected = false;

export class FirebaseConfigurationError extends Error {
  constructor() {
    super("Staff sign-in is not configured correctly. Please contact a CivicBridge administrator.");
    this.name = "FirebaseConfigurationError";
  }
}

export function runtimeFirebaseConfig(): Promise<FirebasePublicConfig> {
  configPromise ??= (async () => {
    try {
      const response = await fetch("/api/auth/config", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Configuration endpoint unavailable");
      return firebasePublicConfigSchema.parse(await response.json());
    } catch {
      throw new FirebaseConfigurationError();
    }
  })();
  return configPromise;
}

export async function browserFirebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const config = await runtimeFirebaseConfig();
    const existingApp = getApps().find((app) => app.name === BROWSER_APP_NAME);
    const app = existingApp ?? initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId,
      messagingSenderId: config.messagingSenderId,
    }, BROWSER_APP_NAME);
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    const localBrowser = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!emulatorConnected && process.env.NODE_ENV !== "production" && localBrowser && emulatorHost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(emulatorHost)) {
      connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
      emulatorConnected = true;
    }
    return auth;
  })();
  return authPromise;
}

export function resetFirebaseClientForTests(): void {
  configPromise = undefined;
  authPromise = undefined;
  emulatorConnected = false;
}
