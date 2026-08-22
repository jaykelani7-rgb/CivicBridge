import type { ZodType } from "zod";
import { ApiError } from "./errors";

export async function apiRequest<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const nested = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
    throw new ApiError({
      status: response.status,
      code: typeof nested.code === "string" ? nested.code : "API_REQUEST_FAILED",
      message: typeof nested.message === "string" ? nested.message : `Request failed with status ${response.status}.`,
      retryable: nested.retryable === true || response.status === 429 || response.status >= 500,
      traceId: typeof nested.trace_id === "string" ? nested.trace_id : undefined,
      details: Array.isArray(nested.details) ? nested.details : [],
    });
  }
  return schema.parse(payload);
}
