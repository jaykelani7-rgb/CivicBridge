import "server-only";
import { z } from "zod";
import { firebasePublicConfigSchema, type FirebasePublicConfig } from "@/lib/firebase/config";

const runtimeEnvironmentSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string(),
  NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED: z.enum(["true", "false"]).default("false"),
}).strict();

export function runtimeFirebasePublicConfig(environment: NodeJS.ProcessEnv = process.env): FirebasePublicConfig {
  const values = runtimeEnvironmentSchema.parse({
    NEXT_PUBLIC_FIREBASE_API_KEY: environment.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: environment.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: environment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED: environment.NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED,
  });

  return firebasePublicConfigSchema.parse({
    apiKey: values.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: values.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: values.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: values.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    emailPasswordEnabled: values.NEXT_PUBLIC_FIREBASE_EMAIL_PASSWORD_ENABLED === "true",
  });
}
