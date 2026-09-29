"use client";

import { ArrowDown, ArrowRight, MoveUpRight } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/navigation/site-header";
import { Button } from "@/components/ui/button";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { trackEvent } from "@/lib/analytics";
import { HotspotBrowser } from "./opportunity-browser";
import { ExampleJourney, BridgeDrawing } from "./example-journey";

export function CivicBridgeHome() {
  const { t } = usePublicLocale();
  return <><SiteHeader /><main id="main-content" className="editorial-home" data-no-ui-translation>
    <section className="editorial-container home-hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="editorial-dot"/>{t("homeLabel")}</p>
        <h1 id="home-title">{t("heroFirst")}<br/><em>{t("heroSecond")}</em></h1>
        <p className="hero-description">{t("heroBody")}</p>
        <div className="hero-actions">
          <Button asChild size="lg" onClick={() => trackEvent({ event: "hero_signup_clicked", category: "hero", label: "Report an issue", destination: "/volunteer" })}><Link href="/volunteer">{t("reportIssue")}<ArrowRight size={17}/></Link></Button>
          <a href="#example-journey" className="editorial-link">{t("seeJourney")}<ArrowDown size={16}/></a>
        </div>
        <p className="hero-note">{t("heroNote")}</p>
      </div>
      <ExampleJourney />
    </section>

    <section className="connection-section" aria-labelledby="connection-title">
      <div className="editorial-container connection-layout">
        <div><p className="eyebrow">{t("connectionLabel")}</p><h2 id="connection-title">{t("connectionTitle")}</h2></div>
        <div className="connection-copy"><p>{t("connectionBody")}</p><p className="connection-note">{t("connectionNote")}</p></div>
        <BridgeDrawing />
      </div>
    </section>

    <section className="editorial-container editorial-section" aria-labelledby="steps-title">
      <p className="eyebrow">{t("stepsLabel")}</p><h2 id="steps-title" className="section-title">{t("stepsTitle")}</h2>
      <ol className="report-steps">{([['stepOneTitle','stepOneBody'],['stepTwoTitle','stepTwoBody'],['stepThreeTitle','stepThreeBody']] as const).map(([title,body],i) => <li key={title}><span className="step-number">0{i+1}</span><h3>{t(title)}</h3><p>{t(body)}</p></li>)}</ol>
    </section>

    <section id="browse" className="hotspots-section" aria-labelledby="hotspots-title"><div className="editorial-container editorial-section">
      <div className="section-heading-row"><div><p className="eyebrow">{t("hotspotsLabel")}</p><h2 id="hotspots-title" className="section-title">{t("hotspotsTitle")}</h2><p className="section-description">{t("hotspotsBody")}</p></div><Link href="/hotspots" className="editorial-link">{t("allHotspots")}<MoveUpRight size={17}/></Link></div>
      <HotspotBrowser />
    </div></section>

    <section className="editorial-container editorial-section review-section" aria-labelledby="review-title">
      <div><p className="eyebrow">{t("reviewLabel")}</p><h2 id="review-title" className="section-title">{t("reviewHeading")}</h2><p className="section-description">{t("reviewIntro")}</p></div>
      <div className="review-principles"><article><span aria-hidden="true">01</span><div><h3>{t("evidenceTitle")}</h3><p>{t("evidenceBody")}</p></div></article><article><span aria-hidden="true">02</span><div><h3>{t("humanTitle")}</h3><p>{t("humanBody")}</p></div></article></div>
    </section>

    <section className="editorial-container tracking-section" aria-labelledby="tracking-title"><div><p className="eyebrow">{t("trackLabel")}</p><h2 id="tracking-title">{t("trackTitle")}</h2></div><p>{t("trackBody")}</p><Button asChild variant="outline"><Link href="/track">{t("trackAction")}<ArrowRight size={16}/></Link></Button></section>
    <section className="editorial-container final-section"><p className="eyebrow">CivicBridge</p><h2>{t("finalTitle")}</h2><p>{t("finalBody")}</p><Button asChild size="lg"><Link href="/volunteer">{t("reportIssue")}<ArrowRight size={17}/></Link></Button></section>
  </main><footer className="site-footer" data-no-ui-translation><div className="editorial-container"><div className="footer-top"><Link href="/" className="footer-brand">CivicBridge<span aria-hidden="true">↗</span></Link><p>{t("footerNote")}</p><nav aria-label={t("publicNav")}><Link href="/hotspots">{t("hotspots")}</Link><Link href="/track">{t("trackAction")}</Link><Link href="/auth">{t("staffSignIn")}</Link></nav></div><p className="footer-limit">{t("footerLimit")}</p></div></footer></>;
}
