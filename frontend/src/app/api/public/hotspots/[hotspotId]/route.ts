import { NextRequest, NextResponse } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { projectPublicHotspotDetail } from "@/lib/server/public-hotspot-projection";
import { publicRouteError } from "@/lib/server/route-response";

export async function GET(request: NextRequest, context: { params: Promise<{ hotspotId: string }> }) {
  try {
    const { hotspotId } = await context.params;
    const result = await cloudRunRequest<unknown>({ service: "intelligence", path: `/v1/hotspots/${encodeURIComponent(hotspotId)}`, signal: request.signal });
    return NextResponse.json(projectPublicHotspotDetail(result.data), {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", "X-Trace-Id": result.traceId },
    });
  } catch (error) {
    return publicRouteError(error);
  }
}
