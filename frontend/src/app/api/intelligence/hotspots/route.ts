import { NextRequest } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.search;
    const result = await cloudRunRequest<Record<string, unknown>>({ service: "intelligence", path: `/v1/hotspots${query}`, signal: request.signal });
    return success(result.data, result.traceId);
  } catch (error) { return routeError(error); }
}
