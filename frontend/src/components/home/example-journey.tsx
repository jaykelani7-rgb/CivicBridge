"use client";

import { useState } from "react";
import { MapPin, MessageSquare, ScanLine, FileCheck2 } from "lucide-react";
import { usePublicLocale } from "@/components/providers/public-locale-provider";

// Deliberately independent of queries and operational records. No scores or totals.
const steps = [
  { label: "journeyReport", title: "reportTitle", body: "reportQuote", icon: MessageSquare },
  { label: "journeyConnect", title: "connectTitle", body: "connectBody", icon: MapPin },
  { label: "journeyUnderstand", title: "understandTitle", body: "understandBody", icon: ScanLine },
  { label: "journeyReview", title: "reviewTitle", body: "reviewBody", icon: FileCheck2 },
] as const;

export function ExampleJourney() {
  const { t } = usePublicLocale();
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  const Icon = step.icon;
  return <section id="example-journey" className="example-journey" aria-labelledby="journey-title">
    <div className="journey-top"><span className="eyebrow">{t("exampleJourney")}</span><span className="journey-count" aria-hidden="true">0{selected+1} / 04</span></div>
    <h2 id="journey-title">{t("journeyTitle")}</h2>
    <div className="locality-drawing" aria-hidden="true"><svg viewBox="0 0 460 160" fill="none"><path d="M-20 112 480 20M-20 142 480 50M85-20 131 180M243-20 289 180M363-20 409 180" stroke="currentColor" strokeWidth="1"/><path d="m27 29 44-8 12 49-44 8zm120-20 65-12 12 49-65 12zm19 108 64-12 12 50-64 12zm135-108 33-6 10 46-33 6zm16 102 33-6 10 46-33 6z" fill="currentColor" opacity=".13"/><path d="m282 85 80-15" stroke="var(--terracotta)" strokeWidth="5" strokeLinecap="round"/><circle cx="244" cy="92" r="18" fill="var(--primary)"/><circle cx="244" cy="92" r="5" fill="var(--primary-foreground)"/><circle cx="244" cy="92" r="27" stroke="var(--primary)" strokeDasharray="3 5"/><path d="m171 49 15-16 22 9 6 27-36 7z" fill="var(--card)" stroke="var(--primary)" strokeWidth="1.5"/><path d="m189 74-2-12 10-2 2 12" stroke="var(--primary)"/></svg><span>{t("examplePlace")}</span></div>
    <div className="journey-content" id="journey-content" aria-live="polite" aria-atomic="true"><div className="journey-icon"><Icon size={19}/><span>0{selected+1}</span></div><h3>{t(step.title)}</h3><p className={selected === 0 ? "journey-quote" : ""}>{t(step.body)}</p><p className="journey-caption">{selected === 0 ? t("reportCaption") : selected === 3 ? t("awaitingReview") : t("examplePlace")}</p></div>
    <div className="journey-controls" role="group" aria-label={t("exampleJourney")}>{steps.map((item,index)=><button key={item.label} type="button" aria-pressed={selected === index} aria-controls="journey-content" onClick={()=>setSelected(index)}><span aria-hidden="true">0{index+1}</span>{t(item.label)}</button>)}</div>
    <p className="example-notice">{t("exampleNotice")}</p>
  </section>;
}

export function BridgeDrawing() {
  return <svg className="bridge-drawing" viewBox="0 0 1100 115" fill="none" aria-hidden="true"><path d="M0 80h1100M0 86h1100M140 80V24h16v56m236 0V24h16v56m284 0V24h16v56m236 0V24h16v56M148 29c78 68 170 68 252 0 98 70 204 70 300 0 80 68 171 68 252 0" stroke="currentColor" strokeWidth="1.2"/>{[190,232,274,316,358,450,500,550,600,650,742,784,826,868,910].map((x,i)=><path key={x} d={`M${x} ${[57,70,77,71,57,58,74,81,74,58,57,70,77,71,57][i]}V80`} stroke="currentColor"/>)}<path d="M0 107c50-12 80 12 130 0s80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0" stroke="currentColor" opacity=".4"/></svg>;
}
