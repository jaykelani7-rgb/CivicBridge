"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { pdf } from "@react-pdf/renderer";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BanknoteArrowUp,
  Building2,
  CheckCircle2,
  Download,
  LoaderCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
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
import { Input } from "@/components/ui/input";
import {
  fundingNeeds,
  impactReceipts,
  type FundingNeed,
  type ImpactReceiptRecord,
} from "./csr-impact-data";
import { ImpactReceiptDocument } from "./impact-receipt-document";
import { api } from "@/lib/api";

const fundingBoardKey = ["csr-impact", "funding-board"];
const receiptsKey = ["csr-impact", "receipts"];

const summaryTiles = [
  {
    label: "Total capital allocated",
    value: "INR 25.4L",
    detail: "Across verified public works projects",
    icon: WalletCards,
  },
  {
    label: "Projects authorized",
    value: "18",
    detail: "With AI project briefs and target baseline outcomes",
    icon: CheckCircle2,
  },
  {
    label: "Average policy turnaround",
    value: "4.8 hrs",
    detail: "From hotspot identification to executive project approval",
    icon: TrendingUp,
  },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fundingProgress(need: FundingNeed) {
  return Math.min(100, Math.round((need.fundedAmount / need.fundingGoal) * 100));
}

function ReceiptDownloadButton({ receipt }: { receipt: ImpactReceiptRecord }) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    try {
      setIsGenerating(true);

      const blob = await pdf(
        <ImpactReceiptDocument receipt={receipt} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${receipt.receiptNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success("Impact receipt generated and downloaded.");
    } catch {
      toast.error("Receipt generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      variant="accent"
      className="h-12 w-full sm:w-auto"
      onClick={handleDownload}
      disabled={isGenerating}
    >
      <motion.span
        className="inline-flex items-center"
        animate={isGenerating ? { y: [0, -1, 0] } : undefined}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.9 }}
      >
        {isGenerating ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {isGenerating ? "Generating receipt" : "Generate impact receipt"}
      </motion.span>
    </Button>
  );
}

export function CSRImpactShell() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: boardNeeds = [] } = useQuery<FundingNeed[]>({
    queryKey: fundingBoardKey,
    queryFn: async () => {
      const collection = await api.getHotspots();
      return collection.features.map((feat) => {
        const props = feat.properties;
        const sectorName = props.sector.charAt(0).toUpperCase() + props.sector.slice(1);
        const goal = Math.round(props.service_gap * 2500);
        const funded = Math.min(goal, props.request_rate * 10000);

        return {
          id: props.hotspot_id,
          title: `${props.admin_name} ${sectorName} Rehabilitation Project`,
          location: props.admin_name,
          urgency: props.need_score >= 80 ? "Critical" : props.need_score >= 50 ? "High" : "Moderate",
          category: sectorName,
          verifiedBy: "CivicBridge Analyst Verification",
          households: props.request_rate * 25,
          fundingGoal: goal,
          fundedAmount: funded,
          eta: "Deploy within 7 days",
          summary: `This is a verified infrastructure need in ${props.admin_name} based on ${props.request_rate} citizen requests. The current infrastructure gap is assessed at ${props.service_gap}%.`,
          costBreakdown: [
            { label: "Engineering works", amount: Math.round(goal * 0.6) },
            { label: "Material logistics", amount: Math.round(goal * 0.2) },
            { label: "Verification and safety checks", amount: Math.round(goal * 0.2) },
          ],
          tags: ["Verified", props.sector.toUpperCase()],
          fundedByYou: false,
        } as FundingNeed;
      });
    },
    initialData: [],
    placeholderData: keepPreviousData,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: receiptsKey,
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return impactReceipts;
    },
    initialData: impactReceipts,
    placeholderData: keepPreviousData,
  });

  const pledgeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const rec = await api.generateRecommendation(id);
      await api.submitPolicyDecision(
        rec.recommendation_id,
        "approve",
        "Funded and approved via CSR Impact Console",
        "csr_donor"
      );
      return id;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: fundingBoardKey });
      const previous = queryClient.getQueryData<FundingNeed[]>(fundingBoardKey) ?? [];

      queryClient.setQueryData<FundingNeed[]>(
        fundingBoardKey,
        previous.map((need) =>
          need.id === id
            ? {
                ...need,
                fundedByYou: true,
                fundedAmount: need.fundingGoal,
              }
            : need,
        ),
      );

      return { previous };
    },
    onSuccess: () => {
      toast.success("Funding commitment reserved, project recommendation approved, and registered in backend!");
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(fundingBoardKey, context.previous);
      }
      toast.error("Funding reservation failed. The board was restored.");
    },
  });

  const filteredNeeds = useMemo(() => {
    if (!deferredSearch.trim()) {
      return boardNeeds;
    }

    const query = deferredSearch.toLowerCase();
    return boardNeeds.filter((need) =>
      [need.title, need.location, need.category, need.summary, need.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [boardNeeds, deferredSearch]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f4ef_0%,#eff2e7_40%,#f4eee3_100%)] text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[32px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(107,142,35,0.18),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(63,81,181,0.14),transparent_24%),linear-gradient(180deg,#ffffff,#faf7f1)] p-5 shadow-soft sm:p-6"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Public Infrastructure Portal</Badge>
                <Badge variant="accent">Impact-ready governance</Badge>
                <Badge variant="warning">Verified projects only</Badge>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  Authorize verified projects and download policymaker-ready impact certificates.
                </h1>
                <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                  A professional government & partner workspace for hotspot funding allocation,
                  exact cost breakdowns, and transparent tracking of baseline-to-target outcomes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="h-12">
                <Link href="/command-center">
                  View analyst console
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
                <Building2 className="mr-2 h-4 w-4" />
                Export alignment report
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {summaryTiles.map((tile, index) => {
              const Icon = tile.icon;
              return (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.06, duration: 0.35 }}
                  className="rounded-[24px] bg-secondary p-5 text-secondary-foreground shadow-[0_20px_50px_-30px_rgba(107,142,35,0.85)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/85">
                      {tile.label}
                    </p>
                    <Icon className="h-5 w-5 text-white/90" />
                  </div>
                  <p className="mt-5 text-4xl font-black text-white">{tile.value}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/82">
                    {tile.detail}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.95fr)]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.4 }}
          >
            <Card className="bg-card/95">
              <CardHeader className="pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <Badge variant="secondary">Projects Board</Badge>
                    <CardTitle className="mt-4 text-3xl">
                      Verified hotspots with baseline cost assessments
                    </CardTitle>
                    <CardDescription className="mt-2 text-base">
                      Review live priorities and authorize funding directly against needs verified by the CivicBridge backend.
                    </CardDescription>
                  </div>

                  <div className="relative w-full max-w-sm">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) =>
                        startTransition(() => setSearch(event.target.value))
                      }
                      placeholder="Search need, district, or category"
                      className="pl-11"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredNeeds.map((need) => {
                  const remaining = need.fundingGoal - need.fundedAmount;
                  const progress = fundingProgress(need);

                  return (
                    <div
                      key={need.id}
                      className="rounded-[24px] border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">{need.urgency} urgency</Badge>
                            <Badge variant="secondary">{need.category}</Badge>
                            {need.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="accent"
                                className="normal-case tracking-normal"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div>
                            <h3 className="font-heading text-2xl font-bold text-foreground">
                              {need.title}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {need.location} • {need.verifiedBy} • {need.eta}
                            </p>
                          </div>
                          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                            {need.summary}
                          </p>
                        </div>

                        <div className="rounded-[20px] border border-border bg-background p-4 xl:min-w-[240px]">
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Allocation status
                          </p>
                          <p className="mt-3 text-3xl font-black text-foreground">
                            {formatCurrency(remaining)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Remaining of {formatCurrency(need.fundingGoal)}
                          </p>
                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-secondary"
                              initial={false}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.35 }}
                            />
                          </div>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                            {progress}% allocated
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-[20px] border border-border bg-background p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Cost breakdown
                          </p>
                          <div className="mt-3 space-y-3">
                            {need.costBreakdown.map((item) => (
                              <div
                                key={item.label}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3"
                              >
                                <span className="text-sm text-foreground">{item.label}</span>
                                <span className="text-sm font-bold text-foreground">
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col justify-between rounded-[20px] border border-border bg-background p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <ShieldCheck className="h-4 w-4 text-secondary" />
                              Verification highlights
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Verified for {need.households} citizens with a field
                              confirmation trail and direct delivery path.
                            </p>
                          </div>

                          <Button
                            className={need.fundedByYou ? "bg-secondary hover:bg-secondary/90" : ""}
                            onClick={() => pledgeMutation.mutate({ id: need.id })}
                            disabled={pledgeMutation.isPending}
                          >
                            {pledgeMutation.isPending ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : need.fundedByYou ? (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            ) : (
                              <BanknoteArrowUp className="mr-2 h-4 w-4" />
                            )}
                            {need.fundedByYou ? "Project authorized" : "Authorize & Allocate Funding"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            className="space-y-6"
          >
            <Card className="bg-card/95">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Badge variant="accent">Impact receipts</Badge>
                    <CardTitle className="mt-4 text-3xl">
                      Download board-ready PDFs
                    </CardTitle>
                  </div>
                  <div className="rounded-full bg-accent/10 p-3 text-accent">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                </div>
                <CardDescription className="mt-2 text-base">
                  Each receipt ties the original need to deployed resources and
                  verified outcomes for leadership review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence initial={false}>
                  {receipts.map((receipt) => (
                    <motion.div
                      key={receipt.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[24px] border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{receipt.receiptNumber}</Badge>
                        <Badge variant="accent">{receipt.date}</Badge>
                      </div>
                      <h3 className="mt-4 font-heading text-xl font-bold text-foreground">
                        {receipt.needTitle}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {receipt.location} • {formatCurrency(receipt.amount)}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {receipt.verifiedOutcome}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {receipt.resourcesDeployed.slice(0, 3).map((item) => (
                          <Badge
                            key={item}
                            variant="secondary"
                            className="normal-case tracking-normal"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-4">
                        <ReceiptDownloadButton receipt={receipt} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            <Card className="bg-[linear-gradient(180deg,#ffffff,#f6f8f1)]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Why finance teams like this</CardTitle>
                    <CardDescription>
                      The portal keeps funding clarity and reporting quality high.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Every listed need is verified before it appears on the board.",
                  "Cost lines make committee approval faster and less ambiguous.",
                  "Receipt PDFs can be attached directly to board and audit packs.",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                    <p className="text-sm leading-relaxed text-foreground">{item}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.aside>
        </section>
      </div>
    </main>
  );
}
