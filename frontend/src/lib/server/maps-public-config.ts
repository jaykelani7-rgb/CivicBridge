import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional(),
}).strict();

export type MapsPublicConfig = { enabled: boolean; apiKey?: string; mapId?: string };

export function runtimeMapsPublicConfig(environment: Record<string, string | undefined> = process.env): MapsPublicConfig {
  const values = schema.parse({
    NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: environment.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: environment.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: environment.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
  });
  const enabled = values.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true";
  if (enabled && (!values.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || !values.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID)) throw new Error("Maps is enabled without its public browser configuration.");
  return { enabled, apiKey: enabled ? values.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : undefined, mapId: enabled ? values.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID : undefined };
}
