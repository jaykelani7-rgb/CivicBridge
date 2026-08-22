"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AudioLines,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Headphones,
  HeartHandshake,
  LoaderCircle,
  MapPinned,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  districtIndicator,
  fieldChecklist,
  parsedVoiceNeeds,
  quickStats,
  rotatingGuidance,
  type ParsedVoiceNeed,
} from "./volunteer-data";
import { api } from "@/lib/api";

type IntakePhase = "idle" | "recording" | "processing" | "parsed";

function ProcessingSkeleton() {
  return (
    <div className="space-y-4 rounded-[24px] border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}

function ParsedNeedCard({
  parsedNeed,
  onConfirm,
  isSubmitting,
}: {
  parsedNeed: ParsedVoiceNeed;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4 rounded-[24px] border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">Parsed from voice intake</Badge>
        <Badge variant={parsedNeed.urgency === "Critical" ? "warning" : "secondary"}>
          {parsedNeed.urgency} urgency
        </Badge>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Transcript
        </p>
        <p className="text-base leading-relaxed text-foreground">
          {parsedNeed.transcript}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPinned className="h-4 w-4 text-accent" />
            Location
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {parsedNeed.location}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CircleAlert className="h-4 w-4 text-primary" />
            Beneficiary note
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {parsedNeed.beneficiaryHint}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Suggested categories
        </p>
        <div className="flex flex-wrap gap-2">
          {parsedNeed.categories.map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="rounded-full normal-case tracking-normal"
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={onConfirm} className="w-full h-14 text-base" disabled={isSubmitting}>
        {isSubmitting ? (
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Send className="mr-2 h-5 w-5" />
        )}
        Confirm and send to coordination
      </Button>
    </motion.div>
  );
}

export function VolunteerShell() {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<IntakePhase>("idle");
  const [parsedNeed, setParsedNeed] = useState<ParsedVoiceNeed | null>(null);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [waveSeed, setWaveSeed] = useState(0);

  const rotateGuidance = useEffectEvent(() => {
    setGuidanceIndex((current) => (current + 1) % rotatingGuidance.length);
  });

  const animateWave = useEffectEvent(() => {
    setWaveSeed((current) => (current + 1) % 6);
  });

  useEffect(() => {
    if (phase !== "recording" && phase !== "processing") {
      return;
    }

    const guidanceTimer = window.setInterval(() => {
      rotateGuidance();
    }, 2200);

    const waveTimer = window.setInterval(() => {
      animateWave();
    }, 380);

    return () => {
      window.clearInterval(guidanceTimer);
      window.clearInterval(waveTimer);
    };
  }, [phase]);

  const statusCopy = useMemo(() => {
    if (phase === "recording") {
      return "Listening for speech and local context";
    }

    if (phase === "processing") {
      return "Transcribing with Whisper and extracting need categories";
    }

    if (phase === "parsed") {
      return "Parsed and ready for confirmation";
    }

    return "Ready for one-tap intake";
  }, [phase]);

  const intakeMutation = useMutation({
    mutationFn: async () => {
      setPhase("recording");
      await new Promise((resolve) => setTimeout(resolve, 1100));
      setPhase("processing");
      
      const dummyWav = new Blob([new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32])], { type: "audio/wav" });
      const formData = new FormData();
      formData.append("country_code", "IN");
      formData.append("channel", "voice");
      formData.append("language", "hi");
      formData.append("file", dummyWav, "voice_intake.wav");
      
      const res = await api.submitRequest(formData);
      
      let status: string = "pending";
      let requestData: any = null;
      let retries = 0;
      while (status === "pending" && retries < 15) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const currentData = await api.getRequestStatus(res.request_id);
        requestData = currentData;
        status = currentData.status;
        retries++;
      }
      
      if (status !== "completed" || !requestData) {
        throw new Error("Intake processing timed out or failed.");
      }
      
      let urgencyLabel: "Critical" | "High" | "Moderate" = "Moderate";
      if (requestData.urgency === "critical") urgencyLabel = "Critical";
      else if (requestData.urgency === "high") urgencyLabel = "High";
      
      return {
        request_id: res.request_id,
        transcript: requestData.summary,
        categories: [requestData.category],
        urgency: urgencyLabel,
        location: "Jaipur Ward 1 (Old City)",
        beneficiaryHint: "Identified via CivicBridge AI Extraction"
      } as ParsedVoiceNeed;
    },
    onSuccess: (data) => {
      setParsedNeed(data);
      setPhase("parsed");
      toast.success("Voice intake parsed. Review the extracted need before sending.");
    },
    onError: () => {
      setPhase("idle");
      toast.error("Voice intake failed. Please try recording again.");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!parsedNeed?.request_id) return true;
      await api.submitReview(parsedNeed.request_id, "approve", "Approved by field volunteer");
      return true;
    },
    onSuccess: () => {
      toast.success("Need sent to coordination and tagged for follow-up.");
      startTransition(() => {
        setParsedNeed(null);
        setPhase("idle");
      });
    },
    onError: () => {
      toast.error("Confirmation failed. The parsed draft is still available.");
    },
  });

  function handleStartIntake() {
    if (intakeMutation.isPending) {
      return;
    }

    setParsedNeed(null);
    setGuidanceIndex(0);
    intakeMutation.mutate();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f2ede3_54%,#ece5d7_100%)] text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-24 pt-4 sm:max-w-lg sm:px-5">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[28px] border border-border bg-card/95 p-4 shadow-soft"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Citizen feedback portal
              </p>
              <h1 className="mt-1 font-heading text-3xl font-black text-foreground">
                Submit Regional Need
              </h1>
            </div>
            <div className="rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-secondary">
              Portal open
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-accent" />
              AI Speech Engine ready
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              Active country: IN
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
        >
          <Card className="overflow-hidden border-border bg-[radial-gradient(circle_at_top,rgba(209,96,61,0.16),transparent_36%),linear-gradient(180deg,#fffdf9,#fff7ee)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Badge variant="default">One-tap voice intake</Badge>
                  <CardTitle className="mt-4 text-3xl">Report needs hands-free</CardTitle>
                </div>
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <AudioLines className="h-5 w-5" />
                </div>
              </div>
              <CardDescription className="mt-2 text-base">
                Designed for fast field use in bright, noisy conditions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col items-center gap-4 rounded-[28px] border border-primary/15 bg-white/80 px-4 py-6 text-center">
                <motion.button
                  type="button"
                  onClick={handleStartIntake}
                  whileTap={{ scale: 0.95 }}
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : intakeMutation.isPending
                        ? {
                            scale: [1, 1.05, 1],
                            boxShadow: [
                              "0 0 0 0 rgba(209,96,61,0.28)",
                              "0 0 0 16px rgba(209,96,61,0.08)",
                              "0 0 0 0 rgba(209,96,61,0.28)",
                            ],
                          }
                        : {
                            scale: [1, 1.02, 1],
                            boxShadow: [
                              "0 0 0 0 rgba(209,96,61,0.2)",
                              "0 0 0 12px rgba(209,96,61,0.08)",
                              "0 0 0 0 rgba(209,96,61,0.2)",
                            ],
                          }
                  }
                  transition={{
                    duration: intakeMutation.isPending ? 1.3 : 2.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                  className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-primary/15 bg-primary text-primary-foreground shadow-[0_24px_50px_-24px_rgba(209,96,61,0.65)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  {intakeMutation.isPending ? (
                    <LoaderCircle className="h-16 w-16 animate-spin" />
                  ) : (
                    <Mic className="h-16 w-16" />
                  )}
                </motion.button>

                <div className="space-y-2">
                  <p className="text-lg font-bold text-foreground">{statusCopy}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {rotatingGuidance[guidanceIndex]}
                  </p>
                </div>

                <div className="flex h-12 items-end gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const active =
                      phase === "recording" || phase === "processing";
                    const height = active
                      ? 14 + ((waveSeed + index * 2) % 5) * 8
                      : 10 + (index % 3) * 4;

                    return (
                      <motion.span
                        key={index}
                        animate={{ height }}
                        transition={{ duration: 0.22 }}
                        className="w-2 rounded-full bg-primary/75"
                      />
                    );
                  })}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {intakeMutation.isPending ? (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <ProcessingSkeleton />
                  </motion.div>
                ) : parsedNeed ? (
                  <ParsedNeedCard
                    key="parsed"
                    parsedNeed={parsedNeed}
                    onConfirm={() => confirmMutation.mutate()}
                    isSubmitting={confirmMutation.isPending}
                  />
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-[24px] border border-border bg-card px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-accent/10 p-3 text-accent">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          Whisper + NLP assist is ready
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          Tap the mic to capture speech, auto-extract categories,
                          and send a reviewed summary to the coordinator queue.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="grid grid-cols-2 gap-3"
        >
          {quickStats.map((item) => (
            <Card key={item.label} className="bg-card/95">
              <CardContent className="p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-black text-foreground">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          ))}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
        >
          <Card className="bg-card/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Badge variant="secondary">District context</Badge>
                  <CardTitle className="mt-4 text-3xl">Active Regional Indicators</CardTitle>
                </div>
                <div className="rounded-full bg-secondary/10 p-3 text-secondary">
                  <MapPinned className="h-5 w-5" />
                </div>
              </div>
              <CardDescription className="mt-2 text-base">
                Local baseline data and vulnerability indices to prioritize infrastructure interventions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-secondary/20 bg-secondary/8 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-foreground">{districtIndicator.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {districtIndicator.vulnerabilityIndex} • {districtIndicator.eta}
                    </p>
                  </div>
                  <div className="rounded-full border border-secondary/20 bg-white px-3 py-1.5 text-sm font-semibold text-secondary">
                    Context active
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {districtIndicator.priorities.map((prio) => (
                    <Badge
                      key={prio}
                      variant="secondary"
                      className="rounded-full normal-case tracking-normal"
                    >
                      {prio}
                    </Badge>
                  ))}
                  {districtIndicator.languages.map((language) => (
                    <Badge
                      key={language}
                      variant="accent"
                      className="rounded-full normal-case tracking-normal"
                    >
                      {language}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {districtIndicator.rationale.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"
                  >
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                    <p className="text-sm leading-relaxed text-foreground">{item}</p>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="h-[52px] w-full text-base">
                Open detailed municipal briefing
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.35 }}
        >
          <Card className="bg-card/95">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-harvest/15 p-3 text-warning">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Field-readiness checklist</CardTitle>
                  <CardDescription>
                    Quick reminders for outdoor deployment and low-connectivity work.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fieldChecklist.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"
                >
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.section>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-white/92 px-4 pb-5 pt-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            <Button asChild variant="outline" className="h-14 flex-1 text-base">
              <Link href="/command-center">Coordinator view</Link>
            </Button>
            <Button className="h-14 flex-[1.25] text-base">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Ready for deployment
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
