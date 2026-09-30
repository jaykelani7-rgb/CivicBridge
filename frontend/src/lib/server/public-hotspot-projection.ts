import "server-only";
import { hotspotDetailSchema, hotspotDtoSchema } from "@/lib/api/schemas";
import type { PublicHotspot } from "@/lib/api/types";

const PUBLIC_COPY: Record<string, { title: string; summary: string }> = {
  water: { title: "Water supply disruption", summary: "Community reports indicate recurring disruption to reliable water access." },
  sanitation: { title: "Sanitation service need", summary: "Community reports indicate a recurring sanitation service gap." },
  roads: { title: "Road access disruption", summary: "Community reports indicate recurring disruption to safe road access." },
  drainage: { title: "Recurring road flooding", summary: "Residents report repeated access disruption during rainfall." },
  electricity: { title: "Electricity service disruption", summary: "Community reports indicate recurring electricity service disruption." },
  connectivity: { title: "Connectivity access gap", summary: "Community reports indicate unreliable access to digital connectivity." },
  transport: { title: "Public transport access gap", summary: "Community reports indicate recurring public transport access difficulties." },
  health: { title: "Health service access need", summary: "Community reports indicate a recurring barrier to local health services." },
  education: { title: "Education infrastructure need", summary: "Community reports indicate a recurring education infrastructure gap." },
  waste: { title: "Waste collection disruption", summary: "Community reports indicate recurring waste collection or disposal problems." },
  housing: { title: "Housing infrastructure need", summary: "Community reports indicate a recurring housing infrastructure concern." },
  environment: { title: "Local environmental concern", summary: "Community reports indicate a recurring local environmental infrastructure concern." },
  other: { title: "Public infrastructure need", summary: "Community reports indicate a recurring public infrastructure concern." },
};

function priorityBand(actionScore: number, requestCount: number, canonical?: string): PublicHotspot["priority_band"] {
  if (canonical === "critical" || canonical === "high") return "high";
  if (canonical === "medium") return "medium";
  if (canonical === "low" || canonical === "insufficient_evidence") return "emerging";
  if (actionScore >= 55 || requestCount >= 5) return "high";
  if (actionScore >= 40 || requestCount >= 3) return "medium";
  return "emerging";
}

function publicStatus(status: string): PublicHotspot["public_status"] {
  if (status === "completed") return "completed";
  if (["project_active", "in_progress"].includes(status)) return "project_active";
  if (["monitoring", "inactive"].includes(status)) return "monitoring";
  return "under_review";
}

export function projectPublicHotspot(value: unknown): PublicHotspot {
  const item = hotspotDtoSchema.parse(value);
  if (!item.geography) throw new Error("Public hotspot geography is unavailable.");
  const copy = PUBLIC_COPY[item.category] ?? PUBLIC_COPY.other;
  return {
    id: item.hotspot_id,
    country_code: item.country_code as PublicHotspot["country_code"],
    category: item.category,
    public_title: copy.title,
    public_summary: copy.summary,
    administrative_area: {
      admin1: item.geography.admin1,
      admin2: item.geography.admin2,
      locality: item.geography.locality,
    },
    public_centroid: item.geography.public_centroid,
    request_count: item.unique_request_count,
    priority_band: priorityBand(item.action_score, item.unique_request_count, item.priority?.band),
    priority: item.priority ? {
      rank: item.priority.rank, total_ranked: item.priority.total_ranked, band: item.priority.band,
      ranking_scope: item.priority.ranking_scope, ranked_at: item.priority.ranked_at,
      methodology_version: item.priority.methodology_version,
    } : undefined,
    public_status: publicStatus(item.status),
    updated_at: item.calculated_at,
    project: null,
    synthetic: item.provenance?.is_synthetic === true,
  };
}

export function projectPublicHotspotDetail(value: unknown): PublicHotspot {
  return projectPublicHotspot(hotspotDetailSchema.parse(value).hotspot);
}
