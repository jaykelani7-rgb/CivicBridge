"use client";

import { useState } from "react";
import { MapPin, MessageSquare, ScanLine, FileCheck2, Waves, Route, CircleHelp, Wrench } from "lucide-react";
import { usePublicLocale } from "@/components/providers/public-locale-provider";

// An original illustration, independent of queries, scores and operational records.
const steps = [
  { scene: "report", label: "journeyReport", title: "reportTitle", icon: MessageSquare },
  { scene: "connect", label: "journeyConnect", title: "connectTitle", icon: MapPin },
  { scene: "understand", label: "journeyUnderstand", title: "understandTitle", icon: ScanLine },
  { scene: "review", label: "journeyReview", title: "reviewTitle", icon: FileCheck2 },
] as const;

function NeighbourhoodScene({ stage }: { stage: number }) {
  return <svg viewBox="0 0 460 184" fill="none" aria-hidden="true">
    <path d="M-20 128 480 48M-20 158 480 78M86-20 129 204M333-20 376 204" stroke="currentColor"/>
    <path d="m22 28 47-8 9 43-47 8zm112-10 68-11 7 33-68 11zm12 132 61-10 7 32-61 10zm243-124 43-7 8 37-43 7zm-3 105 43-7 8 37-43 7z" fill="currentColor" opacity=".15"/>
    <path d="m210 56 27-23 42 12 9 43-68 11z" fill="var(--card)" stroke="var(--primary)" strokeWidth="2"/>
    <path d="m239 96-3-18 15-3 4 18m-23-33 9-2m13-2 9-2" stroke="var(--primary)" strokeWidth="2"/>
    <path d="m226 125 72-12" stroke="var(--terracotta)" strokeWidth="5" strokeLinecap="round"/>
    <rect x="266" y="115" width="21" height="14" rx="2" transform="rotate(-9 266 115)" fill="var(--primary)"/>
    <path d="m269 120 14-2m-13 6 14-2" stroke="var(--card)"/>
    {stage === 0 && <g data-scene-detail="resident-anchor"><path d="M174 86h-38v-32h64v32h-13l11 28" fill="var(--card)" stroke="var(--terracotta)" strokeWidth="2"/><path d="M148 66h40m-40 9h28" stroke="var(--terracotta)" strokeWidth="2"/><path d="m203 116 64 5" stroke="var(--terracotta)" strokeDasharray="3 4"/><circle cx="275" cy="123" r="21" stroke="var(--terracotta)" strokeWidth="2"/></g>}
    {stage === 1 && <g data-scene-detail="nearby-group"><ellipse cx="274" cy="124" rx="81" ry="33" fill="var(--primary)" opacity=".07"/><ellipse cx="274" cy="124" rx="81" ry="33" stroke="var(--primary)" strokeDasharray="4 5"/>{[[207,133],[310,101],[334,143]].map(([x,y])=><g key={x}><path d={`M${x} ${y} 275 123`} stroke="var(--primary)" strokeDasharray="2 3"/><circle cx={x} cy={y} r="8" fill="var(--card)" stroke="var(--primary)" strokeWidth="2"/><circle cx={x} cy={y} r="2" fill="var(--primary)"/></g>)}</g>}
    {stage === 2 && <g data-scene-detail="access-route"><path d="m84 134 152-25 9-16" stroke="var(--primary)" strokeWidth="10" opacity=".2" strokeLinecap="round"/><path d="m84 134 152-25 9-16" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 4"/>{[112,128,144].map(y=><path key={y} d={`M251 ${y}q8-5 16 0t16 0t16 0`} stroke="#527c91" strokeWidth="2"/>)}<circle cx="317" cy="124" r="12" fill="var(--card)" stroke="var(--terracotta)" strokeDasharray="3 2"/><path d="M317 118v7m0 4v1" stroke="var(--terracotta)" strokeWidth="2"/></g>}
    {stage === 3 && <g data-scene-detail="inspection-plan"><rect x="301" y="85" width="52" height="61" rx="3" fill="var(--card)" stroke="var(--primary)" strokeWidth="2"/><path d="M313 101h28m-28 11h22m-22 11h28m-28 11h18M301 116l-18 5" stroke="var(--primary)" strokeWidth="2"/><circle cx="275" cy="123" r="21" stroke="var(--terracotta)" strokeWidth="2" strokeDasharray="4 4"/></g>}
  </svg>;
}

export function ExampleJourney() {
  const { t } = usePublicLocale();
  const [selected, setSelected] = useState(0);
  return <section data-no-ui-translation id="example-journey" className="example-journey" aria-labelledby="journey-title">
    <div className="journey-top"><span className="eyebrow">{t("exampleJourney")}</span><span className="journey-count" aria-hidden="true">0{selected+1} / 04</span></div>
    <h2 id="journey-title">{t("journeyTitle")}</h2>
    <div className="journey-controls" role="group" aria-label={t("exampleJourney")}>{steps.map((item,index)=><button key={item.label} type="button" aria-pressed={selected === index} aria-controls="journey-content" onClick={()=>setSelected(index)}>{t(item.label)}</button>)}</div>
    {/* Overlaid intrinsic-size panels reserve the largest translated step, without fixed text heights. */}
    <div className="journey-content" id="journey-content" aria-live="polite" aria-atomic="true">
      {steps.map((step,index)=>{const Icon=step.icon;return <div key={step.scene} className="journey-panel" data-scene={step.scene} data-selected={selected===index} aria-hidden={selected!==index} inert={selected!==index}>
        <div className="locality-drawing"><NeighbourhoodScene stage={index}/></div>
        <div className="journey-scene-key"><span>{t("journeySchool")}</span><span className="drain-key">{t("journeyDrain")}</span></div>
        <div className="journey-description"><div className="journey-icon"><Icon size={19}/><span>{t("examplePlace")}</span></div><h3>{t(step.title)}</h3>
          {index===0 && <><blockquote className="journey-quote">{t("reportQuote")}</blockquote><p className="journey-caption">{t("reportCaption")}</p></>}
          {index===1 && <><p>{t("connectBody")}</p><div className="journey-evidence"><p className="journey-caption"><MapPin size={16}/>{t("journeyNearby")}</p><p>{t("journeyEvidence")}</p></div></>}
          {index===2 && <ul className="journey-breakdown"><li><Waves size={18}/>{t("journeyWater")}</li><li><Route size={18}/>{t("journeyAccess")}</li><li><CircleHelp size={18}/>{t("journeyMissing")}</li></ul>}
          {index===3 && <><ol className="journey-plan"><li><Wrench size={18}/>{t("journeyInspect")}</li><li><ScanLine size={18}/>{t("journeyRepair")}</li></ol><p className="journey-review-status">{t("awaitingReview")}</p></>}
        </div>
      </div>})}
    </div>
    <p className="example-notice">{t("exampleNotice")}</p>
  </section>;
}

export function BridgeDrawing() {
  return <svg className="bridge-drawing" viewBox="0 0 1100 115" fill="none" aria-hidden="true"><path d="M0 80h1100M0 86h1100M140 80V24h16v56m236 0V24h16v56m284 0V24h16v56m236 0V24h16v56M148 29c78 68 170 68 252 0 98 70 204 70 300 0 80 68 171 68 252 0" stroke="currentColor" strokeWidth="1.2"/>{[190,232,274,316,358,450,500,550,600,650,742,784,826,868,910].map((x,i)=><path key={x} d={`M${x} ${[57,70,77,71,57,58,74,81,74,58,57,70,77,71,57][i]}V80`} stroke="currentColor"/>)}<path d="M0 107c50-12 80 12 130 0s80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0 80 12 130 0" stroke="currentColor" opacity=".4"/></svg>;
}
