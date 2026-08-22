import { z } from "zod";
import { adaptHotspotPage } from "./adapters";
import { apiRequest } from "./client";
import { evidenceBundleSchema, hotspotDetailSchema, hotspotPageSchema } from "./schemas";
import type { HotspotFilters } from "./types";

export const intelligenceKeys = { all: ["intelligence"] as const, hotspots: (filters: HotspotFilters) => ["intelligence", "hotspots", filters] as const, detail: (id: string) => ["intelligence", "hotspot", id] as const, evidence: (id: string) => ["intelligence", "evidence", id] as const };

export const intelligenceApi = {
  async hotspots(filters: HotspotFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
    const page = await apiRequest(`/api/intelligence/hotspots?${params}`, hotspotPageSchema);
    return adaptHotspotPage(page);
  },
  detail(id: string) { return apiRequest(`/api/intelligence/hotspots/${encodeURIComponent(id)}`, hotspotDetailSchema); },
  evidence(id: string) { return apiRequest(`/api/intelligence/hotspots/${encodeURIComponent(id)}/evidence`, evidenceBundleSchema); },
  score(id: string) { return apiRequest(`/api/intelligence/hotspots/${encodeURIComponent(id)}/score`, z.record(z.string(), z.unknown())); },
};
