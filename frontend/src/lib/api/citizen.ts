import { apiRequest } from "./client";
import { adaptCitizenStatus } from "./adapters";
import { citizenReceiptSchema, citizenStatusSchema, confirmationSchema, mediaReceiptSchema } from "./schemas";
import { z } from "zod";
import type { ApproximateLocation, CreateCitizenRequest } from "./types";

export const citizenApi = {
  create(input: CreateCitizenRequest, idempotencyKey: string) {
    return apiRequest("/api/citizen/requests", citizenReceiptSchema, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) });
  },
  upload(requestId: string, file: Blob, filename: string) {
    const body = new FormData(); body.append("file", file, filename);
    return apiRequest(`/api/citizen/requests/${encodeURIComponent(requestId)}/media`, mediaReceiptSchema, { method: "POST", body });
  },
  async status(requestId: string, signal?: AbortSignal) {
    const value = await apiRequest(`/api/citizen/requests/${encodeURIComponent(requestId)}/status`, citizenStatusSchema, { signal });
    return adaptCitizenStatus(value);
  },
  confirm(requestId: string, location: ApproximateLocation, notes?: string) {
    return apiRequest(`/api/citizen/requests/${encodeURIComponent(requestId)}/confirmation`, confirmationSchema, { method: "PATCH", body: JSON.stringify({ location, notes }) });
  },
  correct(requestId: string, input: { reason: string; suggested_category?: string; notes?: string }) {
    return apiRequest(`/api/citizen/requests/${encodeURIComponent(requestId)}/corrections`, z.record(z.string(), z.unknown()), { method: "POST", body: JSON.stringify(input) });
  },
};

export const TERMINAL_CITIZEN_STAGES = new Set(["policy_approved", "project_active", "completed", "failed", "rejected"]);
