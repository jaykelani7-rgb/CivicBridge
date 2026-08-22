"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, MapPinned, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { demoModeEnabled } from "@/lib/api/adapters";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";

export function HotspotBrowser() {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const filters = { country_code: country || undefined, page: 1, page_size: 9 };
  const query = useQuery({ queryKey: intelligenceKeys.hotspots(filters), queryFn: () => intelligenceApi.hotspots(filters) });
  const items = (query.data?.items ?? []).filter((item) => `${item.geographyId} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const demoMode = demoModeEnabled();

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><Input aria-label="Search hotspots" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category or geography" className="pl-10"/></div><select aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-11 rounded-lg border border-border bg-background px-3"><option value="">All countries</option><option value="IN">India</option><option value="BR">Brazil</option><option value="ZA">South Africa</option></select><Button variant="outline" onClick={() => void query.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></div>
    {demoMode ? <Badge variant="warning">Demo data mode</Badge> : null}
    {query.isLoading ? <div className="grid gap-4 md:grid-cols-3">{[0,1,2].map((item) => <Skeleton key={item} className="h-60 rounded-2xl"/>)}</div> : query.isError ? <Card><CardContent className="p-6"><AlertTriangle className="h-5 w-5 text-warning"/><p className="mt-3 font-semibold">Live hotspots are unavailable</p><p className="mt-1 text-sm text-muted-foreground">{isApiError(query.error) ? query.error.message : "The service could not be reached."} No mock data was substituted.</p><Button size="sm" className="mt-3" onClick={() => void query.refetch()}>Retry</Button></CardContent></Card> : items.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Card key={item.id}><CardHeader><div className="flex flex-wrap gap-2"><Badge variant="secondary">{item.countryCode}</Badge><Badge variant="accent">{item.category}</Badge></div><CardTitle className="text-2xl capitalize">{item.category} hotspot</CardTitle><CardDescription className="flex items-center gap-2"><MapPinned className="h-4 w-4"/>{item.geographyId}</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-2"><Metric label="Need" value={item.needScore.toFixed(1)}/><Metric label="Action" value={item.actionScore.toFixed(1)}/><Metric label="Reports" value={String(item.uniqueRequestCount)}/></div><p className="mt-4 text-xs text-muted-foreground">Last updated {new Date(item.calculatedAt).toLocaleString()}</p><Button asChild variant="outline" className="mt-4 w-full"><Link href="/command-center">Open analyst details<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></CardContent></Card>)}</div> : <Card><CardContent className="p-8 text-center"><p className="font-semibold">No live hotspots found</p><p className="mt-1 text-sm text-muted-foreground">Try another filter. Production mode does not silently use examples.</p></CardContent></Card>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
