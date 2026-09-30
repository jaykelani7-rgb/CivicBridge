import { describe, expect, it } from "vitest";
import { runtimeMapsPublicConfig } from "./maps-public-config";

describe("maps public runtime allowlist", () => {
  it("returns a disabled state without exposing unrelated environment values", () => {
    expect(runtimeMapsPublicConfig({ NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: "false", DATA_INTELLIGENCE_URL: "https://private.example" })).toEqual({ enabled: false, apiKey: undefined, mapId: undefined });
  });
  it("requires both public values when enabled", () => {
    expect(() => runtimeMapsPublicConfig({ NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: "true", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "browser-key" })).toThrow();
  });
});
