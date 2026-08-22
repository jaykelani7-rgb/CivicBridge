"use client";

import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboardingStore } from "@/store/onboarding-store";

const fundingFocusSuggestions = [
  "Nutrition",
  "Medical relief",
  "Shelter",
  "Women and children",
  "Climate resilience",
  "Education continuity",
];

export function CSRSetupShell() {
  const router = useRouter();
  const { basic, donor, reset, updateDonor } = useOnboardingStore();

  const finishMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return true;
    },
    onSuccess: () => {
      updateDonor({ setupComplete: true });
      toast.success("Corporate donor profile is ready for funding workflows.");
      reset();
      router.push("/");
    },
    onError: () => {
      toast.error("Corporate setup could not be completed. Please retry.");
    },
  });

  function toggleFundingFocus(item: string) {
    const nextValue = donor.fundingFocus.includes(item)
      ? donor.fundingFocus.filter((entry) => entry !== item)
      : [...donor.fundingFocus, item];

    updateDonor({ fundingFocus: nextValue });
  }

  function submit() {
    if (!basic.email.trim()) {
      toast.error("Start from the account step so we can tie this company to a user.");
      return;
    }

    if (!donor.companyName.trim() || donor.fundingFocus.length === 0) {
      toast.error("Add your company and at least one funding focus to continue.");
      return;
    }

    finishMutation.mutate();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/auth">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to auth
          </Link>
        </Button>
        <Badge variant="accent">CSR profile setup</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="space-y-6"
        >
          <Card className="overflow-hidden bg-earth-glow">
            <CardHeader className="space-y-4">
              <Badge variant="warning" className="w-fit">
                Corporate onboarding
              </Badge>
              <CardTitle className="text-4xl">
                Set up the funding profile your leadership team can trust.
              </CardTitle>
              <CardDescription>
                This step captures organization details needed for targeted
                funding recommendations, governance, and board-ready reporting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-card/85 p-4">
                <p className="text-sm text-muted-foreground">Primary contact</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {basic.firstName || "CSR lead"} {basic.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{basic.email || "No email yet"}</p>
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-card/85 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/12 text-secondary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Impact-ready setup</p>
                    <p className="text-sm text-muted-foreground">
                      Funding preferences here will feed the verified needs board.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: "easeOut" }}
        >
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Company details
              </Badge>
              <CardTitle className="text-3xl">Corporate profile setup</CardTitle>
              <CardDescription>
                We will use this information to tailor verified needs, cost
                breakdowns, and impact receipt content for your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  value={donor.companyName}
                  onChange={(event) => updateDonor({ companyName: event.target.value })}
                  placeholder="Asterion Industries"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={donor.department}
                  onChange={(event) => updateDonor({ department: event.target.value })}
                  placeholder="CSR and Sustainability"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-size">Company size</Label>
                <Input
                  id="company-size"
                  value={donor.companySize}
                  onChange={(event) => updateDonor({ companySize: event.target.value })}
                  placeholder="2,500 employees"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Funding focus areas</Label>
                <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-background p-4">
                  {fundingFocusSuggestions.map((item) => {
                    const selected = donor.fundingFocus.includes(item);

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleFundingFocus(item)}
                        className={
                          selected
                            ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-all"
                            : "rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-all hover:border-accent hover:text-accent"
                        }
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Funding notes</Label>
                <Textarea
                  id="notes"
                  value={donor.companySize ? `${donor.companySize} workforce aligned to regional impact goals.` : ""}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
              <Button
                onClick={submit}
                className="sm:col-span-2"
                disabled={finishMutation.isPending}
              >
                {finishMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="mr-2 h-4 w-4" />
                )}
                Complete corporate setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </main>
  );
}
