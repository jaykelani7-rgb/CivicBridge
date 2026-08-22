const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorJson = JSON.parse(text);
      if (errorJson.error && errorJson.error.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      if (text) {
        errorMessage = text;
      }
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export type RequestStatus = "pending" | "completed" | "failed" | "unusable" | "merged";

export interface CitizenRequestStatus {
  request_id: string;
  status: RequestStatus;
  created_at: string;
  channel: string;
  category: string;
  summary: string;
  urgency: string;
  pii_masked: boolean;
}

export interface HotspotProperty {
  hotspot_id: string;
  admin_id: string;
  admin_name: string;
  country_code: string;
  sector: string;
  request_rate: number;
  need_score: number;
  action_score: number;
  service_gap: number;
  vulnerability: number;
}

export interface HotspotFeature {
  type: "Feature";
  id: string;
  properties: HotspotProperty;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface HotspotFeatureCollection {
  type: "FeatureCollection";
  features: HotspotFeature[];
}

export interface EvidenceRequest {
  request_id: string;
  summary: string;
  translation: string;
  urgency: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export interface HotspotDetails {
  hotspot_id: string;
  geography_id: string;
  sector: string;
  need_score: number;
  need_formula: string;
  need_components: Record<string, number>;
  action_score: number;
  action_components: Record<string, number>;
  evidence_count: number;
  evidence: EvidenceRequest[];
  overlap_project?: Record<string, any>;
}

export interface ReviewQueueItem {
  request_id: string;
  tenant_country: string;
  created_at: string;
  language: string;
  transcript: string;
  translation: string;
  ai_fields: Record<string, any>;
  reason: string;
}

export interface RecommendationBrief {
  project_title: string;
  problem: string;
  proposed_intervention: string;
  intended_beneficiaries: { value: number; basis_source_ids: string[] };
  priority_rationale: Array<{ claim: string; source_ids: string[] }>;
  investment_alignment: Array<{ plan_project_id: string; relationship: string }>;
  delivery_dependencies: string[];
  risks: string[];
  budget_band: string;
  success_metrics: Array<{ metric: string; baseline_source_id: string; target: string }>;
  confidence: number;
  human_review_required: boolean;
}

export interface RecommendationResponse {
  recommendation_id: string;
  brief: RecommendationBrief;
}

export interface ProjectImpactMetric {
  metric_code: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  measured_at: string;
  source_id: string;
  confidence: number;
}

export interface ProjectImpactDetails {
  project_id: string;
  title: string;
  sector: string;
  status: string;
  metrics: ProjectImpactMetric[];
}

export const api = {
  // 1. Submit a raw text or audio complaint request
  async submitRequest(formData: FormData): Promise<{ request_id: string; status: string; message: string }> {
    return request<{ request_id: string; status: string; message: string }>("/v1/requests", {
      method: "POST",
      body: formData,
    });
  },

  // 2. Poll the status of a request
  async getRequestStatus(id: string): Promise<CitizenRequestStatus> {
    return request<CitizenRequestStatus>(`/v1/requests/${id}`);
  },

  // 3. Submit citizen/analyst correction to AI-predicted fields
  async submitCorrections(
    id: string,
    corrections: Array<{ field: string; old_value: any; new_value: any; reason: string }>,
    actorRole = "analyst"
  ): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/v1/requests/${id}/corrections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor_role: actorRole, corrections }),
    });
  },

  // 4. Retrieve pending human verification queue
  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    return request<ReviewQueueItem[]>("/v1/review-queue");
  },

  // 5. Submit analyst action on flagged items
  async submitReview(
    id: string,
    action: "approve" | "merge" | "split" | "mark_unusable",
    reason: string,
    mergeWithRequestId?: string,
    corrections?: Record<string, any>
  ): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/v1/review/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason,
        merge_with_request_id: mergeWithRequestId,
        corrections,
      }),
    });
  },

  // 6. Get GeoJSON demand hotspots
  async getHotspots(country?: string): Promise<HotspotFeatureCollection> {
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    return request<HotspotFeatureCollection>(`/v1/hotspots${qs}`);
  },

  // 7. Get score details and evidence for a hotspot
  async getHotspotDetails(id: string): Promise<HotspotDetails> {
    return request<HotspotDetails>(`/v1/hotspots/${id}`);
  },

  // 8. Generate project brief recommendation via Gemini
  async generateRecommendation(id: string): Promise<RecommendationResponse> {
    return request<RecommendationResponse>(`/v1/hotspots/${id}/recommendations`, {
      method: "POST",
    });
  },

  // 9. Approve / reject project recommendation
  async submitPolicyDecision(
    id: string,
    action: "approve" | "defer" | "reject",
    reason: string,
    actor = "policymaker"
  ): Promise<{ status: string; action: string; project_id: string | null; message: string }> {
    return request<{ status: string; action: string; project_id: string | null; message: string }>(
      `/v1/recommendations/${id}/decisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, actor }),
      }
    );
  },

  // 10. Get baseline to target project impact progress
  async getProjectImpact(id: string): Promise<ProjectImpactDetails> {
    return request<ProjectImpactDetails>(`/v1/projects/${id}/impact`);
  },

  // 11. Update project impact KPI value
  async updateProjectImpact(
    id: string,
    metricCode: string,
    currentValue: number,
    notes?: string
  ): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/v1/projects/${id}/impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric_code: metricCode, current_value: currentValue, notes }),
    });
  },

  // 12. Retrieve country-specific configuration
  async getCountryConfig(code: string): Promise<Record<string, any>> {
    return request<Record<string, any>>(`/v1/countries/${code}/config`);
  },
};
