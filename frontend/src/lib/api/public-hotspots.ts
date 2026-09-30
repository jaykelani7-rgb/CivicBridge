import { apiRequest } from "./client";
import { publicHotspotPageSchema, publicHotspotSchema } from "./schemas";

export type PublicHotspotFilters = {
  country_code?: string;
  category?: string;
  status?: string;
  page?: number;
  page_size?: number;
};

export const publicHotspotKeys = {
  all: ["public-hotspots"] as const,
  list: (filters: PublicHotspotFilters) => ["public-hotspots", filters] as const,
  detail: (id: string) => ["public-hotspots", id] as const,
};

export const publicHotspotApi = {
  list(filters: PublicHotspotFilters = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return apiRequest(`/api/public/hotspots?${query}`, publicHotspotPageSchema);
  },
  detail(id: string) {
    return apiRequest(`/api/public/hotspots/${encodeURIComponent(id)}`, publicHotspotSchema);
  },
};
