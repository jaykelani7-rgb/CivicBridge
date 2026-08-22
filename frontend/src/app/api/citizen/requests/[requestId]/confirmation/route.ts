import { NextRequest } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function PATCH(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await context.params;
    const body: unknown = await request.json();
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "citizen", path: `/v1/requests/${encodeURIComponent(requestId)}/confirmation`, method: "PATCH", body: JSON.stringify(body), signal: request.signal });
    return success(result.data, result.traceId);
  } catch (error) { return routeError(error); }
}
