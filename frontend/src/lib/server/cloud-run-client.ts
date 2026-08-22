import "server-only";
import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { ApiError } from "@/lib/api/errors";
import { serverEnv } from "./env";

type ServiceName = "citizen" | "intelligence" | "policy";
type CloudRunRequest = {
  service: ServiceName;
  path: string;
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const googleAuth = new GoogleAuth();

function baseUrl(service: ServiceName): string {
  const env = serverEnv();
  return service === "citizen" ? env.CITIZEN_CHANNELS_URL : service === "intelligence" ? env.DATA_INTELLIGENCE_URL : env.POLICY_IMPACT_URL;
}

export function shouldAttachIdToken(target: string, mode = serverEnv().CLOUD_RUN_AUTH_MODE): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  const url = new URL(target);
  return url.protocol === "https:" && (url.hostname.endsWith(".run.app") || url.hostname.endsWith(".a.run.app"));
}

function messageFromFastApi(payload: unknown, fallback: string): { code: string; message: string; retryable?: boolean; details?: unknown[]; traceId?: string } {
  if (!payload || typeof payload !== "object") return { code: "UPSTREAM_REQUEST_FAILED", message: fallback };
  const record = payload as Record<string, unknown>;
  const detail = record.detail;
  const root = detail && typeof detail === "object" ? detail as Record<string, unknown> : record;
  const nested = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : root;
  const validation = Array.isArray(detail) ? detail : Array.isArray(nested.details) ? nested.details : [];
  const validationMessage = validation.length ? validation.map((entry) => {
    if (!entry || typeof entry !== "object") return "Invalid value";
    const item = entry as Record<string, unknown>;
    const loc = Array.isArray(item.loc) ? item.loc.join(".") : "request";
    return `${loc}: ${typeof item.msg === "string" ? item.msg : "invalid value"}`;
  }).join("; ") : undefined;
  return {
    code: typeof nested.code === "string" ? nested.code : record.detail ? "UPSTREAM_VALIDATION_ERROR" : "UPSTREAM_REQUEST_FAILED",
    message: typeof nested.message === "string" ? nested.message : typeof detail === "string" ? detail : validationMessage ?? fallback,
    retryable: nested.retryable === true,
    details: validation,
    traceId: typeof nested.trace_id === "string" ? nested.trace_id : undefined,
  };
}

export async function cloudRunRequest<T>({ service, path, method = "GET", body, headers, signal, timeoutMs }: CloudRunRequest): Promise<{ data: T; traceId: string }> {
  const base = baseUrl(service);
  const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const traceId = randomUUID();
  const requestHeaders = new Headers(headers);
  requestHeaders.set("X-Trace-Id", traceId);
  if (body && !(body instanceof FormData) && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  if (shouldAttachIdToken(base)) {
    const client = await googleAuth.getIdTokenClient(base);
    const authHeaders = await client.getRequestHeaders(target);
    Object.entries(authHeaders).forEach(([key, value]) => { if (value) requestHeaders.set(key, value); });
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("BFF upstream timeout")), timeoutMs ?? serverEnv().BFF_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(target, { method, body, headers: requestHeaders, signal: controller.signal, cache: "no-store" });
    const responseTrace = response.headers.get("X-Trace-Id") ?? traceId;
    const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = messageFromFastApi(payload, `The ${service} service returned ${response.status}.`);
      throw new ApiError({ status: response.status, code: parsed.code, message: parsed.message, retryable: parsed.retryable ?? (response.status === 429 || response.status >= 500), traceId: parsed.traceId ?? responseTrace, details: parsed.details ?? [] });
    }
    return { data: payload as T, traceId: responseTrace };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timeoutLike = controller.signal.aborted;
    throw new ApiError({ status: timeoutLike ? 504 : 502, code: timeoutLike ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE", message: timeoutLike ? "The backend service did not respond in time." : "The backend service could not be reached.", retryable: true, traceId, details: [] });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export { messageFromFastApi };
