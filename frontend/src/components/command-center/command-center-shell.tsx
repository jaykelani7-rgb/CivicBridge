"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Database, FileSearch, Filter, MapPinned, Radar, RefreshCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { evidenceUsesDemoData } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";
import type { HotspotFilters } from "@/lib/api/types";

const countries = [{ value: "", label: "All countries" }, { value: "IN", label: "India" }, { value: "BR", label: "Brazil" }, { value: "ZA", label: "South Africa" }];

export function CommandCenterShell() {
  const reducedMotion = useReducedMotion();
  const [filters, setFilters] = useState<HotspotFilters>({ page: 1, page_size: 12 });
  const [adminFilter, setAdminFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hotspots = useQuery({ queryKey: intelligenceKeys.hotspots(filters), queryFn: () => intelligenceApi.hotspots(filters) });
  const items = hotspots.data?.items ?? [];
  const selected = selectedId ?? items[0]?.id ?? null;
  const detail = useQuery({ queryKey: intelligenceKeys.detail(selected ?? ""), queryFn: () => intelligenceApi.detail(selected!), enabled: Boolean(selected) });
  const evidence = useQuery({ queryKey: intelligenceKeys.evidence(selected ?? ""), queryFn: () => intelligenceApi.evidence(selected!), enabled: Boolean(selected) });
  const filteredItems = adminFilter.trim() ? items.filter((item) => item.geographyId.toLowerCase().includes(adminFilter.toLowerCase())) : items;
  const hotspotError = hotspots.error;
  const permissionError = isApiError(hotspotError) && (hotspotError.status === 401 || hotspotError.status === 403 || hotspotError.code === "AUTH_NOT_CONFIGURED");

  function updateFilter(key: keyof HotspotFilters, value: string | number | undefined) { setFilters((current) => ({ ...current, [key]: value || undefined, page: key === "page" ? Number(value) : 1 })); setSelectedId(null); }

  return <main className="dark min-h-screen bg-[#071019] px-4 py-5 text-[#f2ede5] sm:px-6 lg:px-8">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <motion.header initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-white/10 bg-[#0d151e] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="info">Analyst workspace</Badge><h1 className="mt-4 font-heading text-4xl font-black text-white">Intelligence Command Center</h1><p className="mt-3 max-w-3xl text-[#a9b8c2]">Live paginated hotspots, scoring explanations, and bounded evidence bundles from Data Intelligence.</p></div><Button asChild variant="outline" className="border-white/15 bg-white/5 text-white"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Home</Link></Button></div>
      </motion.header>

      <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-[#67d2bd]"/>Filters</CardTitle><CardDescription className="text-[#a9b8c2]">Country, geography ID, category, score, status, and page are sent to the canonical API.</CardDescription></div><Button variant="outline" className="border-white/15 bg-white/5 text-white" onClick={() => void hotspots.refetch()} disabled={hotspots.isFetching}><RefreshCcw className={`mr-2 h-4 w-4 ${hotspots.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select aria-label="Country filter" value={filters.country_code ?? ""} onChange={(e) => updateFilter("country_code", e.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#071019] px-3">{countries.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <Input aria-label="Administrative area filter" value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} placeholder="Geography ID" className="border-white/10 bg-[#071019] text-white"/>
        <Input aria-label="Category filter" value={filters.category ?? ""} onChange={(e) => updateFilter("category", e.target.value)} placeholder="Category, e.g. drainage" className="border-white/10 bg-[#071019] text-white"/>
        <Input aria-label="Minimum Need Score" type="number" min="0" max="100" value={filters.min_need_score ?? ""} onChange={(e) => updateFilter("min_need_score", e.target.value ? Number(e.target.value) : undefined)} placeholder="Min Need Score" className="border-white/10 bg-[#071019] text-white"/>
        <select aria-label="Status filter" value={filters.status ?? ""} onChange={(e) => updateFilter("status", e.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#071019] px-3"><option value="">All statuses</option><option value="active">Active</option></select>
      </CardContent></Card>

      {hotspots.isLoading ? <LoadingGrid/> : permissionError && isApiError(hotspotError) ? <StateCard icon={<ShieldAlert className="h-6 w-6"/>} title="Staff access unavailable" message={hotspotError.message} retry={() => void hotspots.refetch()}/> : hotspots.isError ? <StateCard icon={<AlertTriangle className="h-6 w-6"/>} title="Hotspots could not be loaded" message={isApiError(hotspots.error) ? hotspots.error.message : "The intelligence service is unavailable."} retry={() => void hotspots.refetch()}/> : filteredItems.length === 0 ? <StateCard icon={<Radar className="h-6 w-6"/>} title="No hotspots match these filters" message="Adjust the filters or refresh. Production mode does not substitute mock hotspots."/> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><CardTitle>Truthful regional ranking</CardTitle><CardDescription className="text-[#a9b8c2]">This list represents administrative regions; it does not pretend to be a geographically exact map.</CardDescription></CardHeader><CardContent className="space-y-3">{filteredItems.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selected === item.id} className={`w-full rounded-2xl border p-4 text-left transition ${selected === item.id ? "border-[#67d2bd] bg-[#67d2bd]/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Badge variant="secondary">{item.countryCode}</Badge><Badge variant="info">{item.category}</Badge></div><span className="text-xs text-[#a9b8c2]">{new Date(item.calculatedAt).toLocaleString()}</span></div><p className="mt-3 font-semibold"><MapPinned className="mr-2 inline h-4 w-4 text-[#67d2bd]"/>{item.geographyId}</p><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><Score label="Need" value={item.needScore}/><Score label="Action" value={item.actionScore}/><Score label="Confidence" value={item.evidenceConfidence * 100}/></div><p className="mt-3 text-xs text-[#a9b8c2]">{item.uniqueRequestCount} unique · {item.duplicateCount} duplicate candidates · {item.relatedCount} related/corroborating</p></button>)}</CardContent>
          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4"><Button size="sm" variant="outline" disabled={(filters.page ?? 1) <= 1} onClick={() => updateFilter("page", Math.max(1, (filters.page ?? 1) - 1))}>Previous</Button><span className="text-sm text-[#a9b8c2]">Page {hotspots.data?.pagination.page} of {Math.max(1, hotspots.data?.pagination.pages ?? 1)} · {hotspots.data?.pagination.total} hotspots</span><Button size="sm" variant="outline" disabled={(filters.page ?? 1) >= (hotspots.data?.pagination.pages ?? 1)} onClick={() => updateFilter("page", (filters.page ?? 1) + 1)}>Next</Button></div>
        </Card>
        <EvidencePanel detail={detail} evidence={evidence}/>
      </div>}

      <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><Badge variant="warning" className="w-fit">Integration gap</Badge><CardTitle>AI normalization review service unavailable</CardTitle><CardDescription className="text-[#a9b8c2]">The canonical AI Normalization service does not expose a staff-facing human-review queue. No legacy OCR queue or private database is used.</CardDescription></CardHeader></Card>
    </div>
  </main>;
}

function Score({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-black/20 p-2"><p className="text-xs text-[#a9b8c2]">{label}</p><p className="mt-1 font-bold">{value.toFixed(1)}</p></div>; }
function LoadingGrid() { return <div className="grid gap-6 xl:grid-cols-2">{[0,1].map((item) => <Card key={item} className="border-white/10 bg-[#0d151e]"><CardContent className="space-y-3 p-6">{[0,1,2].map((line) => <Skeleton key={line} className="h-28 bg-white/10"/>)}</CardContent></Card>)}</div>; }
function StateCard({ icon, title, message, retry }: { icon: React.ReactNode; title: string; message: string; retry?: () => void }) { return <Card className="border-white/10 bg-[#0d151e] text-white"><CardContent className="p-8"><div className="text-[#f3b65f]">{icon}</div><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-2 text-[#a9b8c2]">{message}</p>{retry ? <Button className="mt-4" onClick={retry}>Retry</Button> : null}</CardContent></Card>; }

function EvidencePanel({ detail, evidence }: { detail: ReturnType<typeof useQuery<Awaited<ReturnType<typeof intelligenceApi.detail>>>>; evidence: ReturnType<typeof useQuery<Awaited<ReturnType<typeof intelligenceApi.evidence>>>> }) {
  const bundle = evidence.data;
  return <Card className="border-white/10 bg-[#0d151e] text-white hover:translate-y-0 hover:shadow-none"><CardHeader><CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-[#67d2bd]"/>Evidence Bundle</CardTitle><CardDescription className="text-[#a9b8c2]">Public-safe summaries, provenance, limitations, and score components supplied by the backend.</CardDescription></CardHeader><CardContent className="space-y-4">{detail.isLoading || evidence.isLoading ? <><Skeleton className="h-24 bg-white/10"/><Skeleton className="h-48 bg-white/10"/></> : detail.isError || evidence.isError ? <div className="rounded-2xl border border-[#f3b65f]/40 bg-[#f3b65f]/10 p-4"><p className="font-semibold">Evidence unavailable</p><p className="text-sm text-[#a9b8c2]">{isApiError(evidence.error) ? evidence.error.message : "Retry the selected hotspot."}</p><Button size="sm" className="mt-3" onClick={() => void evidence.refetch()}>Retry</Button></div> : bundle ? <>
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-wrap gap-2">{evidenceUsesDemoData(bundle) ? <Badge variant="warning">Demo data source</Badge> : <Badge variant="success">Live provenance</Badge>}<Badge variant="info">Bundle v{bundle.bundle_version}</Badge></div><p className="mt-3 font-semibold">{bundle.geography.locality}, {bundle.geography.admin2}, {bundle.geography.admin1}</p><p className="mt-1 text-xs text-[#a9b8c2]">Boundary: {bundle.geography.boundary_source} ({bundle.geography.boundary_version})</p></div>
    <div><p className="font-semibold">Representative anonymized summaries</p>{bundle.representative_anonymized_request_summaries.length ? <ul className="mt-2 space-y-2 text-sm text-[#c9d4db]">{bundle.representative_anonymized_request_summaries.map((summary, index) => <li key={`${summary}-${index}`} className="rounded-xl bg-white/[0.04] p-3">{summary}</li>)}</ul> : <p className="mt-2 text-sm text-[#a9b8c2]">No summaries supplied.</p>}</div>
    <div><p className="font-semibold">Scoring explanation</p><div className="mt-2 space-y-2">{bundle.score_explanation.map((component) => <div key={component.name} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between gap-2"><span className="capitalize">{component.name.replaceAll("_", " ")}</span><span>{component.weighted_contribution.toFixed(2)}</span></div><p className="mt-1 text-xs text-[#a9b8c2]">Weight {component.weight} · Confidence {(component.confidence * 100).toFixed(0)}%{component.missing ? " · Missing value/fallback used" : ""}</p></div>)}</div></div>
    {bundle.known_limitations.length ? <div className="rounded-2xl border border-[#f3b65f]/30 bg-[#f3b65f]/5 p-4"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4"/>Known limitations</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#c9d4db]">{bundle.known_limitations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    <div className="text-xs text-[#a9b8c2]"><Database className="mr-1 inline h-3 w-3"/>{bundle.data_sources.length} source records · {bundle.request_and_cluster_evidence_ids.length} request/cluster evidence IDs</div>
  </> : null}</CardContent></Card>;
}
