import { NextRequest } from "next/server";
import { requireStaffProfile } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const profile = await requireStaffProfile(request, ["analyst", "policymaker", "admin"]);
    const { requestId } = await context.params;
    const result = await cloudRunRequest<unknown>({
      service: "normalization",
      path: `/internal/v1/review-queue/${encodeURIComponent(requestId)}/approve`,
      method: "POST",
      body: JSON.stringify({ reviewer_id: profile.uid, reviewer_role: profile.role }),
      signal: request.signal,
    });
    return success(result.data, result.traceId);
  } catch (error) {
    return routeError(error);
  }
}
