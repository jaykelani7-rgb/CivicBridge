"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, FolderKanban, Plus, RefreshCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { policyApi, policyKeys } from "@/lib/api/policy";
import type { DevelopmentProject, Recommendation } from "@/lib/api/types";

export function CSRImpactShell() {
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [hotspotId, setHotspotId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [title, setTitle] = useState("");
  const [decisionReason, setDecisionReason] = useState("Evidence reviewed for feasibility assessment.");
  const recommendations = useQuery({ queryKey: policyKeys.recommendations, queryFn: policyApi.recommendations });
  const projects = useQuery({ queryKey: policyKeys.projects, queryFn: policyApi.projects });
  const authError = [recommendations.error, projects.error].find((error) => isApiError(error) && (error.status === 401 || error.status === 403 || error.code === "AUTH_NOT_CONFIGURED"));

  const createRecommendation = useMutation({
    mutationFn: () => policyApi.createRecommendation({ hotspot_id: hotspotId.trim(), evidence_bundle_id: bundleId.trim(), title: title.trim() || undefined }),
    onSuccess: async () => { toast.success("Recommendation created from the evidence bundle."); setHotspotId(""); setBundleId(""); setTitle(""); await queryClient.invalidateQueries({ queryKey: policyKeys.recommendations }); },
    onError: (error) => toast.error(error.message),
  });
  const decide = useMutation({
    mutationFn: ({ recommendationId }: { recommendationId: string }) => policyApi.decide(recommendationId, { action: "approve_for_assessment", reason: decisionReason, actor_id: "current-staff-user", actor_role: "policymaker" }),
    onSuccess: async () => { toast.success("Policy decision recorded. No financial transaction occurred."); await queryClient.invalidateQueries({ queryKey: policyKeys.recommendations }); },
    onError: (error) => toast.error(error.message),
  });
  const createProject = useMutation({
    mutationFn: (recommendation: Recommendation) => policyApi.createProject({ recommendation_id: recommendation.recommendation_id, title: recommendation.title }),
    onSuccess: async () => { toast.success("Development project candidate created."); await queryClient.invalidateQueries({ queryKey: policyKeys.projects }); },
    onError: (error) => toast.error(error.message),
  });

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f6f4ef_0%,#eff2e7_40%,#f4eee3_100%)] px-4 py-5">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <motion.header initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-border bg-card/95 p-6 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="accent">Policymaker workspace</Badge><h1 className="mt-4 font-heading text-4xl font-black">Policy &amp; Impact</h1><p className="mt-3 max-w-3xl text-muted-foreground">Create evidence-backed recommendations, record human decisions, create development projects, and inspect real impact metrics.</p></div><Button asChild variant="outline"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Home</Link></Button></div></motion.header>

      {authError && isApiError(authError) ? <State icon={<ShieldAlert className="h-6 w-6"/>} title="Staff access unavailable" message={authError.message} retry={() => { void recommendations.refetch(); void projects.refetch(); }}/> : <>
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card><CardHeader><Badge variant="secondary" className="w-fit">New recommendation</Badge><CardTitle>Create from bounded evidence</CardTitle><CardDescription>Use the exact hotspot and evidence bundle IDs from Data Intelligence. The Policy service validates citations.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="hotspot-id">Hotspot ID</Label><Input id="hotspot-id" value={hotspotId} onChange={(e) => setHotspotId(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="bundle-id">Evidence Bundle ID</Label><Input id="bundle-id" value={bundleId} onChange={(e) => setBundleId(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="rec-title">Optional title</Label><Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div><Button disabled={!hotspotId.trim() || !bundleId.trim() || createRecommendation.isPending} onClick={() => createRecommendation.mutate()}><Plus className="mr-2 h-4 w-4"/>{createRecommendation.isPending ? "Creating…" : "Create recommendation"}</Button></CardContent></Card>
          <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><Badge variant="info">Human governance</Badge><CardTitle className="mt-3">Recommendations</CardTitle></div><Button variant="ghost" onClick={() => void recommendations.refetch()}><RefreshCcw className={`mr-2 h-4 w-4 ${recommendations.isFetching ? "animate-spin" : ""}`}/>Refresh</Button></div></CardHeader><CardContent className="space-y-4">{recommendations.isLoading ? <Loading/> : recommendations.isError ? <InlineError error={recommendations.error} retry={() => void recommendations.refetch()}/> : recommendations.data?.length ? <><div className="space-y-2"><Label htmlFor="decision-reason">Decision justification</Label><Textarea id="decision-reason" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} /></div>{recommendations.data.map((item) => <RecommendationCard key={item.recommendation_id} item={item} deciding={decide.isPending} creating={createProject.isPending} decide={() => decide.mutate({ recommendationId: item.recommendation_id })} createProject={() => createProject.mutate(item)}/>)}</> : <Empty title="No recommendations" message="Create one from a real hotspot evidence bundle. No sample recommendations are substituted."/>}</CardContent></Card>
        </div>

        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><Badge variant="success">Development projects</Badge><CardTitle className="mt-3">Project impact records</CardTitle><CardDescription>Metrics are loaded exactly as recorded by the Policy + Impact service.</CardDescription></div><Button variant="outline" disabled title="PDF export requires a complete real-data report contract.">Export unavailable</Button></div></CardHeader><CardContent>{projects.isLoading ? <Loading/> : projects.isError ? <InlineError error={projects.error} retry={() => void projects.refetch()}/> : projects.data?.length ? <div className="grid gap-4 md:grid-cols-2">{projects.data.map((project) => <ProjectCard key={project.project_id} project={project}/>)}</div> : <Empty title="No development projects" message="Approve a recommendation for assessment, then create a project candidate. CivicBridge does not allocate funds."/>}</CardContent></Card>
      </>}

      <Card className="border-warning/30 bg-warning/5"><CardContent className="flex items-start gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 text-warning"/><div><p className="font-semibold">Governance actions, not payments</p><p className="text-sm text-muted-foreground">This workspace records recommendations, policy decisions, projects, and measurements. It does not process or imply financial transactions, funding totals, verification receipts, or fabricated cost estimates.</p></div></CardContent></Card>
    </div>
  </main>;
}

function RecommendationCard({ item, decide, createProject, deciding, creating }: { item: Recommendation; decide: () => void; createProject: () => void; deciding: boolean; creating: boolean }) { return <article className="rounded-2xl border border-border bg-background p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="accent">{item.status.replaceAll("_", " ")}</Badge>{item.ai_draft ? <Badge variant="info">AI draft</Badge> : <Badge variant="secondary">Human draft</Badge>}</div><h3 className="mt-3 text-xl font-bold">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.problem}</p><div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm"><p className="font-semibold">Proposed intervention</p><p className="mt-1 text-muted-foreground">{item.proposed_intervention}</p></div><p className="mt-3 text-xs text-muted-foreground">Confidence {(item.confidence * 100).toFixed(0)}% · {item.supporting_evidence_ids.length} cited evidence IDs</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" disabled={deciding || item.human_approved} onClick={decide}><ClipboardCheck className="mr-2 h-4 w-4"/>{item.human_approved ? "Decision approved" : "Approve for assessment"}</Button><Button size="sm" variant="outline" disabled={creating || !item.human_approved} onClick={createProject}><FolderKanban className="mr-2 h-4 w-4"/>Create development project</Button></div></article>; }

function ProjectCard({ project }: { project: DevelopmentProject }) { const metrics = useQuery({ queryKey: policyKeys.metrics(project.project_id), queryFn: () => policyApi.metrics(project.project_id) }); return <article className="rounded-2xl border border-border bg-background p-5"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="secondary">{project.status.replaceAll("_", " ")}</Badge><span className="text-xs text-muted-foreground">{project.country_code} · {project.sector}</span></div><h3 className="mt-3 text-xl font-bold">{project.title}</h3><p className="mt-1 text-xs text-muted-foreground">Project {project.project_id.slice(0, 8)} · Recommendation {project.recommendation_id.slice(0, 8)}</p><div className="mt-4"><p className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-accent"/>Impact metrics</p>{metrics.isLoading ? <Skeleton className="mt-2 h-20"/> : metrics.isError ? <InlineError error={metrics.error} retry={() => void metrics.refetch()}/> : metrics.data?.length ? <div className="mt-2 space-y-2">{metrics.data.map((metric) => <div key={metric.metric_id} className="rounded-xl bg-muted/40 p-3"><div className="flex justify-between gap-2 text-sm font-semibold"><span>{metric.metric_code.replaceAll("_", " ")}</span><span>{metric.current} {metric.unit}</span></div><p className="mt-1 text-xs text-muted-foreground">Baseline {metric.baseline} · Target {metric.target} · Confidence {(metric.confidence * 100).toFixed(0)}% · Source {metric.source_id}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No impact measurements recorded.</p>}</div></article>; }

function Loading() { return <div className="space-y-3"><Skeleton className="h-28"/><Skeleton className="h-28"/></div>; }
function Empty({ title, message }: { title: string; message: string }) { return <div className="rounded-2xl border border-dashed border-border p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>; }
function InlineError({ error, retry }: { error: Error; retry: () => void }) { return <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4"><p className="font-semibold">Request failed</p><p className="text-sm text-muted-foreground">{isApiError(error) ? error.message : "The service could not be reached."}</p><Button size="sm" variant="outline" className="mt-2" onClick={retry}>Retry</Button></div>; }
function State({ icon, title, message, retry }: { icon: React.ReactNode; title: string; message: string; retry: () => void }) { return <Card><CardContent className="p-8"><div className="text-warning">{icon}</div><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-2 text-muted-foreground">{message}</p><Button className="mt-4" onClick={retry}>Retry</Button></CardContent></Card>; }
