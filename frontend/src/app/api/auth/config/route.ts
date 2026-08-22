import { NextResponse } from "next/server";
import { runtimeFirebasePublicConfig } from "@/lib/server/firebase-public-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(runtimeFirebasePublicConfig(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("firebase_public_config_invalid");
    return NextResponse.json(
      { error: { code: "FIREBASE_PUBLIC_CONFIG_INVALID", message: "Staff sign-in is not configured correctly.", retryable: false, details: [] } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
