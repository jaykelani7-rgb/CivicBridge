"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeAlert,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Layers3,
  LoaderCircle,
  MapPinned,
  RefreshCcw,
  ScanSearch,
  Search,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
  useEffect,
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type CommandNeed,
  commandNeeds,
  type OCRQueueItem,
  ocrQueueItems,
  silentFeedItems,
} from "./command-center-data";
import { api } from "@/lib/api";

const queueKey = ["command-center", "ocr-queue"];

const urgencyTone = {
  critical: "bg-destructive/90 shadow-[0_0_30px_rgba(229,57,53,0.55)]",
  high: "bg-primary shadow-[0_0_28px_rgba(209,96,61,0.45)]",
  elevated: "bg-warning shadow-[0_0_24px_rgba(230,161,87,0.35)]",
} as const;

const decayTone = {
  fresh: "ring-destructive/60",
  warming: "ring-primary/50",
  cooling: "ring-warning/40",
} as const;

const feedTone = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  watch: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
} as const;

type QueueAction = {
  id: string;
  decision: "approved" | "rejected";
};

type SummaryMetric = {
  label: string;
  value: string;
  tone: "danger" | "accent" | "success" | "muted";
  detail: string;
};

const summaryMetrics: SummaryMetric[] = [
  {
    label: "Active Hotspots",
    value: "38",
    tone: "danger",
    detail: "Geospatial demand clusters with priority need indexes.",
  },
  {
    label: "Auto-translated",
    value: "142k+",
    tone: "accent",
    detail: "Citizen voice notes successfully parsed to structured English.",
  },
  {
    label: "Approved projects",
    value: "24",
    tone: "success",
    detail: "Active infrastructure projects authorized by policymaker decision.",
  },
  {
    label: "Low-confidence queue",
    value: "3",
    tone: "muted",
    detail: "Items awaiting manual analyst verification of AI extractions.",
  },
];

function toneClasses(tone: SummaryMetric["tone"]) {
  if (tone === "danger") {
    return "bg-destructive/12 text-destructive";
  }

  if (tone === "accent") {
    return "bg-accent/12 text-accent";
  }

  if (tone === "success") {
    return "bg-secondary/12 text-secondary";
  }

  return "bg-muted text-muted-foreground";
}

function formatQueueCount(count: number) {
  return count > 0 ? `${count} pending review` : "Queue clear";
}

