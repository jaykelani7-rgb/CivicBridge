import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { PublicHotspotExplorer } from "@/components/public-hotspots/public-hotspot-explorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Public infrastructure needs | CivicBridge AI", description: "Privacy-safe, aggregated public infrastructure hotspots." };

export default function PublicHotspotsPage() {
  return <><SiteHeader/><main id="main-content" className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-10 lg:px-8"><div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Public transparency</p><h1 className="mt-3 text-balance font-heading text-[clamp(2.35rem,8vw,4.5rem)] font-black leading-[0.98]">Public infrastructure needs</h1><p className="mt-4 text-base text-muted-foreground sm:text-lg">Explore aggregated community reports at administrative-area precision. No citizen locations or private reports are shown.</p></div><section aria-label="Public hotspot explorer" className="mt-7 rounded-3xl border border-border bg-card/90 p-4 shadow-sm sm:p-6"><Suspense fallback={<Skeleton className="h-[32rem] rounded-2xl"/>}><PublicHotspotExplorer/></Suspense></section></main></>;
}
