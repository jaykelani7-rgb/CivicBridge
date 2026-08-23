import { NextRequest } from "next/server";
import { requireStaffRole } from "@/lib/server/authorization";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest) {
  try {
    await requireStaffRole(request, ["analyst", "policymaker", "admin"]);
    const result = await cloudRunRequest<unknown[]>({ service: "normalization", path: "/internal/v1/review-queue", signal: request.signal });
    return success(result.data, result.traceId);
  } catch (error) { return routeError(error); }
}
