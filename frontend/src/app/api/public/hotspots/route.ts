import { NextRequest, NextResponse } from "next/server";
import { hotspotPageSchema } from "@/lib/api/schemas";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { projectPublicHotspot } from "@/lib/server/public-hotspot-projection";
import { publicRouteError } from "@/lib/server/route-response";

const cacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

export async function GET(request: NextRequest) {
  try {
    const allowed = new URLSearchParams();
    for (const key of ["country_code", "category", "status", "page", "page_size"] as const) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) allowed.set(key, key === "status" && value === "under_review" ? "active" : value);
    }
    const result = await cloudRunRequest<unknown>({ service: "intelligence", path: `/v1/hotspots?${allowed}`, signal: request.signal });
    const page = hotspotPageSchema.parse(result.data);
    return NextResponse.json({ items: page.items.map(projectPublicHotspot), pagination: page.pagination }, {
      headers: { "Cache-Control": cacheControl, "X-Trace-Id": result.traceId },
    });
  } catch (error) {
    return publicRouteError(error);
  }
}
