import { NextRequest } from "next/server";
import { requireStaffRole } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function POST(request: NextRequest, context: { params: Promise<{ recommendationId: string }> }) {
  try { await requireStaffRole(request, ["policymaker", "admin"]); const { recommendationId } = await context.params; const result = await cloudRunRequest<Record<string, unknown>>({ service: "policy", path: `/v1/recommendations/${encodeURIComponent(recommendationId)}/decisions`, method: "POST", body: JSON.stringify(await request.json()), signal: request.signal }); return success(result.data, result.traceId); }
  catch (error) { return routeError(error); }
}
