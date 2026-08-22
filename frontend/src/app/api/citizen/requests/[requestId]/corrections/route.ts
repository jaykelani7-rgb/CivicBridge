import { NextRequest } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await context.params;
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "citizen", path: `/v1/requests/${encodeURIComponent(requestId)}/corrections`, method: "POST", body: JSON.stringify(await request.json()), signal: request.signal });
    return success(result.data, result.traceId);
  } catch (error) { return routeError(error); }
}
