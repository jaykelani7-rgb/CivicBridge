import { NextRequest } from "next/server";
import { requireStaffRole } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest, context: { params: Promise<{ hotspotId: string }> }) {
  try {
    await requireStaffRole(request, ["analyst", "policymaker", "admin"]);
    const { hotspotId } = await context.params;
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "intelligence", path: `/v1/hotspots/${encodeURIComponent(hotspotId)}`, signal: request.signal });
    return success(result.data, result.traceId);
  } catch (error) { return routeError(error); }
}
