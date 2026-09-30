"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Filter, List, Map, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { APIProvider } from "@vis.gl/react-google-maps";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api/client";
import { publicHotspotApi, publicHotspotKeys, type PublicHotspotFilters } from "@/lib/api/public-hotspots";
import type { PublicHotspot } from "@/lib/api/types";
import { PublicHotspotCard, affectedHref, publicArea } from "./public-hotspot-card";

const loadPublicHotspotMap = () => import("./public-hotspot-map");
const PublicHotspotMap = dynamic(() => loadPublicHotspotMap().then((module) => module.PublicHotspotMap), { ssr: false, loading: () => <Skeleton className="h-[min(60vh,34rem)] min-h-80 rounded-2xl"/> });
const mapsConfigSchema = z.object({ enabled: z.boolean(), apiKey: z.string().optional(), mapId: z.string().optional() });
const categories = ["water", "sanitation", "roads", "drainage", "electricity", "connectivity", "transport", "health", "education", "waste", "housing", "environment", "other"];

export function PublicHotspotExplorer() {
  const { locale, t } = usePublicLocale();
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [view, setView] = useState<"list" | "map">(params.get("view") === "map" ? "map" : "list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("hotspot"));
  const [search, setSearch] = useState(params.get("q") ?? "");
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const filters: PublicHotspotFilters = { country_code: params.get("country") ?? undefined, category: params.get("category") ?? undefined, status: params.get("status") ?? undefined, page: 1, page_size: 50 };
  const query = useQuery({ queryKey: publicHotspotKeys.list(filters), queryFn: () => publicHotspotApi.list(filters) });
  const maps = useQuery({ queryKey: ["runtime-config", "maps"], queryFn: () => apiRequest("/api/runtime-config/maps", mapsConfigSchema), staleTime: Infinity, retry: false });
  const items = useMemo(() => (query.data?.items ?? []).filter((item) => `${item.public_title} ${publicArea(item)} ${item.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [query.data?.items, search]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function setParam(key: string, value?: string) { const next = new URLSearchParams(params.toString()); if (value) next.set(key, value); else next.delete(key); router.replace(`${pathname}?${next}`, { scroll: false }); }
  function select(itemId: string | null) { setSelectedId(itemId); setParam("hotspot", itemId ?? undefined); }
  function chooseView(next: "list" | "map") { setView(next); setParam("view", next === "map" ? "map" : undefined); }
  function clearFilters() { const next = new URLSearchParams(params.toString()); ["country", "category", "status", "q"].forEach((key) => next.delete(key)); router.replace(`${pathname}?${next}`, { scroll: false }); setSearch(""); }
  useEffect(() => { const timer = window.setTimeout(() => setParam("q", search.trim() || undefined), 250); return () => window.clearTimeout(timer); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const preload = () => { void loadPublicHotspotMap(); };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = globalThis.setTimeout(preload, 150);
    return () => globalThis.clearTimeout(timer);
  }, []);
  useEffect(() => { if (!filtersOpen) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setFiltersOpen(false); filterTrigger.current?.focus(); } }; document.addEventListener("keydown", onKey); return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); }; }, [filtersOpen]);

  const active = [["country", filters.country_code], ["category", filters.category], ["status", filters.status], ["q", search.trim()]] as const;
  return <div className="space-y-5">
    {maps.data?.enabled && maps.data.apiKey ? <div hidden aria-hidden="true"><APIProvider apiKey={maps.data.apiKey} libraries={["marker"]}/></div> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="View"><Button variant={view === "list" ? "accent" : "outline"} onClick={() => chooseView("list")}><List className="mr-2 h-4 w-4"/>{t("list")}</Button><Button className="ml-2" variant={view === "map" ? "accent" : "outline"} onClick={() => chooseView("map")}><Map className="mr-2 h-4 w-4"/>{t("map")}</Button></div><Button ref={filterTrigger} variant="outline" onClick={() => setFiltersOpen(true)}><Filter className="mr-2 h-4 w-4"/>{t("filters")}</Button></div>
    <div className="relative"><Search className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-muted-foreground"/><Input aria-label={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlaceholder")} className="pl-11"/></div>
    {active.some(([,value]) => value) ? <div aria-label="Active filters" className="flex flex-wrap items-center gap-2">{active.filter(([,value]) => value).map(([key,value]) => <button key={key} onClick={() => key === "q" ? setSearch("") : setParam(key, undefined)} className="inline-flex min-h-11 items-center rounded-full bg-muted px-4 text-sm font-semibold">{value}<X className="ml-2 h-4 w-4" aria-hidden="true"/></button>)}<Button variant="ghost" onClick={clearFilters}>{t("clearFilters")}</Button></div> : null}
    {query.isLoading ? <div role="status" aria-label={t("loading")} className="grid gap-4 md:grid-cols-2">{[0,1,2,3].map((item) => <Skeleton key={item} className="h-80 rounded-2xl"/>)}</div> : query.isError ? <PublicHotspotState title={t("unavailable")} body={t("hotspotUnavailableBody")} retry={() => void query.refetch()} retryLabel={t("retry")}/> : !items.length ? <PublicHotspotState title={t("emptyTitle")} body={t("emptyBody")}/> : view === "map" ? <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]"><div>{maps.isLoading ? <Skeleton className="h-[min(60vh,34rem)] min-h-80 rounded-2xl"/> : maps.data?.enabled && maps.data.apiKey && maps.data.mapId ? <PublicHotspotMap items={items} selectedId={selectedId} onSelect={select} apiKey={maps.data.apiKey} mapId={maps.data.mapId}/> : <PublicHotspotState title={t("mapUnavailable")} body={t("mapPrivacy")}/>}<p className="mt-2 text-sm text-muted-foreground">{t("mapPrivacy")}</p></div><div className="max-h-[38rem] space-y-3 overflow-y-auto pr-1">{items.map((item) => <PublicHotspotCard key={item.id} item={item} selected={selectedId === item.id} onSelect={select}/>)}</div></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <PublicHotspotCard key={item.id} item={item} selected={selectedId === item.id} onSelect={select}/>)}</div>}
    {selected ? <PublicDetail item={selected} onClose={() => select(null)} locale={locale} t={t}/> : null}
    {filtersOpen ? <div className="fixed inset-0 z-[70] flex items-end bg-black/40 sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFiltersOpen(false); filterTrigger.current?.focus(); } }}><section role="dialog" aria-modal="true" aria-labelledby="public-filters-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-3xl"><div className="flex items-center justify-between"><h2 id="public-filters-title" className="font-heading text-2xl font-normal">{t("filters")}</h2><Button size="icon" variant="ghost" aria-label={t("closeFilters")} onClick={() => { setFiltersOpen(false); filterTrigger.current?.focus(); }}><X className="h-5 w-5"/></Button></div><div className="mt-6 grid gap-5"><FilterSelect label={t("country")} value={filters.country_code ?? ""} onChange={(value) => setParam("country", value)} options={[["",t("allCountries")],["IN","India"],["BR","Brasil"],["ZA","South Africa"]]}/><FilterSelect label={t("category")} value={filters.category ?? ""} onChange={(value) => setParam("category", value)} options={[["",t("allCategories")],...categories.map((value) => [value, value.replaceAll("_", " ")] as [string,string])]}/><FilterSelect label={t("status")} value={filters.status ?? ""} onChange={(value) => setParam("status", value)} options={[["",t("allStatuses")],["active",t("governmentReview")]]}/><Button variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button><Button onClick={() => { setFiltersOpen(false); filterTrigger.current?.focus(); }}>{t("list")}</Button></div></section></div> : null}
    <Button asChild className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 shadow-xl md:hidden"><Link href="/volunteer">{t("submit")}</Link></Button>
  </div>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string,string][] }) { return <label className="grid gap-2 font-semibold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-lg border border-border bg-background px-3 text-base font-normal">{options.map(([option,labelText]) => <option key={option} value={option}>{labelText}</option>)}</select></label>; }
export function PublicHotspotState({ title, body, retry, retryLabel }: { title: string; body: string; retry?: () => void; retryLabel?: string }) { return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-warning"/><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{body}</p>{retry ? <Button className="mt-4" onClick={retry}>{retryLabel}</Button> : null}</div>; }
export function PublicDetail({ item, onClose, locale, t }: { item: PublicHotspot; onClose: () => void; locale: "en"|"hi"|"pt"; t: ReturnType<typeof usePublicLocale>["t"] }) { const status = item.public_status === "under_review" ? t("governmentReview") : item.public_status === "project_active" ? t("projectActive") : item.public_status === "completed" ? t("completed") : t("monitoring"); return <section role="dialog" aria-modal="true" aria-labelledby="public-detail-title" className="fixed inset-0 z-[65] overflow-y-auto bg-background p-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:static md:rounded-3xl md:border md:border-border md:bg-card md:p-6"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between gap-3"><Badge variant="accent">{t("detailsTitle")}</Badge><Button variant="ghost" onClick={onClose} aria-label={t("detailsClose")}><X className="mr-2 h-4 w-4"/>{t("detailsClose")}</Button></div><h2 id="public-detail-title" className="mt-5 font-heading text-3xl font-normal">{item.public_title}</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><Detail label={t("area")} value={publicArea(item)}/><Detail label={t("currentStatus")} value={status}/><Detail label={t("updated")} value={new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale === "hi" ? "hi-IN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updated_at))}/></div><div className="mt-5 rounded-2xl bg-muted/50 p-5"><h3 className="font-bold">{t("publicSummary")}</h3><p className="mt-2 text-muted-foreground">{item.public_summary}</p></div><p className="mt-5 text-sm text-muted-foreground">{item.project ? `${item.project.title} · ${item.project.status}` : t("noProject")}</p><Button asChild className="mt-5"><Link href={affectedHref(item)}>{t("affected")}</Link></Button></div></section>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-border p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>; }
