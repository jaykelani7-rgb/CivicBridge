import { NextRequest } from "next/server";
import { requireStaffRole } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try { await requireStaffRole(request, ["policymaker", "admin", "csr_partner", "analyst"]); const { projectId } = await context.params; const result = await cloudRunRequest<unknown[]>({ service: "policy", path: `/v1/projects/${encodeURIComponent(projectId)}/metrics`, signal: request.signal }); return success(result.data, result.traceId); }
  catch (error) { return routeError(error); }
}
export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try { await requireStaffRole(request, ["policymaker", "admin"]); const { projectId } = await context.params; const result = await cloudRunRequest<Record<string, unknown>>({ service: "policy", path: `/v1/projects/${encodeURIComponent(projectId)}/metrics`, method: "POST", body: JSON.stringify(await request.json()), signal: request.signal }); return success(result.data, result.traceId, 201); }
  catch (error) { return routeError(error); }
}
