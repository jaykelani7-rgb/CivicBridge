import { z } from "zod";

export const firebasePublicConfigSchema = z.object({
  apiKey: z.string().trim().min(1).max(2048),
  authDomain: z.string().trim().min(1).max(253),
  projectId: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,61}[a-z0-9]$/),
  appId: z.string().trim().min(1).max(256),
  messagingSenderId: z.string().trim().regex(/^\d+$/),
  emailPasswordEnabled: z.boolean(),
}).strict();

export type FirebasePublicConfig = z.infer<typeof firebasePublicConfigSchema>;
