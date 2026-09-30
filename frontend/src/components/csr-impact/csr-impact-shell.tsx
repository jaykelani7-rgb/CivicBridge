"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Plus, RefreshCcw, Search, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { policyApi, policyKeys } from "@/lib/api/policy";
import type { DevelopmentProject, PolicyDecision, Recommendation } from "@/lib/api/types";

type DecisionAction = "approve_for_assessment" | "request_evidence" | "defer" | "reject";
type MobileScreen = "queue" | "brief" | "decision" | "projects";

export function CSRImpactShell({ context }: { context?: { hotspotId: string; bundleId: string; title: string; recommendationId: string } }) {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["auth", "me"], queryFn: authApi.me });
  const recommendations = useQuery({ queryKey: policyKeys.recommendations, queryFn: policyApi.recommendations, enabled: !!profile.data && profile.data.user.role !== "csr_partner" });
  const projects = useQuery({ queryKey: policyKeys.projects, queryFn: policyApi.projects });
  const [selectedId, setSelectedId] = useState<string | null>(context?.recommendationId || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [screen, setScreen] = useState<MobileScreen>(context?.recommendationId ? "brief" : "queue");
  const isPartner = profile.data?.user.role === "csr_partner";
  const activeScreen = isPartner ? "projects" : screen;
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<DecisionAction | null>(null);
  const [decisionReceipt, setDecisionReceipt] = useState<PolicyDecision | null>(null);
  const [createOpen, setCreateOpen] = useState(Boolean(context?.hotspotId && context?.bundleId));
  const [hotspotId, setHotspotId] = useState(context?.hotspotId ?? "");
  const [bundleId, setBundleId] = useState(context?.bundleId ?? "");
  const [title, setTitle] = useState(context?.title ?? "");
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const decisionButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const returnButton = decisionButtonRef.current;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>("button,textarea,input")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setDrawerOpen(false); return; }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]),textarea:not([disabled]),input:not([disabled]),a[href]')];
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); (returnButton ?? previous)?.focus(); };
  }, [drawerOpen]);

  const visible = useMemo(() => (recommendations.data ?? []).filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || `${item.title} ${item.problem}`.toLowerCase().includes(query)) && (!status || item.status === status);
  }), [recommendations.data, search, status]);
  const selected = visible.find((item) => item.recommendation_id === selectedId) ?? visible[0] ?? null;
  const selectedIndex = selected ? visible.findIndex((item) => item.recommendation_id === selected.recommendation_id) : -1;
  const linkedProject = selected ? (projects.data ?? []).find((item) => item.recommendation_id === selected.recommendation_id) : undefined;
  const authError = [profile.error, recommendations.error, projects.error].find((error) => isApiError(error) && [401,403].includes(error.status));

  const createRecommendation = useMutation({
    mutationFn: () => policyApi.createRecommendation({ hotspot_id: hotspotId.trim(), evidence_bundle_id: bundleId.trim(), title: title.trim() || undefined }),
    onSuccess: async (item) => { toast.success("Recommendation created for human review."); setCreateOpen(false); setHotspotId(""); setBundleId(""); setTitle(""); setSelectedId(item.recommendation_id); await queryClient.invalidateQueries({ queryKey: policyKeys.recommendations }); },
    onError: (error) => toast.error(error.message),
  });
  const decide = useMutation({
    mutationFn: ({ item, action }: { item: Recommendation; action: DecisionAction }) => {
      const actor = profile.data?.user;
      if (!actor) throw new Error("Verified staff profile is unavailable.");
      const finalReason = reason.trim() || (action === "approve_for_assessment" ? "Approved after evidence review." : "");
      if (finalReason.length < 3) throw new Error("A decision reason is required.");
      return policyApi.decide(item.recommendation_id, { action, reason: finalReason, actor_id: actor.uid, actor_role: actor.role });
    },
    onSuccess: async (receipt) => { setDecisionReceipt(receipt); setConfirmAction(null); setReason(""); toast.success("Policy decision recorded by the backend."); await queryClient.invalidateQueries({ queryKey: policyKeys.recommendations }); },
    onError: (error) => toast.error(error.message),
  });
  const createProject = useMutation({
    mutationFn: (item: Recommendation) => policyApi.createProject({ recommendation_id: item.recommendation_id, title: item.title, assigned_department: item.assigned_department ?? undefined }),
    onSuccess: async () => { toast.success("Project candidate created from the approved recommendation."); setScreen("projects"); await queryClient.invalidateQueries({ queryKey: policyKeys.projects }); },
    onError: (error) => toast.error(error.message),
  });

  function select(item: Recommendation) { if (item.recommendation_id !== selected?.recommendation_id) { setDecisionReceipt(null); setReason(""); setNote(""); setDrawerOpen(false); } setSelectedId(item.recommendation_id); setScreen("brief"); if (typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.set("recommendation", item.recommendation_id); window.history.replaceState(null, "", url.pathname + url.search); } }
  function move(delta: number) { const next = visible[selectedIndex + delta]; if (next) select(next); }

  return <main id="main-content" className="staff-workspace min-h-screen overflow-x-hidden bg-background px-4 py-5 pb-[max(6rem,env(safe-area-inset-bottom))]">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      <span id="overview" className="scroll-mt-24" aria-hidden="true" />
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-accent">Policymaker workspace</p><h1 className="mt-1 font-heading text-[clamp(1.9rem,5vw,2.7rem)] font-normal leading-none">Policy &amp; impact</h1></div>
        <Button asChild size="sm" variant="outline"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Home</Link></Button>
      </header>
      {authError && isApiError(authError) ? <State icon={<ShieldAlert className="h-6 w-6" />} title="Staff access unavailable" message={authError.message} retry={() => { void profile.refetch(); void recommendations.refetch(); void projects.refetch(); }} /> : <>
        <span id="policy" className="scroll-mt-24" aria-hidden="true" />
        <nav aria-label="Policy sections" className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1 lg:hidden">
          {(isPartner ? ["projects"] : ["queue", "brief", "projects"] as MobileScreen[]).map((value) => <button key={value} onClick={() => setScreen(value as MobileScreen)} aria-current={activeScreen === value ? "page" : undefined} className={`min-h-11 rounded-lg px-2 text-sm font-semibold capitalize ${activeScreen === value ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{value}</button>)}
        </nav>
        {!isPartner && <>
        <section aria-label="Recommendation controls" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search recommendations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recommendations" className="pl-10" /></div>
          <select aria-label="Recommendation status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-12 max-w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">All statuses</option><option value="under_review">Under review</option><option value="approved_for_assessment">Approved for assessment</option><option value="evidence_requested">Evidence requested</option><option value="deferred">Deferred</option><option value="rejected">Rejected</option></select>
          <Button size="sm" variant="outline" onClick={() => void recommendations.refetch()} aria-label="Refresh recommendations"><RefreshCcw className={`h-4 w-4 ${recommendations.isFetching ? "animate-spin" : ""}`} /></Button>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen((value) => !value)}><Plus className="mr-2 h-4 w-4" />From hotspot</Button>
          <span className="text-sm text-muted-foreground">{visible.length} in view</span>
          {search || status ? <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setStatus(""); }}>Clear filters</Button> : null}
          {createOpen ? <div className="w-full"><RecommendationDraftForm hotspotId={hotspotId} setHotspotId={setHotspotId} bundleId={bundleId} setBundleId={setBundleId} title={title} setTitle={setTitle} pending={createRecommendation.isPending} submit={() => createRecommendation.mutate()} cancel={() => setCreateOpen(false)} /></div> : null}
        </section>
        {profile.isPending || recommendations.isLoading ? <Loading /> : recommendations.isError ? <State icon={<AlertTriangle className="h-6 w-6" />} title="Recommendations unavailable" message={recommendations.error.message} retry={() => void recommendations.refetch()} /> : !visible.length ? <State icon={<CheckCircle2 className="h-6 w-6" />} title="No recommendations in this view" message="Create one from an evidence bundle or clear the active filters." /> : <div className={`grid min-w-0 gap-5 ${queueCollapsed ? "lg:grid-cols-[3rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]"}`}>
          <aside className={activeScreen === "queue" ? "block" : "hidden lg:block"}>
            <Button size="sm" variant="ghost" className="mb-2 hidden lg:inline-flex" onClick={() => setQueueCollapsed((value) => !value)} aria-expanded={!queueCollapsed} aria-controls="recommendation-queue">{queueCollapsed ? "Show queue" : "Hide queue"}</Button>
            {!queueCollapsed && <div id="recommendation-queue"><Queue items={visible} selectedId={selected?.recommendation_id ?? null} select={select} /></div>}
          </aside>
          {selected ? <div className={activeScreen === "brief" ? "min-w-0" : "hidden min-w-0 lg:block"}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><Button size="sm" variant="ghost" disabled={selectedIndex <= 0} onClick={() => move(-1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button size="sm" variant="ghost" disabled={selectedIndex >= visible.length - 1} onClick={() => move(1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div><Button ref={decisionButtonRef} onClick={() => setDrawerOpen(true)}><ClipboardCheck className="mr-2 h-4 w-4" />Record decision</Button></div>
            <Brief item={selected} />
            {decisionReceipt ? <div role="status" className="mt-4 rounded-lg bg-success/10 p-4"><strong>Decision recorded: </strong>{decisionReceipt.action.replaceAll("_", " ")} · {new Date(decisionReceipt.decided_at).toLocaleString()}</div> : null}
            {selected.human_approved && <div className="mt-5 border-t border-border pt-4"><h3 className="font-semibold">Project candidate</h3>{linkedProject ? <p>{linkedProject.title}</p> : <Button className="mt-2" disabled={createProject.isPending} onClick={() => createProject.mutate(selected)}>{createProject.isPending ? "Creating…" : "Create project candidate"}</Button>}</div>}
          </div> : null}
        </div>}
        </>}
        <span id="projects" className="scroll-mt-24" aria-hidden="true" /><span id="impact" className="scroll-mt-24" aria-hidden="true" />
        <section className={activeScreen === "projects" ? "block" : "hidden lg:block"}><div className="border-t border-border pt-6"><h2 className="font-heading text-3xl">Projects and measurements</h2><p className="mt-1 text-sm text-muted-foreground">Approval starts assessment. Recorded measurements do not by themselves prove the project caused a change.</p>{projects.isLoading ? <Loading /> : projects.isError ? <State icon={<AlertTriangle className="h-5 w-5" />} title="Projects unavailable" message={projects.error.message} retry={() => void projects.refetch()} /> : projects.data?.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.data.map((project) => <ProjectCard key={project.project_id} project={project} canEdit={!isPartner} />)}</div> : <p className="mt-4 text-muted-foreground">No project candidates are recorded.</p>}</div></section>
      </>}
    </div>
    {drawerOpen && selected ? <div className="fixed inset-0 z-[70] flex justify-end bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}><section ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="decision-drawer-title" className="h-full w-full max-w-lg overflow-y-auto bg-card p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between gap-3"><h2 id="decision-drawer-title" className="font-heading text-3xl">Record decision</h2><Button variant="ghost" size="icon" aria-label="Close decision drawer" onClick={() => setDrawerOpen(false)}><X className="h-5 w-5" /></Button></div><p className="mt-2 text-sm text-muted-foreground">{selected.title}</p><DecisionRail item={selected} note={note} setNote={setNote} reason={reason} setReason={setReason} pending={decide.isPending} receipt={decisionReceipt} confirm={setConfirmAction} createProject={() => createProject.mutate(selected)} project={linkedProject} projectPending={createProject.isPending} /></section></div> : null}
    {confirmAction && selected ? <ConfirmDecision action={confirmAction} item={selected} reason={reason} setReason={setReason} pending={decide.isPending} close={() => setConfirmAction(null)} submit={() => decide.mutate({ item: selected, action: confirmAction })} /> : null}
  </main>;
}

export function Queue({ items, selectedId, select, className }: { items: Recommendation[]; selectedId: string | null; select: (item: Recommendation) => void; className?: string }) {
  return <div className={className}><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recommendation queue</h2><div className="max-h-[70vh] space-y-1 overflow-y-auto" aria-label="Recommendations">{items.map((item) => <button key={item.recommendation_id} onClick={() => select(item)} aria-current={selectedId === item.recommendation_id ? "true" : undefined} className={`w-full rounded-lg border-l-4 px-3 py-3 text-left transition-colors ${selectedId === item.recommendation_id ? "border-accent bg-accent/10" : "border-transparent hover:bg-muted/50"}`}><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.status.replaceAll("_", " ")}</span><span className="mt-1 block font-semibold leading-snug">{item.title}</span><span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">{item.problem}</span><span className="mt-1 block text-xs text-muted-foreground">Updated {new Date(item.updated_at).toLocaleDateString()}</span></button>)}</div></div>;
}

export function Brief({ item, className }: { item: Recommendation; className?: string }) {
  return <article className={`min-w-0 rounded-xl bg-card px-5 py-6 sm:px-8 ${className ?? ""}`}>
    <div className="flex flex-wrap gap-2"><Badge variant="accent">{item.status.replaceAll("_", " ")}</Badge><Badge variant={item.ai_draft ? "info" : "secondary"}>{item.ai_draft ? `${item.processing_mode ?? "Unknown"} draft · human review required` : "Human draft"}</Badge></div>
    <h2 className="mt-4 max-w-4xl font-heading text-[clamp(1.8rem,4vw,2.7rem)] leading-tight">{item.title}</h2>
    <div className="mt-6 max-w-4xl space-y-7 text-base leading-[1.7]">
      <section><h3 className="text-lg font-semibold">The problem</h3><p className="mt-2">{item.problem}</p></section>
      <section><h3 className="text-lg font-semibold">Proposed response</h3><p className="mt-2">{item.proposed_intervention}</p></section>
      <section><h3 className="text-lg font-semibold">People who may benefit</h3><p className="mt-2">{item.intended_beneficiaries == null ? "Needs assessment" : item.intended_beneficiaries.toLocaleString()}</p></section>
      <section className="border-t border-border pt-5"><h3 className="text-lg font-semibold">Evidence</h3>{item.evidence_sources?.length ? <div className="mt-3 space-y-4">{item.evidence_sources.map((source) => <div key={source.source_id} className="border-b border-border pb-4"><p className="font-semibold">{source.title || "Source title unavailable"}</p><p className="text-sm text-muted-foreground">{source.publisher || "Publisher unknown"} · {source.reference_period || source.retrieved_at || "Date unknown"} · {source.provenance || "Provenance unknown"}</p><p className="mt-2">{source.finding || "Relevant finding not supplied. Review the source before deciding."}</p>{source.url ? <a className="mt-2 inline-block text-accent underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">View source</a> : null}</div>)}</div> : <p className="mt-2 text-muted-foreground">Source details are unavailable. Review the evidence bundle before deciding.</p>}
        <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer">Technical references</summary><p className="mt-2 break-all">Recommendation {item.recommendation_id} · Bundle {item.evidence_bundle_id}</p><ul className="mt-1 list-disc pl-5">{item.supporting_evidence_ids.map((id) => <li key={id} className="break-all">{id}</li>)}</ul>{item.quantitative_claims?.length ? <div className="mt-3"><p className="font-semibold">Quantitative claim sources</p><ul className="mt-1 list-disc pl-5">{item.quantitative_claims.map((claim, index) => <li key={`${claim.claim_field}-${index}`} className="break-all">{claim.claim_field}: {claim.value} · {claim.source_field} · {claim.calculation}</li>)}</ul></div> : null}</details></section>
      <section className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2"><ListBlock title="Risks" items={item.risks} /><ListBlock title="Information to gather" items={item.missing_information} /></section>
      <section className="border-t border-border pt-5 text-sm text-muted-foreground"><p>Draft confidence: {item.confidence == null ? "Needs assessment" : `${Math.round(item.confidence * 100)}%`}</p><p>Draft source: {item.draft_provider || (item.ai_draft ? "Unspecified" : "Human")} {item.draft_model ? `· ${item.draft_model}` : ""}</p><p>These are proposed actions; approval and impact are recorded separately.</p></section>
    </div>
  </article>;
}

export function DecisionRail({ item, note, setNote, reason, setReason, pending, receipt, confirm, createProject, project, projectPending, className }: { item: Recommendation; note: string; setNote: (value:string)=>void; reason:string; setReason:(value:string)=>void; pending:boolean; receipt:PolicyDecision|null; confirm:(action:DecisionAction)=>void; createProject:()=>void; project?:DevelopmentProject; projectPending:boolean; className?:string }) {
  return <div className={`mt-6 space-y-5 ${className ?? ""}`}><Field label="Private working note (this browser tab only)"><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Draft your review note" /></Field><Field label="Decision reason"><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are you making this decision?" /></Field><p className="text-sm text-muted-foreground">A decision is saved only after you confirm it.</p><div className="grid gap-2"><Button variant="outline" disabled={pending} onClick={() => confirm("request_evidence")}>Request more evidence</Button><Button variant="outline" disabled={pending} onClick={() => confirm("defer")}>Defer</Button><Button variant="outline" disabled={pending} onClick={() => confirm("reject")}>Reject</Button><Button disabled={pending || item.human_approved} onClick={() => confirm("approve_for_assessment")}>{item.human_approved ? "Approval recorded" : "Approve for assessment"}</Button></div>{receipt ? <p role="status" className="rounded-lg bg-success/10 p-3">Decision recorded: {receipt.action.replaceAll("_", " ")}</p> : null}{item.human_approved && <div className="border-t border-border pt-4">{project ? <p>Project candidate: {project.title}</p> : <Button disabled={projectPending} onClick={createProject}>Create project candidate</Button>}</div>}</div>;
}
function ConfirmDecision({ action, item, reason, setReason, pending, close, submit }: { action:DecisionAction; item:Recommendation; reason:string; setReason:(value:string)=>void; pending:boolean; close:()=>void; submit:()=>void }) { const requiresReason = action !== "approve_for_assessment"; return <div className="fixed inset-0 z-[80] flex items-end bg-black/50 sm:items-center sm:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) close(); }}><section role="alertdialog" aria-modal="true" aria-labelledby="decision-dialog-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"><div className="flex items-center justify-between"><h2 id="decision-dialog-title" className="text-2xl font-normal">Confirm policy decision</h2><Button size="icon" variant="ghost" disabled={pending} onClick={close} aria-label="Close decision confirmation"><X className="h-5 w-5"/></Button></div><p className="mt-3 text-sm text-muted-foreground">You are about to record <strong className="capitalize">{action.replaceAll("_", " ")}</strong> for “{item.title}”. This is an auditable backend mutation.</p><Field label={requiresReason ? "Reason (required)" : "Approval note (optional)"}><Textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)}/></Field><div className="mt-5 flex gap-2"><Button variant="ghost" disabled={pending} onClick={close}>Cancel</Button><Button className="flex-1" disabled={pending || (requiresReason && reason.trim().length < 3)} onClick={submit}>{pending ? "Recording…" : "Record decision"}</Button></div></section></div>; }
function ProjectCard({ project, canEdit }: { project: DevelopmentProject; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const metrics = useQuery({ queryKey: policyKeys.metrics(project.project_id), queryFn: () => policyApi.metrics(project.project_id) });
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("");
  const [baseline, setBaseline] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"higher_is_better" | "lower_is_better">("lower_is_better");
  const [nextStatus, setNextStatus] = useState<Parameters<typeof policyApi.updateProjectStatus>[1]>(project.status as Parameters<typeof policyApi.updateProjectStatus>[1]);
  const updateStatus = useMutation({ mutationFn: () => policyApi.updateProjectStatus(project.project_id, nextStatus), onSuccess: async () => { toast.success("Project status updated."); await queryClient.invalidateQueries({ queryKey: policyKeys.projects }); }, onError: (error) => toast.error(error.message) });
  const add = useMutation({ mutationFn: () => policyApi.addMetric(project.project_id, { metric_code: code.trim(), unit: unit.trim(), source_id: source.trim(), baseline: baseline === "" ? null : Number(baseline), current: current === "" ? null : Number(current), target: target === "" ? null : Number(target), direction, source_type: "manual", measured_at: new Date().toISOString() }), onSuccess: async () => { setOpen(false); toast.success("Measurement recorded."); await queryClient.invalidateQueries({ queryKey: policyKeys.metrics(project.project_id) }); }, onError: (error) => toast.error(error.message) });
  return <div><ProjectImpactCard project={project} metrics={metrics.data} loading={metrics.isLoading} error={metrics.isError} />{canEdit && <div className="mt-3 flex flex-wrap items-end gap-2"><Field label="Project status"><select className="h-11 rounded-lg border border-border bg-background px-3" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)}>{["candidate", "in_feasibility", "approved_for_construction", "in_progress", "completed", "cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field><Button variant="outline" disabled={updateStatus.isPending || nextStatus === project.status} onClick={() => updateStatus.mutate()}>Update status</Button><Button variant="outline" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Close measurement form" : "Record measurement"}</Button></div>}{canEdit && open && <form className="mt-3 grid gap-3 rounded-xl bg-card p-4" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}><p className="text-sm text-muted-foreground">Manual entry. A measured change does not establish causation.</p><Field label="Metric name"><Input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. flooding reports per month" /></Field><Field label="Unit"><Input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="reports/month" /></Field><Field label="Direction"><select className="h-11 rounded-lg border border-border bg-background px-3" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="lower_is_better">Lower is better</option><option value="higher_is_better">Higher is better</option></select></Field><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Field label="Baseline"><Input type="number" step="any" value={baseline} onChange={(event) => setBaseline(event.target.value)} /></Field><Field label="Current"><Input type="number" step="any" value={current} onChange={(event) => setCurrent(event.target.value)} /></Field><Field label="Target"><Input type="number" step="any" value={target} onChange={(event) => setTarget(event.target.value)} /></Field></div><Field label="Measurement source"><Input required value={source} onChange={(event) => setSource(event.target.value)} placeholder="Record or source identifier" /></Field><Button type="submit" disabled={add.isPending}>{add.isPending ? "Recording…" : "Save measurement"}</Button></form>}</div>;
}
export function ProjectImpactCard({project,metrics,loading=false,error=false}: {project:DevelopmentProject;metrics?:Awaited<ReturnType<typeof policyApi.metrics>>;loading?:boolean;error?:boolean}) {
  const value = (number: number | null | undefined) => number == null ? "Not measured" : number.toLocaleString();
  return <article className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{project.status.replaceAll("_", " ")}</Badge><span className="text-xs text-muted-foreground">{project.country_code} · {project.sector}</span></div><h3 className="mt-3 text-xl font-semibold">{project.title}</h3><p className="mt-4 font-semibold">Measurements</p>{loading ? <Skeleton className="mt-2 h-20" /> : error ? <p className="mt-2 text-sm text-destructive">Measurements could not be loaded.</p> : metrics?.length ? <div className="mt-2 space-y-3">{metrics.map((metric) => <div key={metric.metric_id} className="border-t border-border pt-3 text-sm"><p className="font-semibold capitalize">{metric.metric_code.replaceAll("_", " ")} · {metric.outcome_status.replaceAll("_", " ")}</p><p>Baseline {value(metric.baseline)} · Current {value(metric.current)} · Target {value(metric.target)} {metric.unit}</p><p className="text-muted-foreground">{metric.direction === "higher_is_better" ? "Higher is better" : "Lower is better"} · {metric.source_type === "manual" ? "Manually entered" : "Independently verified"} · {new Date(metric.measured_at).toLocaleDateString()}</p><p className="break-all text-xs text-muted-foreground">Source: {metric.source_id}{metric.methodology ? ` · ${metric.methodology}` : ""}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Measurement pending; no outcome is claimed.</p>}</article>;
}
function ListBlock({ title, items }: { title:string; items:string[] }) { return <div><p className="font-semibold">{title}</p>{items.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">None supplied by the backend.</p>}</div>; }
function Field({ label, children }: { label:string; children:React.ReactNode }) { return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>; }
export function Loading() { return <div className="grid gap-4 md:grid-cols-3">{[0,1,2].map((item) => <Skeleton key={item} className="h-64 rounded-2xl"/>)}</div>; }
export function State({ icon, title, message, retry }: { icon:React.ReactNode; title:string; message:string; retry?:()=>void }) { return <Card><CardContent className="p-8 text-center"><div className="mx-auto w-fit text-warning">{icon}</div><h2 className="mt-3 text-2xl font-bold">{title}</h2><p className="mt-2 text-muted-foreground">{message}</p>{retry ? <Button className="mt-4" onClick={retry}>Retry</Button> : null}</CardContent></Card>; }

export function RecommendationDraftForm({hotspotId,setHotspotId,bundleId,setBundleId,title,setTitle,pending,submit,cancel}: {hotspotId:string;setHotspotId:(value:string)=>void;bundleId:string;setBundleId:(value:string)=>void;title:string;setTitle:(value:string)=>void;pending:boolean;submit:()=>void;cancel:()=>void}) { return <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl bg-muted/40 p-4 md:grid-cols-3"><p className="text-sm text-muted-foreground md:col-span-3">Check the selected hotspot and evidence before creating a proposal. Nothing is submitted until you confirm.</p><Field label="Hotspot ID"><Input value={hotspotId} onChange={(event) => setHotspotId(event.target.value)}/></Field><Field label="Evidence bundle ID"><Input value={bundleId} onChange={(event) => setBundleId(event.target.value)}/></Field><Field label="Optional title"><Input value={title} onChange={(event) => setTitle(event.target.value)}/></Field><div className="flex gap-2 md:col-span-3"><Button disabled={!hotspotId.trim() || !bundleId.trim() || pending} onClick={submit}>{pending ? "Creating…" : "Create under-review recommendation"}</Button><Button variant="ghost" onClick={cancel}>Cancel</Button></div></div>; }
