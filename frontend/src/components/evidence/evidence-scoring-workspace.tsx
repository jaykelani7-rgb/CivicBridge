"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, Database, FileSearch, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { authApi, authKeys } from "@/lib/api/auth";
import { evidenceUsesDemoData } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";
import type { EvidenceBundleDto } from "@/lib/api/types";
import { componentCopy, confidenceLabel, contributionText, groundedSummary, influenceLabel, isPenalty, limitationGroup, presentationDecisionReadiness, primaryWarning, reconcileActionScore, sortedComponents, strongestInfluences } from "@/lib/evidence/scoring-presentation";
import { evidenceVisibilityForRole } from "@/lib/evidence/role-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = ["overview", "citizen", "score", "sources", "limitations", "methodology"] as const;
type TabId = typeof tabs[number];
const tabLabels: Record<TabId, string> = { overview: "Overview", citizen: "Citizen Evidence", score: "Score Breakdown", sources: "Data Sources", limitations: "Limitations", methodology: "Methodology" };

export function EvidenceScoringWorkspace({ hotspotId }: { hotspotId: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const requestedTab = search.get("tab");
  const activeTab: TabId = tabs.includes(requestedTab as TabId) ? requestedTab as TabId : "overview";
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());
  const detail = useQuery({ queryKey: intelligenceKeys.detail(hotspotId), queryFn: () => intelligenceApi.detail(hotspotId) });
  const evidence = useQuery({ queryKey: intelligenceKeys.evidence(hotspotId), queryFn: () => intelligenceApi.evidence(hotspotId), retry: 1 });
  const score = useQuery({ queryKey: intelligenceKeys.score(hotspotId), queryFn: () => intelligenceApi.score(hotspotId), retry: 1 });
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, staleTime: 60_000, retry: false });

  function selectTab(tab: TabId, focus = false) {
    router.replace(`?tab=${tab}`, { scroll: false });
    if (focus) requestAnimationFrame(() => tabRefs.current.get(tab)?.focus());
  }
  function onTabKeyDown(event: React.KeyboardEvent, tab: TabId) {
    const index = tabs.indexOf(tab);
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next], true);
  }

  if (session.isLoading || detail.isLoading || evidence.isLoading) return <Frame><Skeleton className="h-52"/><Skeleton className="mt-5 h-96"/></Frame>;
  if (session.isError || !session.data) return <Frame><ErrorState title="Authorized staff access required" error={session.error} retry={() => void session.refetch()} detail="A verified analyst, policymaker, or administrator session is required."/></Frame>;
  if (detail.isError) return <Frame><ErrorState title="Hotspot unavailable" error={detail.error} retry={() => void detail.refetch()}/></Frame>;
  if (evidence.isError || !evidence.data || !detail.data) return <Frame><HeaderBack hotspotId={hotspotId}/>{detail.data ? <div className="mt-5 rounded-2xl bg-[#004E72] p-5 text-white"><span className="text-sm">Authoritative backend Action Score</span><strong className="ml-3 text-2xl">{detail.data.hotspot.action_score.toFixed(1)}</strong></div> : null}<ErrorState title="Evidence bundle unavailable" error={evidence.error} retry={() => void evidence.refetch()} detail="The Action Score may still exist, but its supporting evidence cannot currently be shown."/></Frame>;

  const bundle = evidence.data;
  const hotspot = detail.data.hotspot;
  const role = session.data.user.role;
  const visibility = evidenceVisibilityForRole(role);
  if (!visibility.workspace) return <Frame><ErrorState title="Authorized staff access required" error={new Error("Role forbidden")} retry={() => void session.refetch()} detail="This role cannot access internal hotspot evidence."/></Frame>;
  const demo = evidenceUsesDemoData(bundle) || hotspot.provenance?.is_synthetic;
  const stale = isBundleStale(bundle.created_at);
  const scoreData = score.data;
  return <Frame>
    <HeaderBack hotspotId={hotspotId}/>
    <header className="mt-5 rounded-3xl border border-[#092634]/12 bg-white p-5 shadow-[0_12px_30px_rgba(9,38,52,.06)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap gap-2">{demo ? <Badge variant="warning">Demonstration data — not official statistics</Badge> : <Badge variant="success">Live source status</Badge>}<Badge variant="info">Formula {bundle.hotspot_snapshot.score_version}</Badge>{role ? <Badge variant="secondary">{role.replaceAll("_", " ")} view</Badge> : null}</div><h1 className="mt-4 text-3xl font-black">Evidence &amp; Scoring</h1><p className="mt-2 text-lg font-bold">{bundle.hotspot_snapshot.category} · {bundle.geography.locality}, {bundle.geography.admin2}</p><p className="mt-1 text-sm text-[#52646d]">Calculated {formatDate(bundle.hotspot_snapshot.calculated_at)}</p></div><div className="grid min-w-[12rem] grid-cols-2 gap-2 rounded-2xl bg-[#004E72] p-4 text-white"><div><span className="block text-xs">Action Score</span><strong className="text-3xl">{bundle.hotspot_snapshot.action_score.toFixed(1)}</strong></div><div><span className="block text-xs">Priority rank</span><strong className="text-sm">{bundle.priority?.rank ? `#${bundle.priority.rank} of ${bundle.priority.total_ranked}` : "Unavailable"}</strong></div><div className="col-span-2 border-t border-white/25 pt-2 text-sm">{confidenceLabel(bundle.hotspot_snapshot.evidence_confidence)}</div></div></div>
      {demo ? <p role="status" className="mt-5 flex gap-2 rounded-xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-3 text-sm font-bold"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-[#b43c17]"/>This result includes demonstration fixtures. It is not an official statistic or an approved decision.</p> : null}{stale ? <p role="status" className="mt-3 flex gap-2 rounded-xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-3 text-sm font-bold"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-[#b43c17]"/>This evidence bundle is more than 30 days old. Verify recency before acting.</p> : null}
    </header>

    <div className="sticky top-0 z-20 -mx-4 mt-5 border-y border-[#092634]/10 bg-[#F9F9F9]/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:rounded-2xl sm:border">
      <div role="tablist" aria-label="Evidence sections" className="flex overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">{tabs.map((tab) => <button key={tab} ref={(node) => { if (node) tabRefs.current.set(tab, node); }} id={`tab-${tab}`} role="tab" aria-selected={activeTab === tab} aria-controls={`panel-${tab}`} tabIndex={activeTab === tab ? 0 : -1} onClick={() => selectTab(tab)} onKeyDown={(event) => onTabKeyDown(event, tab)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold ${activeTab === tab ? "bg-[#004E72] text-white" : "text-[#52646d] hover:bg-[#004E72]/8"}`}>{tabLabels[tab]}</button>)}</div>
    </div>

    <section id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="mt-5 rounded-3xl border border-[#092634]/12 bg-white p-5 sm:p-7">
      {activeTab === "overview" ? <Overview bundle={bundle}/> : null}
      {activeTab === "citizen" ? <CitizenEvidence bundle={bundle}/> : null}
      {activeTab === "score" ? <ScoreBreakdown bundle={bundle} score={scoreData} scoreError={score.isError} technical={visibility.technicalComponents}/> : null}
      {activeTab === "sources" ? <DataSources bundle={bundle}/> : null}
      {activeTab === "limitations" ? <Limitations bundle={bundle}/> : null}
      {activeTab === "methodology" ? <Methodology bundle={bundle} score={scoreData}/> : null}
    </section>
  </Frame>;
}

function Overview({ bundle }: { bundle: EvidenceBundleDto }) {
  const influences = strongestInfluences(bundle);
  const penalty = sortedComponents(bundle).find((component) => isPenalty(component.name, component.weighted_contribution));
  const warning = primaryWarning(bundle);
  return <div><SectionHeading eyebrow="Executive summary" title="What a reviewer should understand first"/><div className="mt-6 grid gap-4 lg:grid-cols-2"><Question title="What is happening?">{bundle.hotspot_snapshot.unique_request_count} privacy-safe requests are grouped under {bundle.hotspot_snapshot.category} in {bundle.geography.locality}.</Question><Question title="Why is this hotspot important?">The backend reports an Action Score of {bundle.hotspot_snapshot.action_score.toFixed(1)} and {confidenceLabel(bundle.hotspot_snapshot.evidence_confidence).toLowerCase()}.</Question><Question title="Why does it rank at this position?">{bundle.priority?.rank ? `The backend ranks it #${bundle.priority.rank} of ${bundle.priority.total_ranked} active hotspots in ${bundle.priority.ranking_scope.country_code}${bundle.priority.ranking_scope.category ? ` for ${bundle.priority.ranking_scope.category}` : ""}. ` : "Priority classification unavailable. "}{groundedSummary(bundle)}</Question><Question title="How reliable is the evidence?">Confidence is {(bundle.hotspot_snapshot.evidence_confidence * 100).toFixed(0)}%. This is evidence reliability, not certainty that a particular intervention will succeed.</Question></div>
    <p className="mt-5 rounded-xl bg-[#004E72]/8 p-4 font-bold">Evidence readiness: {readinessLabel(bundle.evidence_readiness?.state)}. <span className="font-normal">This state describes evidence completeness. It is not an approval or policy decision.</span></p>
    <h3 className="mt-8 text-xl font-black">Contribution summary</h3><ol className="mt-3 grid gap-3 md:grid-cols-3">{influences.map((component, index) => <li key={component.name} className="rounded-2xl border border-[#092634]/12 p-4"><span className="text-sm font-black text-[#004E72]">#{index + 1} influence</span><p className="mt-1 font-bold">{componentCopy(component.name).label}</p><p className="mt-1 text-sm text-[#52646d]">{contributionText(component.name, component.weighted_contribution)}</p></li>)}</ol>
    {penalty ? <p className="mt-4 rounded-xl bg-[#F9F9F9] p-4"><strong>{componentCopy(penalty.name).label}:</strong> {contributionText(penalty.name, penalty.weighted_contribution)}</p> : null}
    <div className="mt-6 rounded-2xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-5"><h3 className="font-black">What should be verified before acting?</h3><p className="mt-2">{warning ?? "No specific warning was supplied. Review source provenance and limitations before any decision."}</p></div></div>;
}

function CitizenEvidence({ bundle }: { bundle: EvidenceBundleDto }) {
  const groups = bundle.evidence_groups;
  return <div><SectionHeading eyebrow="Privacy-safe evidence" title="Representative citizen themes"/><p className="mt-4 rounded-2xl bg-[#004E72]/8 p-4 text-sm"><ShieldCheck className="mr-2 inline h-5 w-5 text-[#004E72]"/>Citizen identities and precise submission locations are excluded from this workspace. Evidence is shown only as anonymized themes and aggregates.</p>
    {groups?.length ? <ol className="mt-6 space-y-3">{groups.map((group) => <li key={group.group_id} className="rounded-2xl border border-[#092634]/12 p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#004E72]">Theme found across {group.report_count} anonymized {group.report_count === 1 ? "submission" : "submissions"}</p><p className="mt-2 leading-relaxed" lang={group.working_language} data-no-ui-translation="true">{group.representative_summary}</p><p className="mt-3 text-sm text-[#52646d]">Language: {group.original_language ?? "Unavailable"} · Evidence: {group.evidence_types.join(", ")}</p>{group.representative_original_summary ? <details className="mt-3 rounded-xl bg-[#F9F9F9] p-3"><summary className="min-h-11 cursor-pointer py-2 font-bold">Show anonymized original-language summary</summary><p className="pt-2" lang={group.original_language ?? undefined} data-no-ui-translation="true">{group.representative_original_summary}</p></details> : null}</li>)}</ol> : bundle.representative_anonymized_request_summaries.length ? <ol className="mt-6 space-y-3">{bundle.representative_anonymized_request_summaries.map((summary, index) => <li key={`${index}-${summary}`} className="rounded-2xl border border-[#092634]/12 p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#004E72]">Anonymized representative summary {index + 1}</p><p className="mt-2 leading-relaxed" data-no-ui-translation="true">{summary}</p></li>)}</ol> : <EmptyState title="No representative summaries" detail="The evidence bundle did not supply a public-safe summary."/>}
    {!groups ? <p className="mt-6 text-sm text-[#52646d]"><Info className="mr-2 inline h-4 w-4"/>This backend version does not provide safe duplicate-group metadata, so summaries remain separate.</p> : null}</div>;
}

function ScoreBreakdown({ bundle, score, scoreError, technical }: { bundle: EvidenceBundleDto; score?: Awaited<ReturnType<typeof intelligenceApi.score>>; scoreError: boolean; technical: boolean }) {
  const components = sortedComponents(bundle);
  const max = Math.max(1, ...components.map((component) => Math.abs(component.weighted_contribution)));
  const reconciliation = score ? reconcileActionScore(score) : null;
  return <div><SectionHeading eyebrow="Auditable calculation" title="Score Breakdown"/><div className="mt-6 rounded-2xl bg-[#F9F9F9] p-5"><h3 className="font-black">How to read the fields</h3><dl className="mt-3 grid gap-3 md:grid-cols-3"><Definition term="Weight">How strongly the configured methodology values a component.</Definition><Definition term="Confidence">How reliable or complete its underlying evidence is.</Definition><Definition term="Contribution">The component points added or removed at that scoring stage.</Definition></dl></div>
    <div className="mt-7" aria-labelledby="contribution-chart-title"><h3 id="contribution-chart-title" className="text-xl font-black">Contribution influence</h3><p className="mt-1 text-sm text-[#52646d]">Ordered by absolute contribution. Penalties are labelled in text and use a striped bar.</p><ol className="mt-4 space-y-4">{components.map((component) => <li key={component.name} className="grid gap-2 sm:grid-cols-[12rem_1fr_7rem] sm:items-center"><span className="font-bold">{componentCopy(component.name).label}</span><span aria-hidden="true" className="h-4 overflow-hidden rounded-full bg-[#092634]/8"><span className={`block h-full rounded-full ${isPenalty(component.name, component.weighted_contribution) ? "bg-[repeating-linear-gradient(135deg,#FF6E42,#FF6E42_6px,#c84a25_6px,#c84a25_12px)]" : "bg-[#004E72]"}`} style={{ width: `${Math.max(2, Math.abs(component.weighted_contribution) / max * 100)}%` }}/></span><span className="text-sm font-bold">{contributionText(component.name, component.weighted_contribution)}</span></li>)}</ol></div>
    <div className="mt-8 space-y-4">{components.map((component) => <article key={component.name} className="rounded-2xl border border-[#092634]/12 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{componentCopy(component.name).label}</h3><p className="text-sm font-bold text-[#004E72]">{influenceLabel(component.weighted_contribution)}</p></div><p className="font-black">{contributionText(component.name, component.weighted_contribution)}</p></div><p className="mt-3 text-[#52646d]">{componentCopy(component.name).meaning}</p><div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary">{confidenceLabel(component.confidence)}</Badge>{component.missing || component.fallback_used != null ? <Badge variant="warning">Estimate used—verify before approval</Badge> : null}</div>{component.missing || component.fallback_used != null ? <p className="mt-3 text-sm">This component used a configured fallback because the expected source value was unavailable. Its confidence was reduced accordingly.</p> : null}{technical ? <details className="mt-4 rounded-xl bg-[#F9F9F9] p-3"><summary className="min-h-11 cursor-pointer py-2 font-bold"><ChevronDown className="mr-2 inline h-4 w-4"/>Technical details</summary><dl className="grid gap-2 pt-3 text-sm sm:grid-cols-2"><Technical term="Raw value" value={component.raw_value == null ? "Unavailable" : String(component.raw_value)}/><Technical term="Normalized value" value={String(component.normalized_value)}/><Technical term="Configured weight" value={String(component.weight)}/><Technical term="Weighted contribution" value={String(component.weighted_contribution)}/><Technical term="Confidence" value={`${(component.confidence * 100).toFixed(0)}%`}/><Technical term="Fallback status" value={component.missing || component.fallback_used != null ? `Used${component.fallback_used != null ? ` (${component.fallback_used})` : ""}` : "Not used"}/><Technical term="Source" value={component.source_ids.length ? component.source_ids.join(", ") : "Unavailable"}/><Technical term="Formula version" value={component.formula_version}/></dl></details> : <p className="mt-4 text-sm text-[#52646d]">Technical source identifiers are reserved for analyst and administrator views.</p>}</article>)}</div>
    {scoreError ? <Notice>The component list is available, but the current score endpoint could not be loaded for reconciliation.</Notice> : reconciliation && !reconciliation.supported ? <Notice>{reconciliation.formulaText} The backend Action Score remains authoritative.</Notice> : reconciliation && !reconciliation.withinTolerance ? <Notice>Component reconciliation differs from the authoritative backend Action Score by {reconciliation.difference?.toFixed(3)} points. No browser-side correction was applied.</Notice> : reconciliation ? <p className="mt-6 flex gap-2 rounded-xl bg-[#568c47]/10 p-4"><CheckCircle2 className="h-5 w-5 text-[#3d6f31]"/>The documented formula reconciles within 0.02 points of the authoritative backend score.</p> : null}
  </div>;
}

function DataSources({ bundle }: { bundle: EvidenceBundleDto }) {
  const sources = bundle.sources ?? bundle.data_sources;
  const dependencies = useMemo(() => new Map(sources.map((source) => [source.source_id, source.supports_components?.map((name) => componentCopy(name).label) ?? bundle.score_explanation.filter((component) => source.source_id && component.source_ids.includes(source.source_id)).map((component) => componentCopy(component.name).label)])), [bundle, sources]);
  return <div><SectionHeading eyebrow="Provenance" title="Data Sources"/>{sources.length ? <div className="mt-6 space-y-4">{sources.map((source, index) => { const sourceType = sourceClassificationLabel(source.classification, source.synthetic); const synthetic = source.classification === "synthetic_demo" || source.synthetic === true || source.synthetic === 1; return <article key={source.source_id ?? index} className="rounded-2xl border border-[#092634]/12 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant={synthetic || source.classification === "unclassified" ? "warning" : "info"}>{synthetic ? "Demonstration data — not official statistics" : sourceType}</Badge><h3 className="mt-3 text-lg font-black">{source.dataset_name ?? source.dataset_title ?? "Dataset name unavailable"}</h3><p className="mt-1 text-sm text-[#52646d]">{source.publisher ?? "Publisher unavailable"}</p></div><Database className="h-6 w-6 text-[#004E72]"/></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Technical term="Source type" value={sourceType}/><Technical term="Country / coverage" value={[source.country_codes?.join(", ") ?? source.country_code, source.geographic_coverage].filter(Boolean).join(" · ") || "Unavailable"}/><Technical term="Observation period" value={source.observation_period ?? source.time_coverage ?? "Unavailable"}/><Technical term="Retrieved" value={source.retrieved_at ?? "Unavailable"}/><Technical term="Version" value={source.version ?? source.dataset_version ?? "Unavailable"}/><Technical term="Components" value={dependencies.get(source.source_id)?.join(", ") || "No component dependency supplied"}/></dl>{(source.known_limitations?.[0] ?? source.transformation_notes) ? <p className="mt-4 rounded-xl bg-[#F9F9F9] p-3 text-sm"><strong>Known source note:</strong> {source.known_limitations?.[0] ?? source.transformation_notes}</p> : null}{source.public_url ?? source.source_url ? <a href={source.public_url ?? source.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center font-bold text-[#004E72] underline">Open supplied provenance link</a> : null}</article>; })}</div> : <EmptyState title="Source provenance unavailable" detail="No source records were supplied in this evidence bundle."/>}</div>;
}

function Limitations({ bundle }: { bundle: EvidenceBundleDto }) {
  const structured = bundle.limitations_structured;
  const all = useMemo(() => [...bundle.known_limitations, ...bundle.missing_information], [bundle.known_limitations, bundle.missing_information]);
  const groups = useMemo(() => Map.groupBy(all, limitationGroup), [all]);
  const readiness = bundle.evidence_readiness ? readinessLabel(bundle.evidence_readiness.state) : presentationDecisionReadiness(bundle);
  return <div><SectionHeading eyebrow="Review warnings" title="Limitations"/><div className="mt-6 rounded-2xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-5"><p className="text-sm font-black uppercase tracking-[.12em]">Evidence readiness — not a policy decision</p><h3 className="mt-2 text-2xl font-black">{readiness}</h3><p className="mt-2 text-sm">This state describes evidence completeness. It is not an approval or policy decision.</p></div>{structured?.length ? <div className="mt-6 space-y-3">{structured.map((limitation) => <article key={`${limitation.code}-${limitation.affected_components.join("-")}`} className="rounded-2xl border border-[#092634]/12 p-4"><div className="flex flex-wrap gap-2"><Badge variant={limitation.severity === "information" ? "info" : "warning"}>{limitation.severity}</Badge><span className="font-mono text-xs">{limitation.code}</span></div><p className="mt-3">{limitation.message}</p>{limitation.affected_components.length ? <p className="mt-2 text-sm text-[#52646d]"><strong>Affected components:</strong> {limitation.affected_components.map((name) => componentCopy(name).label).join(", ")}</p> : null}<p className="mt-2 text-sm"><strong>Reviewer action:</strong> {limitation.reviewer_action}</p></article>)}</div> : all.length ? <div className="mt-6 space-y-6">{Array.from(groups.entries()).map(([group, limitations]) => <section key={group}><h3 className="text-lg font-black">{group}</h3><div className="mt-3 space-y-3">{limitations.map((limitation, index) => <article key={`${group}-${index}`} className="rounded-2xl border border-[#092634]/12 p-4"><p>{limitation}</p><p className="mt-2 text-sm text-[#52646d]">Structured affected-component and reviewer-action metadata is unavailable from this backend version.</p></article>)}</div></section>)}</div> : <EmptyState title="No limitations reported" detail="The backend did not supply limitations for this evidence bundle. This is not a guarantee that none exist."/>}</div>;
}

function Methodology({ bundle, score }: { bundle: EvidenceBundleDto; score?: Awaited<ReturnType<typeof intelligenceApi.score>> }) {
  const reconciliation = score ? reconcileActionScore(score) : null;
  const steps = ["Aggregate privacy-safe citizen demand.", "Measure infrastructure need and reported severity.", "Include population and equity considerations.", "Evaluate evidence confidence and strategic alignment.", "Account for delivery readiness.", "Apply existing-coverage penalties.", "Combine the configured contributions into the Action Score."];
  return <div><SectionHeading eyebrow="Formula guide" title="How CivicBridge scoring works"/>{bundle.hotspot_snapshot.score_version === "priority-1.0.0" ? <><ol className="mt-6 space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-3 rounded-2xl border border-[#092634]/12 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#004E72] font-black text-white">{index + 1}</span><span className="pt-1">{step}</span></li>)}</ol><div className="mt-7 rounded-2xl bg-[#092634] p-5 text-white"><h3 className="text-xl font-black">Current formula values</h3><p className="mt-3">Action Score = 60% of Need Score + strategic alignment contribution + delivery readiness contribution + data confidence contribution − supported coverage penalty.</p><p className="mt-3 font-mono text-sm">Backend Action Score: {bundle.hotspot_snapshot.action_score.toFixed(2)}</p>{reconciliation ? <p className="mt-2 text-sm">{reconciliation.formulaText}</p> : <p className="mt-2 text-sm">The score endpoint is unavailable, so the displayed backend score is not recalculated in the browser.</p>}<p className="mt-3 text-sm text-white/80">Inputs are normalized or use a configured fallback when missing; Need and Action scores are clamped to 0–100 and rounded by the backend.</p></div></> : <Notice>The bundle uses formula {bundle.hotspot_snapshot.score_version}. The current frontend has no verified methodology copy for that version, so it does not guess.</Notice>}
    <dl className="mt-7 grid gap-3 md:grid-cols-2"><Definition term="Action Score">The backend’s bounded prioritization score for potential action.</Definition><Definition term="Need Score">The weighted backend aggregate of demand, infrastructure gap, severity, equity, population, trend, and evidence confidence.</Definition><Definition term="Weight">How strongly the configured methodology values a component.</Definition><Definition term="Confidence">How reliable or complete the underlying evidence is.</Definition><Definition term="Contribution">The points supplied by a component at its scoring stage.</Definition><Definition term="Penalty">A supported value that reduces the Action Score.</Definition><Definition term="Fallback">A configured estimate used when an expected source value is unavailable.</Definition><Definition term="Evidence bundle">The versioned, privacy-safe supporting record used for audit.</Definition></dl></div>;
}

function Frame({ children }: { children: React.ReactNode }) { return <main id="main-content" className="min-h-screen overflow-x-hidden bg-[#F9F9F9] px-4 py-6 pb-[max(7rem,env(safe-area-inset-bottom))] text-[#092634] sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">{children}</div></main>; }
function HeaderBack({ hotspotId }: { hotspotId: string }) { return <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm"><Link className="font-bold text-[#004E72] hover:underline" href="/command-center#hotspots">Command Center</Link><span aria-hidden="true">/</span><Link className="font-bold text-[#004E72] hover:underline" href={`/command-center/hotspots/${encodeURIComponent(hotspotId)}`}>Hotspot detail</Link><span aria-hidden="true">/</span><span>Evidence &amp; Scoring</span></nav>; }
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div><p className="text-sm font-black uppercase tracking-[.16em] text-[#004E72]">{eyebrow}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2></div>; }
function Question({ title, children }: { title: string; children: React.ReactNode }) { return <article className="rounded-2xl border border-[#092634]/12 p-5"><h3 className="font-black">{title}</h3><p className="mt-2 text-[#52646d]">{children}</p></article>; }
function Definition({ term, children }: { term: string; children: React.ReactNode }) { return <div className="rounded-xl border border-[#092634]/10 bg-white p-3"><dt className="font-black">{term}</dt><dd className="mt-1 text-sm text-[#52646d]">{children}</dd></div>; }
function Technical({ term, value }: { term: string; value: string }) { return <div className="min-w-0 rounded-lg border border-[#092634]/8 bg-white p-3"><dt className="text-[#52646d]">{term}</dt><dd className="mt-1 break-words font-bold">{value}</dd></div>; }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="mt-6 rounded-2xl border border-dashed border-[#092634]/20 p-8 text-center"><FileSearch className="mx-auto h-7 w-7 text-[#004E72]"/><h3 className="mt-3 font-black">{title}</h3><p className="mt-2 text-sm text-[#52646d]">{detail}</p></div>; }
function Notice({ children }: { children: React.ReactNode }) { return <p role="status" className="mt-6 flex gap-2 rounded-xl border border-[#FF6E42]/35 bg-[#FF6E42]/8 p-4"><AlertTriangle className="h-5 w-5 shrink-0 text-[#b43c17]"/>{children}</p>; }
function ErrorState({ title, error, detail, retry }: { title: string; error: unknown; detail?: string; retry: () => void }) { const apiError = isApiError(error); return <section className="mt-5 rounded-3xl border border-[#FF6E42]/30 bg-white p-8"><AlertTriangle className="h-6 w-6 text-[#b43c17]"/><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-[#52646d]">{apiError ? error.message : detail ?? "The intelligence service is unavailable."}</p>{apiError && detail ? <p className="mt-2 text-sm text-[#52646d]">{detail}</p> : null}<Button className="mt-5" onClick={retry}>Retry</Button></section>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(); }
function isBundleStale(value: string) { const date = new Date(value); return Number.isFinite(date.valueOf()) && Date.now() - date.valueOf() > 30 * 24 * 60 * 60 * 1000; }
function readinessLabel(value?: "ready_for_human_review" | "review_with_caution" | "insufficient_evidence") {
  if (value === "ready_for_human_review") return "Ready for human review";
  if (value === "review_with_caution") return "Review with caution";
  if (value === "insufficient_evidence") return "Insufficient evidence";
  return "Evidence readiness not assessed";
}
function sourceClassificationLabel(classification?: string, synthetic?: boolean | number) {
  if (classification === "official_public") return "Official public data";
  if (classification === "public_nonofficial") return "Public non-official data";
  if (classification === "citizen_aggregate") return "Citizen aggregate";
  if (classification === "ai_normalized") return "AI-normalized evidence";
  if (classification === "derived") return "Derived value";
  if (classification === "estimated") return "Estimated value";
  if (classification === "synthetic_demo" || synthetic === true || synthetic === 1) return "Synthetic demonstration fixture";
  return "Unclassified source";
}
