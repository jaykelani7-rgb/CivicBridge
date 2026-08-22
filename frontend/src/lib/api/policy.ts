import { z } from "zod";
import { apiRequest } from "./client";
import { metricSchema, projectSchema, recommendationSchema } from "./schemas";

export const policyKeys = { recommendations: ["policy", "recommendations"] as const, projects: ["policy", "projects"] as const, metrics: (id: string) => ["policy", "projects", id, "metrics"] as const };
export const policyApi = {
  recommendations: () => apiRequest("/api/policy/recommendations", z.array(recommendationSchema)),
  createRecommendation: (input: { hotspot_id: string; evidence_bundle_id: string; title?: string }) => apiRequest("/api/policy/recommendations", recommendationSchema, { method: "POST", body: JSON.stringify(input) }),
  decide: (id: string, input: { action: "approve_for_assessment" | "request_evidence" | "defer" | "reject"; reason: string; actor_id: string; actor_role: string }) => apiRequest(`/api/policy/recommendations/${encodeURIComponent(id)}/decisions`, z.record(z.string(), z.unknown()), { method: "POST", body: JSON.stringify(input) }),
  projects: () => apiRequest("/api/policy/projects", z.array(projectSchema)),
  createProject: (input: { recommendation_id: string; title?: string; assigned_department?: string }) => apiRequest("/api/policy/projects", projectSchema, { method: "POST", body: JSON.stringify(input) }),
  metrics: (id: string) => apiRequest(`/api/policy/projects/${encodeURIComponent(id)}/metrics`, z.array(metricSchema)),
  addMetric: (id: string, input: { metric_code: string; baseline: number; target: number; current: number; unit: string; source_id: string; measured_at?: string; confidence: number }) => apiRequest(`/api/policy/projects/${encodeURIComponent(id)}/metrics`, metricSchema, { method: "POST", body: JSON.stringify(input) }),
};
