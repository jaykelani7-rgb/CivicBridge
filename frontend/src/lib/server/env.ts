import "server-only";
import { z } from "zod";

const serviceUrl = z.string().url().transform((value) => value.replace(/\/$/, ""));
const schema = z.object({
  CITIZEN_CHANNELS_URL: serviceUrl,
  DATA_INTELLIGENCE_URL: serviceUrl,
  POLICY_IMPACT_URL: serviceUrl,
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),
  CLOUD_RUN_AUTH_MODE: z.enum(["auto", "always", "never"]).default("auto"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SESSION_MAX_AGE_SECONDS: z.coerce.number().int().min(300).max(1_209_600).default(432_000),
  AUTH_ORIGIN: z.string().url().optional(),
  BFF_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}

export function resetServerEnvForTests() { cached = undefined; }
