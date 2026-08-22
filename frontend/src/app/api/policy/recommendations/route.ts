import { NextRequest } from "next/server";
import { requireStaffRole } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest) {
  try { await requireStaffRole(request, ["policymaker", "admin", "analyst"]); const result = await cloudRunRequest<unknown[]>({ service: "policy", path: `/v1/recommendations${request.nextUrl.search}`, signal: request.signal }); return success(result.data, result.traceId); }
  catch (error) { return routeError(error); }
}
export async function POST(request: NextRequest) {
  try { await requireStaffRole(request, ["policymaker", "admin"]); const result = await cloudRunRequest<Record<string, unknown>>({ service: "policy", path: "/v1/recommendations", method: "POST", body: JSON.stringify(await request.json()), signal: request.signal }); return success(result.data, result.traceId, 201); }
  catch (error) { return routeError(error); }
}
