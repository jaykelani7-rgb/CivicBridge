"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  HeartHandshake,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { analyticsAttributes, trackEvent } from "@/lib/analytics";
import { SiteHeader } from "@/components/navigation/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionShell } from "@/components/ui/section-shell";
import {
  howItWorks,
  onboardingPanels,
} from "./home-data";
import { HotspotBrowser } from "./opportunity-browser";
import { SystemPulse } from "./system-pulse";

export function CivicBridgeHome() {
  function handleTrackedClick(event: string, label: string, destination: string) {
    trackEvent({
      event,
      category: "navigation",
      label,
      destination,
    });
  }

  return (<><SiteHeader />
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section
          id="home"
          className="relative overflow-hidden rounded-[24px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(230,161,87,0.18),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(107,142,35,0.15),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,247,241,0.98))] px-4 py-7 shadow-soft sm:rounded-[32px] sm:px-8 sm:py-10 lg:px-10 lg:py-12"
        >
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">DPI Theme Portal</Badge>
                <Badge variant="accent">AI Multilingual Intake</Badge>
                <Badge variant="warning">Explainable Priority Scores</Badge>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl break-words text-balance font-heading text-[clamp(2.45rem,12vw,4rem)] font-black leading-[0.98] tracking-tight text-foreground">
                  From Multilingual Citizen Voices to Ranked Infrastructure Projects.
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                  CivicBridge aggregates and normalizes citizen feedback, calculates
                  transparent need priorities, and generates grounded project briefs
                  for policymakers.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="min-h-12"
                  onClick={() =>
                    handleTrackedClick(
                      "hero_browse_clicked",
                      "View Active Hotspots",
                      "/hotspots",
                    )
                  }
                  {...analyticsAttributes({
                    event: "hero_browse_clicked",
                    category: "hero",
                    label: "View Active Hotspots",
                    destination: "/hotspots",
                  })}
                >
                  <Link href="/hotspots">
                    View Active Hotspots
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="min-h-12"
                  onClick={() =>
                    handleTrackedClick("hero_signup_clicked", "Intake Portal", "/volunteer")
                  }
                  {...analyticsAttributes({
                    event: "hero_signup_clicked",
                    category: "hero",
                    label: "Intake Portal",
                    destination: "/volunteer",
                  })}
                >
                  <Link href="/volunteer">Submit Feedback</Link>
                </Button>
              </div>

              <SystemPulse />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <div className="absolute inset-6 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative space-y-4 rounded-[28px] border border-border bg-card/95 p-5 shadow-[0_24px_64px_-32px_rgba(63,81,181,0.35)] sm:p-6">
                <div className="flex items-center gap-3 rounded-[20px] border border-secondary/20 bg-secondary/10 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Shorter, clearer intake</p>
                    <p className="text-sm text-muted-foreground">
                      Citizen reports are transcribed and translated instantly using Google Cloud AI.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-background/95">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Search className="h-5 w-5 text-accent" />
                        AI Extraction
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Structured taxonomy mapping, urgency labels, and PII masking via Gemini.
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-background/95">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <ShieldCheck className="h-5 w-5 text-secondary" />
                        Transparent Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Explainable formulas combining demand rate, severity, access gaps, and vulnerability.
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(209,96,61,0.08),rgba(63,81,181,0.08))]">
                  <CardContent className="grid min-w-0 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        Live operations
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        Intake queues, spatial enrichment, and policymaker decisions stay connected.
                      </p>
                    </div>
                    <Button asChild variant="accent" className="w-full whitespace-normal text-center sm:w-fit xl:whitespace-nowrap">
                      <Link href="/command-center">View analyst console</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        </section>

        <SectionShell
          id="features"
          eyebrow="How it works"
          title="A transparent route from voice to project delivery"
          description="Each step integrates robust Google Cloud AI capabilities with deterministic priority ranking rules."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {howItWorks.map((item) => (
              <Card key={item.step} className="h-full bg-background/85">
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-black text-primary">
                    {item.step}
                  </div>
                  <CardTitle className="text-2xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionShell>

        <SectionShell
          id="browse"
          eyebrow="Browse hotspots"
          title="Search regional demand hotspots dynamically"
          description="Filter active infrastructure needs by sector and local administrative bounds."
        >
          <HotspotBrowser />
        </SectionShell>

        <SectionShell
          id="impact"
          eyebrow="Proof and trust"
          title="Quantifying structural development outcomes"
          description="Verify baseline-to-target milestones and track live project indicators across target wards."
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <Card className="bg-[linear-gradient(135deg,rgba(107,142,35,0.12),rgba(255,255,255,0.92))]">
                <CardHeader>
                  <CardTitle className="text-2xl">CivicBridge Impact</CardTitle>
                </CardHeader>
                <CardContent><p className="text-muted-foreground">Open Policy &amp; Impact to inspect backend-recorded project baselines, targets, current measurements, provenance, and confidence. Unsupported national totals and accuracy claims are intentionally omitted.</p></CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(63,81,181,0.1),rgba(255,255,255,0.96))]">
              <CardHeader className="space-y-4">
                <Badge variant="accent" className="w-fit">
                  Citizen Integration
                </Badge>
                <CardTitle className="text-3xl">
                  Unified DPI flows bridge the gap to government.
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/80 p-4">
                  <HeartHandshake className="mt-0.5 h-5 w-5 text-primary" />
                  <p>Citizens submit local issues easily via native audio recordings or simple text entries.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/80 p-4">
                  <Building2 className="mt-0.5 h-5 w-5 text-secondary" />
                  <p>Analysts inspect high-confidence demand clusters and verify low-confidence extracts.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/80 p-4">
                  <Sparkles className="mt-0.5 h-5 w-5 text-accent" />
                  <p>Policymakers generate AI project briefs and review baseline-to-target development impact.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </SectionShell>

        <SectionShell
          id="join"
          eyebrow="Join the platform"
          title="Different users, targeted starting points"
          description="Separate panels make the entry paths obvious without forcing everyone through the same flow."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {onboardingPanels.map((panel) => (
              <Card key={panel.title} className="flex flex-col h-full">
                <CardHeader className="space-y-4">
                  <CardTitle className="text-2xl">{panel.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-6">
                  <p className="text-base text-muted-foreground">{panel.description}</p>
                  <Button asChild className="w-full">
                    <Link href={panel.href}>{panel.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionShell>

      </div>

      <footer className="border-t border-border/70 bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>CivicBridge AI. Built for inclusive Digital Public Infrastructure and explainable prioritization.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#home" className="hover:text-foreground">
              Home
            </a>
            <a href="#browse" className="hover:text-foreground">
              Browse
            </a>
            <Link href="/command-center" className="hover:text-foreground">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </main></>
  );
}
