#!/usr/bin/env node
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const allowedRoles = new Set(["analyst", "policymaker", "admin", "csr_partner"]);
const [uid, role] = process.argv.slice(2);
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

if (!uid || !role) {
  process.stderr.write("Usage: npm run auth:set-role -- <firebase-uid> <analyst|policymaker|admin|csr_partner>\n");
  process.exit(2);
}
if (!allowedRoles.has(role)) {
  process.stderr.write(`Unknown role: ${role}. No claims were changed.\n`);
  process.exit(2);
}
if (!projectId) {
  process.stderr.write("Set FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT. No claims were changed.\n");
  process.exit(2);
}

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role });
process.stdout.write(`Assigned role '${role}' to Firebase UID '${uid}' in project '${projectId}'. Existing non-role claims were preserved. The user must refresh their ID token.\n`);
