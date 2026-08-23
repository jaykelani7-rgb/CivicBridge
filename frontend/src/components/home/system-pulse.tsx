"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleDot, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api/client";
import { systemSummarySchema } from "@/lib/api/schemas";

const steps = [
  ["Reports received", "reports_received"], ["Normalized", "normalized"], ["Clustered", "clustered"],
  ["Active priorities", "active_priorities"], ["Projects underway", "projects_underway"],
] as const;

export function SystemPulse() {
  const query = useQuery({ queryKey: ["system", "summary"], queryFn: () => apiRequest("/api/system/summary", systemSummarySchema), refetchInterval: 60_000 });
  if (query.isLoading) return <div aria-label="Loading system pulse" className="grid gap-2 sm:grid-cols-5">{steps.map(([label]) => <Skeleton key={label} className="h-20 rounded-2xl"/>)}</div>;
  if (query.isError) return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><div><p className="font-semibold">CivicBridge connects reports to accountable projects.</p><p className="text-sm text-muted-foreground">Live operational counts are temporarily unavailable.</p></div><Button size="sm" variant="outline" onClick={() => void query.refetch()}><RefreshCcw className="mr-2 h-4 w-4"/>Retry</Button></div>;
  const data = query.data;
  if (!data || steps.every(([, key]) => data[key] === 0)) return <div className="rounded-2xl border border-border bg-card p-4"><p className="font-semibold">The pipeline is ready for its first report.</p><p className="text-sm text-muted-foreground">Multilingual intake, normalization, clustering, prioritization, and project tracking are connected without example totals.</p></div>;
  return <section aria-label="Live System Pulse" className="space-y-3 rounded-2xl border border-border bg-card/95 p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-success"/><p className="font-semibold">Live System Pulse</p>{data.provenance === "synthetic" ? <Badge variant="warning">Demo dataset</Badge> : <Badge variant="success">Live data</Badge>}</div><p className="text-xs text-muted-foreground">Updated {data.updated_at ? new Date(data.updated_at).toLocaleString() : "when data changes"}</p></div><div className="grid gap-2 sm:grid-cols-5">{steps.map(([label, key], index) => <div key={key} className="relative rounded-xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-heading text-2xl font-black">{data[key]}</p>{index < steps.length - 1 ? <ArrowRight aria-hidden className="absolute -right-3 top-7 z-10 hidden h-4 w-4 text-muted-foreground sm:block"/> : null}</div>)}</div></section>;
}
