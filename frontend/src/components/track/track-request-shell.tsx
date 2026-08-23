"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCcw, Route } from "lucide-react";
import { useState } from "react";
import { citizenApi } from "@/lib/api/citizen";
import { isApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const trackingKey = "civicbridge:request-id";
function savedTrackingId() { return typeof window === "undefined" ? "" : window.localStorage.getItem(trackingKey) ?? ""; }

export function TrackRequestShell() {
  const [draft, setDraft] = useState(savedTrackingId);
  const [requestId, setRequestId] = useState(savedTrackingId);
  const status = useQuery({ queryKey: ["citizen", "status", requestId], queryFn: ({ signal }) => citizenApi.status(requestId, signal), enabled: Boolean(requestId), retry: false });
  function submit(event: React.FormEvent) { event.preventDefault(); const value = draft.trim(); if (!value) return; window.localStorage.setItem(trackingKey, value); setRequestId(value); }
  const item = status.data;
  return <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex items-center gap-3 text-[#004E72]"><Route className="h-6 w-6"/><p className="text-sm font-black uppercase tracking-[0.16em]">Citizen request tracking</p></div>
    <h1 className="mt-4 font-heading text-[clamp(2.25rem,9vw,4rem)] font-black leading-none text-[#092634]">Track a submitted report</h1>
    <p className="mt-4 text-muted-foreground">Enter the request ID from your receipt. Only the ID is retained in this browser.</p>
    <Card className="mt-7"><CardHeader><CardTitle>Request ID</CardTitle><CardDescription>Request status is read from the existing secure citizen status endpoint.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="tracking-request-id">Request ID</label><Input id="tracking-request-id" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" className="min-w-0 flex-1"/><Button type="submit">Track request</Button></form></CardContent></Card>
    {status.isFetching ? <p role="status" className="mt-5 rounded-2xl border border-border bg-card p-5">Checking the latest status…</p> : status.isError ? <Card className="mt-5"><CardContent className="p-5"><p role="alert" className="font-bold">Status could not be loaded</p><p className="mt-2 text-sm text-muted-foreground">{isApiError(status.error) ? status.error.message : "Check the request ID and try again."}</p><Button className="mt-4" variant="outline" onClick={() => void status.refetch()}><RefreshCcw className="mr-2 h-4 w-4"/>Try again</Button></CardContent></Card> : item ? <Card className="mt-5"><CardHeader><div className="flex flex-wrap items-center gap-2"><Badge variant="info">{item.processing_stage.replaceAll("_", " ")}</Badge>{item.pii_masked ? <Badge variant="success">Privacy protected</Badge> : null}</div><CardTitle className="mt-3 flex items-center gap-2"><ClipboardCheck className="h-5 w-5"/>Request received</CardTitle><CardDescription className="break-all">{item.request_id}</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><StatusField label="Category" value={item.category ?? "Not supplied yet"}/><StatusField label="Public summary" value={item.public_summary ?? "Normalization is still processing"}/><StatusField label="Hotspot score" value={item.hotspot_score == null ? "Not supplied yet" : item.hotspot_score.toFixed(1)}/><StatusField label="Project" value={item.project_title ?? "No public project linked"}/></CardContent></Card> : null}
  </main>;
}

function StatusField({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-muted/30 p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p></div>; }
