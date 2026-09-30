import { z } from "zod";
import { apiRequest } from "./client";
import { metricSchema, policyDecisionSchema, projectSchema, recommendationSchema } from "./schemas";

export const policyKeys = { recommendations: ["policy", "recommendations"] as const, projects: ["policy", "projects"] as const, metrics: (id: string) => ["policy", "projects", id, "metrics"] as const };
export const policyApi = {
  recommendations: () => apiRequest("/api/policy/recommendations", z.array(recommendationSchema)),
  createRecommendation: (input: { hotspot_id: string; evidence_bundle_id: string; title?: string }) => apiRequest("/api/policy/recommendations", recommendationSchema, { method: "POST", body: JSON.stringify(input) }),
  decide: (id: string, input: { action: "approve_for_assessment" | "request_evidence" | "defer" | "reject"; reason: string; actor_id: string; actor_role: string }) => apiRequest(`/api/policy/recommendations/${encodeURIComponent(id)}/decisions`, policyDecisionSchema, { method: "POST", body: JSON.stringify(input) }),
  projects: () => apiRequest("/api/policy/projects", z.array(projectSchema)),
  createProject: (input: { recommendation_id: string; title?: string; assigned_department?: string }) => apiRequest("/api/policy/projects", projectSchema, { method: "POST", body: JSON.stringify(input) }),
  updateProjectStatus: (id: string, status: "candidate" | "in_feasibility" | "approved_for_construction" | "in_progress" | "completed" | "cancelled") => apiRequest(`/api/policy/projects/${encodeURIComponent(id)}`, projectSchema, { method: "PATCH", body: JSON.stringify({ status }) }),
  metrics: (id: string) => apiRequest(`/api/policy/projects/${encodeURIComponent(id)}/metrics`, z.array(metricSchema)),
  addMetric: (id: string, input: { metric_code: string; baseline?: number | null; target?: number | null; current?: number | null; unit: string; direction: "higher_is_better" | "lower_is_better"; source_id: string; measured_at?: string; confidence?: number | null; source_type?: "manual"; methodology?: string }) => apiRequest(`/api/policy/projects/${encodeURIComponent(id)}/metrics`, metricSchema, { method: "POST", body: JSON.stringify(input) }),
};
