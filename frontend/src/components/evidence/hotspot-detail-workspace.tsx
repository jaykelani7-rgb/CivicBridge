"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, FileSearch } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { evidenceUsesDemoData } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";
import { authApi, authKeys } from "@/lib/api/auth";
import { policyApi, policyKeys } from "@/lib/api/policy";
import { componentCopy, confidenceLabel, groundedSummary, primaryWarning, strongestInfluences } from "@/lib/evidence/scoring-presentation";
import { QuickScoreExplanation } from "./quick-score-explanation";

export function HotspotDetailWorkspace({ hotspotId }: { hotspotId: string }) {
  const detail = useQuery({ queryKey: intelligenceKeys.detail(hotspotId), queryFn: () => intelligenceApi.detail(hotspotId) });
  const evidence = useQuery({ queryKey: intelligenceKeys.evidence(hotspotId), queryFn: () => intelligenceApi.evidence(hotspotId), retry: 1 });
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, staleTime: 60_000, retry: false });
  const recommendations = useQuery({ queryKey: policyKeys.recommendations, queryFn: policyApi.recommendations, retry: false });

  if (detail.isLoading) return <WorkspaceFrame><Skeleton className="h-80"/></WorkspaceFrame>;
  if (detail.isError || !detail.data) return <WorkspaceFrame><ErrorState title="Hotspot detail unavailable" message={isApiError(detail.error) ? detail.error.message : "The hotspot could not be loaded."} retry={() => void detail.refetch()}/></WorkspaceFrame>;
  const hotspot = detail.data.hotspot;
  const geography = detail.data.geography;
  const bundle = evidence.data;
  const recommendation = recommendations.data?.find((item) => item.hotspot_id === hotspotId);
  const canCreateRecommendation = session.data?.user.role === "policymaker" || session.data?.user.role === "admin";
  const warning = bundle ? primaryWarning(bundle) : hotspot.warnings?.[0] ?? null;

  return <WorkspaceFrame>
    <nav aria-label="Breadcrumb" className="text-sm text-[#52646d]"><Link className="font-bold text-[#004E72] hover:underline" href="/command-center#hotspots">Command Center</Link><span aria-hidden="true"> / </span><span>Hotspot detail</span></nav>
    <header className="mt-5 rounded-3xl border border-[#092634]/12 bg-white p-5 shadow-[0_12px_30px_rgba(9,38,52,.06)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap gap-2"><Badge variant="info">{hotspot.category}</Badge>{hotspot.provenance?.is_synthetic || (bundle && evidenceUsesDemoData(bundle)) ? <Badge variant="warning">Demonstration data — not official statistics</Badge> : <Badge variant="success">Live source status</Badge>}</div><h1 className="mt-4 text-3xl font-black sm:text-4xl">{geography.locality}, {geography.admin2}</h1><p className="mt-2 text-[#52646d]">{geography.admin1} · {hotspot.country_code}</p></div><Button asChild variant="outline"><Link href="/command-center#hotspots"><ArrowLeft className="mr-2 h-4 w-4"/>Back to hotspots</Link></Button></div></header>

    <section aria-labelledby="decision-summary" className="mt-6 rounded-3xl border border-[#092634]/12 bg-white p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-black uppercase tracking-[.16em] text-[#004E72]">Decision summary</p><h2 id="decision-summary" className="mt-2 text-2xl font-black">Why this hotspot needs attention</h2></div><div className="rounded-2xl bg-[#004E72] px-5 py-4 text-white"><span className="block text-sm">Action Score</span><strong className="text-3xl">{hotspot.action_score.toFixed(1)}</strong></div></div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Anonymized reports" value={String(hotspot.unique_request_count)}/><Metric label="Priority rank" value="Not supplied by backend"/><Metric label="Priority band" value="Not supplied by backend"/><Metric label="Evidence confidence" value={confidenceLabel(hotspot.evidence_confidence)}/><Metric label="Last calculated" value={formatDate(hotspot.calculated_at)}/><Metric label="Status" value={hotspot.status.replaceAll("_", " ")}/><Metric label="Recommendation" value={recommendations.isLoading ? "Checking…" : recommendation?.status.replaceAll("_", " ") ?? "No linked recommendation"}/><Metric label="Formula" value={hotspot.score_version}/></dl>
      <div className="mt-6 rounded-2xl bg-[#F9F9F9] p-5"><h3 className="font-bold">Backend-grounded explanation</h3>{bundle ? <p className="mt-2 leading-relaxed text-[#3f525c]">{groundedSummary(bundle)}</p> : evidence.isLoading ? <Skeleton className="mt-3 h-14"/> : <p className="mt-2 text-[#3f525c]">The score is available, but its supporting evidence could not currently be loaded.</p>}</div>
      {bundle ? <div className="mt-6"><h3 className="font-bold">Three strongest supplied influences</h3><div className="mt-3 grid gap-3 md:grid-cols-3">{strongestInfluences(bundle).map((component) => <article key={component.name} className="rounded-2xl border border-[#092634]/12 p-4"><p className="font-bold">{componentCopy(component.name).label}</p><p className="mt-1 text-sm text-[#52646d]">{componentCopy(component.name).meaning}</p><p className="mt-3 text-sm font-black text-[#004E72]">{component.weighted_contribution.toFixed(2)} component points</p></article>)}</div></div> : null}
      {warning ? <div className="mt-6 flex gap-3 rounded-2xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b43c17]" aria-hidden="true"/><div><h3 className="font-bold">Important limitation</h3><p className="mt-1 text-sm">{warning}</p></div></div> : null}
      <div className="mt-7 flex flex-wrap items-center gap-3"><Button asChild className="bg-[#004E72] text-white hover:bg-[#003d59]"><Link href={`/command-center/hotspots/${encodeURIComponent(hotspotId)}/evidence?tab=overview`}><FileSearch className="mr-2 h-4 w-4"/>View evidence</Link></Button><QuickScoreExplanation hotspotId={hotspotId} actionScore={hotspot.action_score} bundle={bundle}/>{recommendation || canCreateRecommendation ? <Button asChild variant="outline"><Link href="/csr-impact#policy">{recommendation ? "View recommendation" : "Create recommendation"}</Link></Button> : null}</div>
    </section>
  </WorkspaceFrame>;
}

function WorkspaceFrame({ children }: { children: React.ReactNode }) { return <main id="main-content" className="min-h-screen bg-[#F9F9F9] px-4 py-6 pb-[max(7rem,env(safe-area-inset-bottom))] text-[#092634] sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">{children}</div></main>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-2xl border border-[#092634]/10 bg-[#F9F9F9] p-4"><dt className="text-sm text-[#52646d]">{label}</dt><dd className="mt-1 break-words font-bold capitalize">{value}</dd></div>; }
function ErrorState({ title, message, retry }: { title: string; message: string; retry: () => void }) { return <section className="rounded-3xl border border-[#FF6E42]/30 bg-white p-8"><AlertTriangle className="h-6 w-6 text-[#b43c17]"/><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-[#52646d]">{message}</p><Button className="mt-5" onClick={retry}>Retry</Button></section>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(); }
