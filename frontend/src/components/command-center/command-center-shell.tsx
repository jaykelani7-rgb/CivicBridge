"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, CheckCircle2, Filter, MapPinned, Radar, RefreshCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";
import { normalizationApi, normalizationKeys } from "@/lib/api/normalization";
import type { HotspotFilters } from "@/lib/api/types";
import { apiRequest } from "@/lib/api/client";
import { HotspotMap } from "./hotspot-map";
import { QuickScoreExplanation } from "@/components/evidence/quick-score-explanation";

const mapsConfigSchema = z.object({ enabled: z.boolean(), apiKey: z.string().optional(), mapId: z.string().optional() });

const countries = [{ value: "", label: "All countries" }, { value: "IN", label: "India" }, { value: "BR", label: "Brazil" }, { value: "ZA", label: "South Africa" }];

export function CommandCenterShell() {
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const [filters, setFilters] = useState<HotspotFilters>({ page: 1, page_size: 12 });
  const [adminFilter, setAdminFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("list");
  const hotspots = useQuery({ queryKey: intelligenceKeys.hotspots(filters), queryFn: () => intelligenceApi.hotspots(filters) });
  const reviews = useQuery({ queryKey: normalizationKeys.reviews, queryFn: normalizationApi.reviews });
  const approveReview = useMutation({
    mutationFn: normalizationApi.approve,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: normalizationKeys.reviews }),
        queryClient.invalidateQueries({ queryKey: ["intelligence"] }),
      ]);
    },
  });
  const items = hotspots.data?.items ?? [];
  const selected = selectedId ?? items[0]?.id ?? null;
  const mapsConfig = useQuery({ queryKey: ["runtime-config", "maps"], queryFn: () => apiRequest("/api/runtime-config/maps", mapsConfigSchema), staleTime: Infinity, retry: false });
  const filteredItems = adminFilter.trim() ? items.filter((item) => item.geographyId.toLowerCase().includes(adminFilter.toLowerCase())) : items;
  const hotspotError = hotspots.error;
  const permissionError = isApiError(hotspotError) && (hotspotError.status === 401 || hotspotError.status === 403 || hotspotError.code === "AUTH_NOT_CONFIGURED");

  function updateFilter(key: keyof HotspotFilters, value: string | number | undefined) { setFilters((current) => ({ ...current, [key]: value || undefined, page: key === "page" ? Number(value) : 1 })); setSelectedId(null); }

  return <main id="main-content" className="command-center-light min-h-screen overflow-x-hidden bg-[#f5f5f5] px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-[#092634] sm:px-6 lg:px-8">
    {mapsConfig.data?.enabled && mapsConfig.data.apiKey ? <div hidden aria-hidden="true"><APIProvider apiKey={mapsConfig.data.apiKey} libraries={["marker"]}/></div> : null}
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <span id="overview" className="scroll-mt-24" aria-hidden="true"/>
      <motion.header initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-white/10 bg-[#0d151e] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="info">Analyst workspace</Badge><h1 className="mt-4 font-heading text-4xl font-black text-white">Intelligence Command Center</h1><p className="mt-3 max-w-3xl text-[#a9b8c2]">Live paginated hotspots, scoring explanations, and bounded evidence bundles from Data Intelligence.</p></div><Button asChild variant="outline" className="border-white/15 bg-white/5 text-white"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Home</Link></Button></div>
      </motion.header>

      <span id="hotspots" className="scroll-mt-24" aria-hidden="true"/>
      <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-[#67d2bd]"/>Filters</CardTitle><CardDescription className="text-[#a9b8c2]">Country, geography ID, category, score, status, and page are sent to the canonical API.</CardDescription></div><Button variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => void hotspots.refetch()} disabled={hotspots.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${hotspots.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select aria-label="Country filter" value={filters.country_code ?? ""} onChange={(e) => updateFilter("country_code", e.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#071019] px-3">{countries.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <Input aria-label="Administrative area filter" value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} placeholder="Geography ID" className="border-white/10 bg-[#071019] text-white"/>
        <Input aria-label="Category filter" value={filters.category ?? ""} onChange={(e) => updateFilter("category", e.target.value)} placeholder="Category, e.g. drainage" className="border-white/10 bg-[#071019] text-white"/>
        <Input aria-label="Minimum Need Score" type="number" min="0" max="100" value={filters.min_need_score ?? ""} onChange={(e) => updateFilter("min_need_score", e.target.value ? Number(e.target.value) : undefined)} placeholder="Min Need Score" className="border-white/10 bg-[#071019] text-white"/>
        <select aria-label="Status filter" value={filters.status ?? ""} onChange={(e) => updateFilter("status", e.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#071019] px-3"><option value="">All statuses</option><option value="active">Active</option></select>
      </CardContent></Card>

      {hotspots.isLoading ? <LoadingGrid/> : permissionError && isApiError(hotspotError) ? <StateCard icon={<ShieldAlert className="h-6 w-6"/>} title="Staff access unavailable" message={hotspotError.message} retry={() => void hotspots.refetch()}/> : hotspots.isError ? <StateCard icon={<AlertTriangle className="h-6 w-6"/>} title="Hotspots could not be loaded" message={isApiError(hotspots.error) ? hotspots.error.message : "The intelligence service is unavailable."} retry={() => void hotspots.refetch()}/> : filteredItems.length === 0 ? <StateCard icon={<Radar className="h-6 w-6"/>} title="No hotspots match these filters" message="Adjust the filters or refresh. Production mode does not substitute mock hotspots."/> : <><div className="flex gap-2 xl:hidden"><Button variant={mobileView === "map" ? "accent" : "outline"} onClick={() => setMobileView("map")}>Map</Button><Button variant={mobileView === "list" ? "accent" : "outline"} onClick={() => setMobileView("list")}>Ranked list</Button></div><div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <div className={mobileView === "list" ? "hidden xl:block" : "block"}>{mapsConfig.isLoading ? <Skeleton className="h-[520px] bg-white/10"/> : mapsConfig.data?.enabled && mapsConfig.data.apiKey && mapsConfig.data.mapId ? <HotspotMap items={filteredItems} selectedId={selected} onSelect={setSelectedId} apiKey={mapsConfig.data.apiKey} mapId={mapsConfig.data.mapId} reducedMotion={Boolean(reducedMotion)}/> : <StateCard icon={<MapPinned className="h-6 w-6"/>} title="Map configuration required" message="The ranked list remains fully available. An owner must enable Maps JavaScript API and provide the restricted browser key and Map ID through the public runtime allowlist."/>}</div>
        <Card className={`${mobileView === "map" ? "hidden xl:block" : "block"} border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none`}><CardHeader><CardTitle>Ranked hotspots</CardTitle><CardDescription className="text-[#a9b8c2]">Map and list share the same privacy-safe administrative data. Positions shown are within the current result page.</CardDescription></CardHeader><CardContent className="max-h-[560px] space-y-3 overflow-y-auto">{filteredItems.map((item, index) => <article key={item.id} className={`w-full rounded-2xl border p-4 text-left transition ${selected === item.id ? "border-[#004E72] bg-[#004E72]/8" : "border-white/10 bg-white/[0.03] hover:border-[#004E72]/30"}`}><button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selected === item.id} className="w-full text-left"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Badge variant="secondary">Page position #{index + 1}</Badge><Badge variant="info">{item.category}</Badge>{item.provenance?.is_synthetic ? <Badge variant="warning">Synthetic</Badge> : null}</div><span className="text-xs text-[#a9b8c2]">{new Date(item.calculatedAt).toLocaleString()}</span></div><p className="mt-3 font-semibold"><MapPinned className="mr-2 inline h-4 w-4 text-[#004E72]"/>{item.geography ? `${item.geography.locality}, ${item.geography.admin2}` : item.geographyId}</p><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><Score label="Need" value={item.needScore}/><Score label="Action" value={item.actionScore}/><Score label="Confidence" value={item.evidenceConfidence * 100}/></div><p className="mt-3 text-xs text-[#a9b8c2]">{item.uniqueRequestCount} anonymized requests · {item.relatedCount} corroborating</p></button><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#092634]/10 pt-2"><QuickScoreExplanation hotspotId={item.id} actionScore={item.actionScore}/><Link className="inline-flex min-h-11 items-center rounded-lg px-3 font-bold text-[#004E72] hover:bg-[#004E72]/8" href={`/command-center/hotspots/${encodeURIComponent(item.id)}`}>View hotspot</Link></div></article>)}</CardContent>
          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4"><Button size="sm" variant="outline" disabled={(filters.page ?? 1) <= 1} onClick={() => updateFilter("page", Math.max(1, (filters.page ?? 1) - 1))}>Previous</Button><span className="text-sm text-[#a9b8c2]">Page {hotspots.data?.pagination.page} of {Math.max(1, hotspots.data?.pagination.pages ?? 1)} · {hotspots.data?.pagination.total} hotspots</span><Button size="sm" variant="outline" disabled={(filters.page ?? 1) >= (hotspots.data?.pagination.pages ?? 1)} onClick={() => updateFilter("page", (filters.page ?? 1) + 1)}>Next</Button></div>
        </Card>
      </div><span id="evidence" className="scroll-mt-24" aria-hidden="true"/><Card className="border-white/10 bg-[#0d151e] text-white"><CardContent className="p-6"><h2 className="text-2xl font-black">Evidence &amp; Scoring</h2><p className="mt-2 text-[#a9b8c2]">Select a hotspot from the ranked list, then open its focused detail and auditable evidence workspace.</p>{selected ? <Button asChild className="mt-4 bg-[#004E72] text-white"><Link href={`/command-center/hotspots/${encodeURIComponent(selected)}/evidence?tab=overview`}>Open selected hotspot evidence</Link></Button> : null}</CardContent></Card></>}

      <span id="review" className="scroll-mt-24" aria-hidden="true"/>
      <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="warning" className="w-fit">Human review queue</Badge><CardTitle className="mt-3">Normalization reviews</CardTitle><CardDescription className="text-[#a9b8c2]">High-urgency, low-confidence, or safety-flagged requests stay out of hotspot analytics until reviewed. Citizen text remains masked. Approval releases the normalized request to analytics; it does not approve a policy recommendation or project.</CardDescription></div><Button variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => void reviews.refetch()} disabled={reviews.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${reviews.isFetching ? "animate-spin" : ""}`}/>Refresh reviews</Button></div></CardHeader><CardContent>{reviews.isLoading ? <Skeleton className="h-32 bg-white/10"/> : reviews.isError ? <StateCard icon={<AlertTriangle className="h-6 w-6"/>} title="Review queue unavailable" message={isApiError(reviews.error) ? reviews.error.message : "AI Normalization could not be reached."} retry={() => void reviews.refetch()}/> : reviews.data?.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reviews.data.map((review) => <article key={review.request_id} className="rounded-2xl border border-[#f3b65f]/30 bg-[#f3b65f]/5 p-4"><div className="flex flex-wrap gap-2"><Badge variant="warning">{review.urgency} urgency</Badge><Badge variant="info">{review.category}</Badge><Badge variant="secondary">{Math.round(review.confidence * 100)}% confidence</Badge></div><p className="mt-3 text-sm leading-relaxed text-[#dbe4e9]">{review.public_summary}</p><p className="mt-3 text-xs text-[#a9b8c2]">Reason: {(review.review_reason ?? "human verification required").replaceAll("_", " ")}</p><p className="mt-1 break-all text-xs text-[#a9b8c2]">Request {review.request_id} · updated {new Date(review.updated_at).toLocaleString()}</p><Button className="mt-4 w-full" variant="accent" disabled={approveReview.isPending} onClick={() => { if (window.confirm("Approve this masked normalization for hotspot analytics? This does not approve any policy recommendation or project.")) approveReview.mutate(review.request_id); }}><CheckCircle2 className="mr-2 h-4 w-4"/>{approveReview.isPending && approveReview.variables === review.request_id ? "Approving…" : "Approve for analytics"}</Button>{approveReview.isError && approveReview.variables === review.request_id ? <p role="alert" className="mt-2 text-sm text-[#f3b65f]">{isApiError(approveReview.error) ? approveReview.error.message : "Approval could not be recorded. Try again."}</p> : null}</article>)}</div> : <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-[#a9b8c2]">No requests currently require human normalization review.</p>}</CardContent></Card>
    </div>
  </main>;
}

function Score({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-black/20 p-2"><p className="text-xs text-[#a9b8c2]">{label}</p><p className="mt-1 font-bold">{value.toFixed(1)}</p></div>; }
function LoadingGrid() { return <div className="grid gap-6 xl:grid-cols-2">{[0,1].map((item) => <Card key={item} className="border-white/10 bg-[#0d151e]"><CardContent className="space-y-3 p-6">{[0,1,2].map((line) => <Skeleton key={line} className="h-28 bg-white/10"/>)}</CardContent></Card>)}</div>; }
function StateCard({ icon, title, message, retry }: { icon: React.ReactNode; title: string; message: string; retry?: () => void }) { return <Card className="border-white/10 bg-[#0d151e] text-white"><CardContent className="p-8"><div className="text-[#f3b65f]">{icon}</div><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-2 text-[#a9b8c2]">{message}</p>{retry ? <Button className="mt-4" onClick={retry}>Retry</Button> : null}</CardContent></Card>; }
