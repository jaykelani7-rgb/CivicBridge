import { NextResponse } from "next/server";
import { runtimeMapsPublicConfig } from "@/lib/server/maps-public-config";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(runtimeMapsPublicConfig(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: { code: "MAPS_PUBLIC_CONFIG_INVALID", message: "The map is not configured.", retryable: false, details: [] } }, { status: 503 }); }
}