function NeedDetailDrawer({
  need,
  onClose,
}: {
  need: CommandNeed | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {need ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-[#070b10]/65 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#0c1219] text-[#f2ede5] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#9fadb8]">
                  Need intelligence
                </p>
                <h2 className="mt-1 font-heading text-2xl font-bold">{need.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#f2ede5] hover:bg-white/10"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{need.category}</Badge>
                <Badge variant="warning">{need.status.replace("_", " ")}</Badge>
                <Badge variant="accent">{need.locationName}</Badge>
              </div>

              <p className="text-sm leading-relaxed text-[#d0d7dd]">{need.summary}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#90a0ac]">
                    Heat score
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">{need.heatScore}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#90a0ac]">
                    Signals
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">{need.reports}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#90a0ac]">
                    Radius
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">{need.radiusKm} km</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BrainCircuit className="h-4 w-4 text-[#6f80d8]" />
                  Why was this flagged?
                </div>
                <div className="rounded-2xl border border-[#2f3a47] bg-[#121b25] p-4">
                  <p className="text-sm leading-relaxed text-[#d6dde2]">{need.aiReason}</p>
                  <div className="mt-4 space-y-2">
                    {need.aiEvidence.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-white/6 bg-white/5 px-3 py-2 text-sm text-[#b7c3cb]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white">Requested resources</p>
                  <div className="space-y-2">
                    {need.needs.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-[#d2dbe1]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white">Attached evidence</p>
                  <div className="space-y-2">
                    {need.media.map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-[#d2dbe1]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function OCRReviewQueue() {
  const queryClient = useQueryClient();
  const { data: queue = [] } = useQuery<OCRQueueItem[]>({
    queryKey: queueKey,
    queryFn: async () => {
      const items = await api.getReviewQueue();
      return items.map((item) => ({
        id: item.request_id,
        district: item.tenant_country === "IN" ? "Jaipur Old City Wards" : item.tenant_country === "BR" ? "Rio de Janeiro Districts" : "Cape Town Wards",
        language: item.language,
        extractedType: item.ai_fields?.category || "Other",
        confidence: Math.round((item.ai_fields?.confidence || 0.85) * 100),
        receivedAt: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        summary: item.translation || "No content",
        fields: [item.ai_fields?.subcategory, item.ai_fields?.urgency].filter(Boolean) as string[],
      }));
    },
    initialData: [],
    placeholderData: keepPreviousData,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision }: QueueAction) => {
      const action = decision === "approved" ? "approve" : "mark_unusable";
      await api.submitReview(id, action, "Reviewed via NGO Command Center Console");
      return decision;
    },
    onMutate: async ({ id, decision }) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previousQueue =
        queryClient.getQueryData<OCRQueueItem[]>(queueKey) ?? [];

      queryClient.setQueryData<OCRQueueItem[]>(
        queueKey,
        previousQueue.filter((item) => item.id !== id),
      );

      return { previousQueue, decision };
    },
    onSuccess: (decision) => {
      toast.success(
        decision === "approved"
          ? "OCR extract approved and sent to triage."
          : "OCR extract rejected and routed for reprocessing.",
      );
    },
    onError: (_error, _variables, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(queueKey, context.previousQueue);
      }

      toast.error("Queue update failed. The item was restored.");
    },
  });

  return (
    <Card className="border-white/10 bg-[#10161e] text-[#f2ede5] hover:translate-y-0 hover:shadow-none">
      <CardHeader className="border-b border-white/8 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">OCR review queue</Badge>
              <div className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-warning">
                {formatQueueCount(queue.length)}
              </div>
            </div>
            <CardTitle className="mt-4 text-3xl text-white">
              Human approval for low-confidence extracts
            </CardTitle>
            <CardDescription className="mt-2 text-[#9fb0bc]">
              Forms below the 85% confidence threshold are held here before
              becoming verified operational needs.
            </CardDescription>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <ScanSearch className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {queue.length === 0 ? (
          <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-5 text-sm text-[#d8e3c3]">
            The OCR queue is clear for now.
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/8 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{item.language}</Badge>
                    <Badge variant="warning">{item.extractedType}</Badge>
                    <span className="text-xs uppercase tracking-[0.18em] text-[#8da0ae]">
                      {item.receivedAt}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-white">
                    {item.district}
                  </h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-[#b8c5ce]">
                    {item.summary}
                  </p>
                </div>
                <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-warning">
                    Confidence
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {item.confidence}%
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.fields.map((field) => (
                  <div
                    key={field}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#bbcad3]"
                  >
                    {field}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="secondary"
                  className="bg-secondary/85 text-secondary-foreground hover:bg-secondary"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ id: item.id, decision: "approved" })
                  }
                >
                  {reviewMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve extract
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ id: item.id, decision: "rejected" })
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject and reprocess
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CommandCenterShell() {
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [selectedNeedId, setSelectedNeedId] = useState<string>("");
  const [drawerNeedId, setDrawerNeedId] = useState<string>("");
  const [feedSearch, setFeedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "new">("all");
  const [aiExpandedId, setAiExpandedId] = useState<string>("");
  const deferredSearch = useDeferredValue(feedSearch);

  const { data: commandNeeds = [], refetch: refetchHotspots } = useQuery<CommandNeed[]>({
    queryKey: ["command-center", "hotspots"],
    queryFn: async () => {
      const collection = await api.getHotspots();
      const coordMap: Record<string, { x: number; y: number }> = {
        "IN-JAIPUR-WARD1": { x: 68, y: 24 },
        "IN-JAIPUR-WARD2": { x: 41, y: 46 },
        "BR-RIO-DIST1": { x: 25, y: 70 },
        "BR-RIO-DIST2": { x: 75, y: 85 },
        "ZA-CT-WARD1": { x: 15, y: 30 },
        "ZA-CT-WARD2": { x: 85, y: 60 },
      };

      return collection.features.map((feat) => {
        const props = feat.properties;
        const coords = coordMap[props.admin_id] || { x: 50, y: 50 };
        const sectorName = props.sector.charAt(0).toUpperCase() + props.sector.slice(1);
        
        let urgencyLabel: "critical" | "high" | "elevated" = "elevated";
        if (props.action_score >= 80) urgencyLabel = "critical";
        else if (props.action_score >= 50) urgencyLabel = "high";

        return {
          id: props.hotspot_id,
          title: `${props.admin_name} ${sectorName} Demand Hotspot`,
          locationName: props.admin_name,
          category: sectorName,
          status: "NEW",
          urgencyLabel,
          urgencyScore: Math.round(props.need_score),
          heatScore: Math.round(props.action_score),
          decayState: props.action_score >= 80 ? "fresh" : props.action_score >= 50 ? "warming" : "cooling",
          reports: props.request_rate,
          radiusKm: 3,
          updatedMinutesAgo: 4,
          x: coords.x,
          y: coords.y,
          summary: `Geospatial cluster with ${props.request_rate} active requests. Infrastructure Gap index is currently ${props.service_gap}%.`,
          needs: [`Restore ${props.sector} service capacity`, `Deploy repair teams`, `Provide relief materials`],
          media: [`${props.request_rate} validated reports`],
          aiReason: `This hotspot has an objective Need Score of ${props.need_score}/100 and Action Priority Score of ${props.action_score}/100.`,
          aiEvidence: [
            `Infrastructure gap: ${props.service_gap}%`,
            `Vulnerability Index: ${props.vulnerability}%`,
            `Request Volume: ${props.request_rate} cases`
          ]
        } as CommandNeed;
      });
    },
    initialData: [],
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (commandNeeds.length > 0 && !selectedNeedId) {
      setSelectedNeedId(commandNeeds[0].id);
      setAiExpandedId(commandNeeds[0].id);
    }
  }, [commandNeeds, selectedNeedId]);

  const selectedNeed =
    commandNeeds.find((need) => need.id === selectedNeedId) ?? commandNeeds[0] ?? null;
  const drawerNeed =
    commandNeeds.find((need) => need.id === drawerNeedId) ?? null;

  const filteredNeeds = useMemo(() => {
    if (activeFilter === "critical") {
      return commandNeeds.filter((need) => need.urgencyLabel === "critical");
    }

    if (activeFilter === "new") {
      return commandNeeds.filter((need) => need.status === "NEW");
    }

    return commandNeeds;
  }, [commandNeeds, activeFilter]);

  const filteredFeed = useMemo(() => {
    if (!deferredSearch.trim()) {
      return silentFeedItems;
    }

    const query = deferredSearch.toLowerCase();

    return silentFeedItems.filter((item) =>
      [item.headline, item.area, item.detail, item.signal]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearch]);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await refetchHotspots();
      await queryClient.invalidateQueries({ queryKey: queueKey });
      return true;
    },
    onSuccess: () => {
      toast.success("Intel layers refreshed. Heat and queue signals are up to date.");
    },
    onError: () => {
      toast.error("Refresh failed. Existing dashboard data is still visible.");
    },
  });

  return (
    <main className="dark min-h-screen bg-[#071019] text-[#f2ede5]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(209,96,61,0.14),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(63,81,181,0.14),transparent_28%),linear-gradient(180deg,#0f1823,#0a121b)] p-5 shadow-[0_30px_80px_-48px_rgba(0,0,0,0.8)] sm:p-6"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Analyst Console</Badge>
                <Badge variant="accent">Government Triage Mode</Badge>
                <Badge variant="warning">Verification Queue Active</Badge>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-heading text-4xl font-black tracking-tight text-white sm:text-5xl xl:text-6xl">
                  Live municipal intelligence for public infrastructure priority nodes.
                </h1>
                <p className="max-w-3xl text-base text-[#a9b7c1] sm:text-lg">
                  Verify AI-extracted citizen reports, inspect geographic demand hotspots,
                  and manage priority ranking indices in one dark-optimized coordination surface.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-[#f2ede5] hover:bg-white/10"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                Refresh intel
              </Button>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/auth">
                  Return to onboarding
                  <ChevronLeft className="ml-2 h-4 w-4 rotate-180" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.05, duration: 0.35 }}
                className="rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur"
              >
                <div
                  className={cn(
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                    toneClasses(metric.tone),
                  )}
                >
                  {metric.label}
                </div>
                <p className="mt-4 text-4xl font-black text-white">{metric.value}</p>
                <p className="mt-2 text-sm text-[#9eb0bb]">{metric.detail}</p>
              </motion.div>
            ))}
          </div>
        </motion.header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
          >
            <Card className="overflow-hidden border-white/10 bg-[#0d151e] text-[#f2ede5] hover:translate-y-0 hover:shadow-none">
              <CardHeader className="border-b border-white/8 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">Dynamic resource heat map</Badge>
                      <Badge variant="warning">Decay logic live</Badge>
                    </div>
                    <CardTitle className="text-3xl text-white">
                      Priority nodes glow based on severity and recency
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-[#93a4b1]">
                      Fresh critical needs pulse in terracotta-red, active but cooling
                      cases fade into harvest tones, and every node opens a detail
                      drawer for evidence-backed triage.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "all", label: "All live nodes" },
                      { id: "critical", label: "Critical only" },
                      { id: "new", label: "New reports" },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() =>
                          startTransition(() =>
                            setActiveFilter(
                              filter.id as "all" | "critical" | "new",
                            ),
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d151e]",
                          activeFilter === filter.id
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-white/10 bg-white/5 text-[#cad3db] hover:bg-white/10",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(63,81,181,0.14),transparent_30%),linear-gradient(180deg,#0f1723,#101722)] px-4 py-4 sm:px-5 sm:py-5">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:46px_46px]" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(209,96,61,0.14),transparent_18%),radial-gradient(circle_at_70%_56%,rgba(230,161,87,0.08),transparent_18%),radial-gradient(circle_at_65%_18%,rgba(229,57,53,0.1),transparent_14%)]" />

                  <div className="relative flex items-center justify-between gap-4 border-b border-white/8 pb-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#9fb0bc]">
                      <div className="flex items-center gap-2">
                        <MapPinned className="h-4 w-4 text-primary" />
                        BRICS municipal response zones
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-warning" />
                        Refreshes dynamically
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-accent" />
                        PostGIS Spatial Heat Index
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#c5d1d8]">
                      {filteredNeeds.length} visible nodes
                    </div>
                  </div>

                  <div className="relative mt-4 h-[420px] overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#152031,#0c1218)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.05),transparent_14%),radial-gradient(circle_at_74%_32%,rgba(255,255,255,0.04),transparent_18%),radial-gradient(circle_at_64%_76%,rgba(255,255,255,0.04),transparent_16%)]" />
                    <svg
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full opacity-50"
                      viewBox="0 0 1000 600"
                      fill="none"
                    >
                      <path
                        d="M82 189C171 181 214 130 286 143C358 156 370 227 454 241C552 257 617 182 711 199C799 214 816 297 887 322"
                        stroke="rgba(111,128,216,0.34)"
                        strokeWidth="4"
                      />
                      <path
                        d="M109 376C201 365 275 396 364 377C439 361 476 310 555 302C649 292 705 352 794 347C860 344 899 309 947 281"
                        stroke="rgba(230,161,87,0.24)"
                        strokeWidth="3"
                      />
                    </svg>

                    {filteredNeeds.map((need, index) => (
                      <motion.button
                        key={need.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.08 + index * 0.04, duration: 0.28 }}
                        onClick={() => {
                          setSelectedNeedId(need.id);
                          setDrawerNeedId(need.id);
                        }}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d151e]"
                        style={{ left: `${need.x}%`, top: `${need.y}%` }}
                      >
                        <motion.span
                          className={cn(
                            "absolute inset-0 rounded-full ring-8",
                            decayTone[need.decayState],
                          )}
                          animate={
                            prefersReducedMotion
                              ? undefined
                              : {
                                  scale: [1, 1.45, 1],
                                  opacity: [0.3, 0.12, 0.3],
                                }
                          }
                          transition={{
                            duration: need.decayState === "fresh" ? 2.1 : 3.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }}
                        />
                        <span
                          className={cn(
                            "relative flex h-5 w-5 items-center justify-center rounded-full border border-white/20",
                            urgencyTone[need.urgencyLabel],
                            selectedNeedId === need.id &&
                              "ring-4 ring-white/20 ring-offset-2 ring-offset-[#101722]",
                          )}
                        />
                        <span className="pointer-events-none absolute left-7 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#0f1721]/95 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white shadow-lg lg:block">
                          {need.title}
                        </span>
                      </motion.button>
                    ))}

                    {selectedNeed ? (
                      <motion.div
                        key={selectedNeed.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-[#0c121b]/86 p-4 backdrop-blur-md"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default">{selectedNeed.category}</Badge>
                              <Badge variant="warning">
                                {selectedNeed.status.replace("_", " ")}
                              </Badge>
                              <span className="text-xs uppercase tracking-[0.18em] text-[#9fb0bc]">
                                Updated {selectedNeed.updatedMinutesAgo} min ago
                              </span>
                            </div>
                            <h3 className="mt-3 font-heading text-2xl font-bold text-white">
                              {selectedNeed.title}
                            </h3>
                            <p className="mt-2 max-w-3xl text-sm text-[#b5c1cb]">
                              {selectedNeed.aiReason}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            className="border-white/10 bg-white/5 text-[#f2ede5] hover:bg-white/10"
                            onClick={() => setDrawerNeedId(selectedNeed.id)}
                          >
                            Open detail drawer
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.42 }}
            className="space-y-6"
          >
            <Card className="border-white/10 bg-[#10161e] text-[#f2ede5] hover:translate-y-0 hover:shadow-none">
              <CardHeader className="border-b border-white/8 pb-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Badge variant="accent">Silent need identification</Badge>
                    <CardTitle className="mt-4 text-3xl text-white">
                      Real-time signal feed
                    </CardTitle>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <Bot className="h-5 w-5" />
                  </div>
                </div>
                <CardDescription className="mt-2 text-[#95a7b3]">
                  AI watches for underreported distress patterns before they become
                  direct asks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8092a0]" />
                  <Input
                    value={feedSearch}
                    onChange={(event) => setFeedSearch(event.target.value)}
                    placeholder="Search districts, signals, or summaries"
                    className="border-white/10 bg-white/5 pl-11 text-[#f2ede5] placeholder:text-[#8395a2]"
                  />
                </div>

                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {filteredFeed.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        item.relatedNeedId ? setSelectedNeedId(item.relatedNeedId) : undefined
                      }
                      className="w-full rounded-2xl border border-white/8 bg-white/5 p-4 text-left transition-all hover:border-accent/30 hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#10161e]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                feedTone[item.severity],
                              )}
                            >
                              {item.signal}
                            </div>
                            <span className="text-xs uppercase tracking-[0.18em] text-[#8ea1ae]">
                              {item.time}
                            </span>
                          </div>
                          <p className="font-heading text-lg font-bold text-white">
                            {item.headline}
                          </p>
                          <p className="text-sm text-[#8fa1ae]">{item.area}</p>
                          <p className="text-sm leading-relaxed text-[#c0ccd4]">
                            {item.detail}
                          </p>
                        </div>
                        <ChevronLeft className="mt-1 h-4 w-4 rotate-180 text-[#8ea1ae]" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.42 }}
          >
            <Card className="border-white/10 bg-[#10161e] text-[#f2ede5] hover:translate-y-0 hover:shadow-none">
              <CardHeader className="border-b border-white/8 pb-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Badge variant="accent">Explainable AI</Badge>
                    <CardTitle className="mt-4 text-3xl text-white">
                      Why each automated flag surfaced
                    </CardTitle>
                    <CardDescription className="mt-2 text-[#95a7b3]">
                      Every flagged need shows the signal cluster and supporting
                      context behind the recommendation.
                    </CardDescription>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <BadgeAlert className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                {commandNeeds.slice(0, 3).map((need) => {
                  const isOpen = aiExpandedId === need.id;

                  return (
                    <div
                      key={need.id}
                      className="overflow-hidden rounded-2xl border border-white/8 bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setAiExpandedId((current) => (current === need.id ? "" : need.id))
                        }
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#10161e]"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="warning">{need.locationName}</Badge>
                            <Badge variant="default">{need.reports} linked reports</Badge>
                          </div>
                          <p className="mt-3 font-heading text-xl font-bold text-white">
                            {need.title}
                          </p>
                          <p className="mt-1 text-sm text-[#92a5b1]">{need.aiReason}</p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-[#9fb0bc] transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-white/8 px-4 py-4">
                              <div className="grid gap-3">
                                {need.aiEvidence.map((item) => (
                                  <div
                                    key={item}
                                    className="rounded-xl border border-white/8 bg-[#0f1721] px-3 py-3 text-sm text-[#c0cdd5]"
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.42 }}
          >
            <OCRReviewQueue />
          </motion.div>
        </section>
      </div>

      <NeedDetailDrawer need={drawerNeed} onClose={() => setDrawerNeedId("")} />
    </main>
  );
}
