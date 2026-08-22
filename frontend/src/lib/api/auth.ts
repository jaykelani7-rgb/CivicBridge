import { z } from "zod";
import { apiRequest } from "./client";

export const staffRoleSchema = z.enum(["analyst", "policymaker", "admin", "csr_partner"]);
export const safeStaffProfileSchema = z.object({
  uid: z.string(), email: z.string().email().optional(), emailVerified: z.boolean(),
  displayName: z.string().optional(), photoURL: z.string().url().optional(), role: staffRoleSchema,
});
export const authSessionSchema = z.object({ user: safeStaffProfileSchema });
export type SafeStaffProfile = z.infer<typeof safeStaffProfileSchema>;

export const authKeys = { me: ["auth", "me"] as const };
export const authApi = {
  createSession(idToken: string) { return apiRequest("/api/auth/session", authSessionSchema, { method: "POST", body: JSON.stringify({ idToken }), credentials: "same-origin" }); },
  me() { return apiRequest("/api/auth/me", authSessionSchema, { credentials: "same-origin", cache: "no-store" }); },
  logout() { return apiRequest("/api/auth/logout", z.object({ status: z.literal("signed_out") }), { method: "POST", credentials: "same-origin" }); },
};
