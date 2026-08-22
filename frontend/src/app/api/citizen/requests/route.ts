import { NextRequest } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "citizen", path: "/v1/requests", method: "POST", body: JSON.stringify(body), headers: request.headers.get("Idempotency-Key") ? { "Idempotency-Key": request.headers.get("Idempotency-Key")! } : undefined, signal: request.signal });
    return success(result.data, result.traceId, 202);
  } catch (error) { return routeError(error); }
}
