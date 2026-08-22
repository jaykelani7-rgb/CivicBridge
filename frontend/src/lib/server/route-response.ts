import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { AuthorizationError } from "./authorization";

export function success<T>(data: T, traceId?: string, status = 200) {
  const payload = Array.isArray(data) ? data : data && typeof data === "object" ? { ...data, ...(traceId ? { trace_id: traceId } : {}) } : data;
  return NextResponse.json(payload, { status, headers: traceId ? { "X-Trace-Id": traceId } : undefined });
}

export function routeError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: error.retryable, details: error.details, trace_id: error.traceId } }, { status: error.status });
  if (error instanceof AuthorizationError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, details: [] } }, { status: error.status });
  console.error("bff_request_failed", { error_type: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: { code: "BFF_INTERNAL_ERROR", message: "The request could not be completed safely.", retryable: true, details: [] } }, { status: 500 });
}
