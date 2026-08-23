"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calculator, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EvidenceBundleDto } from "@/lib/api/types";
import { intelligenceApi, intelligenceKeys } from "@/lib/api/intelligence";
import { confidenceLabel, groundedSummary, strongestInfluences, componentCopy } from "@/lib/evidence/scoring-presentation";

export function QuickScoreExplanation({ hotspotId, actionScore, bundle, disabled = false }: { hotspotId: string; actionScore: number; bundle?: EvidenceBundleDto; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestedEvidence = useQuery({ queryKey: intelligenceKeys.evidence(hotspotId), queryFn: () => intelligenceApi.evidence(hotspotId), enabled: open && !bundle, retry: 1 });
  const resolvedBundle = bundle ?? requestedEvidence.data;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => { setOpen(false); triggerRef.current?.focus(); };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[#004E72] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-[#65737a]" aria-label={`How is the Action Score of ${actionScore.toFixed(1)} calculated?`}>
      <Calculator aria-hidden="true" className="h-4 w-4"/>How is this score calculated?
    </button>
    <dialog ref={dialogRef} aria-labelledby={`quick-score-title-${hotspotId}`} onCancel={(event) => { event.preventDefault(); setOpen(false); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl border border-[#092634]/15 bg-[#F9F9F9] p-0 text-[#092634] shadow-2xl backdrop:bg-[#092634]/45 md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[min(32rem,100vw)] md:rounded-none">
      <div className="flex min-h-full flex-col p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[.16em] text-[#004E72]">Quick explanation</p><h2 id={`quick-score-title-${hotspotId}`} className="mt-2 text-2xl font-black">Action Score {actionScore.toFixed(1)}</h2></div><Button variant="outline" size="icon" className="min-h-11 min-w-11" onClick={() => setOpen(false)} aria-label="Close score explanation"><X aria-hidden="true" className="h-5 w-5"/></Button></div>
        {requestedEvidence.isLoading && !resolvedBundle ? <p className="mt-6" role="status">Loading the supporting evidence…</p> : resolvedBundle ? <div className="mt-6 space-y-5"><p className="leading-relaxed">{groundedSummary(resolvedBundle)}</p><div><h3 className="font-bold">Strongest supplied influences</h3><ol className="mt-3 space-y-2">{strongestInfluences(resolvedBundle).map((component) => <li key={component.name} className="rounded-xl border border-[#092634]/12 bg-white p-3"><span className="font-bold">{componentCopy(component.name).label}</span><span className="ml-2 text-sm text-[#52646d]">{component.weighted_contribution.toFixed(2)} component points</span></li>)}</ol></div><p className="rounded-xl bg-[#004E72]/8 p-4 text-sm"><strong>{confidenceLabel(resolvedBundle.hotspot_snapshot.evidence_confidence)}.</strong> Weight, confidence, and contribution describe different parts of the calculation.</p></div> : <p className="mt-6 rounded-xl border border-[#FF6E42]/30 bg-[#FF6E42]/8 p-4">The supporting evidence could not be loaded. The backend score remains authoritative.</p>}
        <Button asChild className="mt-7 bg-[#004E72] text-white hover:bg-[#003d59]"><Link href={`/command-center/hotspots/${encodeURIComponent(hotspotId)}/evidence?tab=overview`}>Open Evidence &amp; Scoring workspace</Link></Button>
      </div>
    </dialog>
  </>;
}
