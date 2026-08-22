"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe2,
  HeartHandshake,
  Languages,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { type UserRole, useOnboardingStore } from "@/store/onboarding-store";

const roleOptions: Array<{
  role: UserRole;
  title: string;
  description: string;
}> = [
  {
    role: "VOLUNTEER",
    title: "Citizen / Surveyor",
    description: "Record voice notes or submit text reports of local municipal issues.",
  },
  {
    role: "FIELD_WORKER",
    title: "Field Auditor",
    description: "Inspect physical wards, audit infrastructure indicators, and confirm resolution.",
  },
  {
    role: "COORDINATOR",
    title: "Government Analyst",
    description: "Verify normalized AI extractions, manage review queues, and validate details.",
  },
  {
    role: "ADMIN",
    title: "System Administrator",
    description: "Manage localized country config packs, boundary coordinate maps, and schemas.",
  },
  {
    role: "CSR_DONOR",
    title: "Policymaker / Partner",
    description: "Fund infrastructure projects, review generated project briefs, and approve plans.",
  },
];

const suggestedSkills = [
  "Water Access",
  "Sanitation",
  "Roads & Potholes",
  "Drainage repair",
  "Electricity supply",
  "Internet connectivity",
  "Waste management",
  "Emergency medical",
];

const suggestedLanguages = [
  "English",
  "Hindi",
  "Portuguese",
  "Zulu",
  "Xhosa",
  "Afrikaans",
  "Russian",
  "Chinese",
];

const impactStats = [
  { label: "Active hotspots", value: "38" },
  { label: "Surveyors online", value: "142" },
  { label: "Avg processing time", value: "4.2s" },
];

function addUniqueValue(list: string[], value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return list;
  }

  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return list;
  }

  return [...list, trimmed];
}

type TagPickerProps = {
  title: string;
  description: string;
  value: string[];
  suggestions: string[];
  onChange: (value: string[]) => void;
};

function TagPicker({
  title,
  description,
  value,
  suggestions,
  onChange,
}: TagPickerProps) {
  const [customValue, setCustomValue] = useState("");

  function commitCustomValue() {
    if (!customValue.trim()) {
      return;
    }

    onChange(addUniqueValue(value, customValue));
    setCustomValue("");
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/80 p-4">
      <div className="space-y-1">
        <Label>{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((item) => {
          const selected = value.includes(item);

          return (
            <button
              key={item}
              type="button"
              onClick={() =>
                onChange(
                  selected
                    ? value.filter((entry) => entry !== item)
                    : [...value, item],
                )
              }
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                selected
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-border bg-background text-foreground hover:border-accent hover:text-accent",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitCustomValue();
            }
          }}
          placeholder={`Add custom ${title.toLowerCase()}`}
        />
        <Button type="button" variant="outline" onClick={commitCustomValue}>
          Add
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <Badge key={item} variant="secondary" className="normal-case tracking-normal">
              {item}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImpactShowcase() {
  return (
    <motion.section
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative hidden overflow-hidden rounded-[32px] border border-border bg-earth-glow p-8 shadow-soft lg:flex lg:min-h-[860px] lg:flex-col"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-70"
        viewBox="0 0 800 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M136 154C221 68 375 49 503 108C629 165 717 296 697 408C679 518 556 605 451 703C345 801 257 910 172 885C87 860 4 700 17 542C31 386 50 239 136 154Z"
          fill="#E6A157"
          fillOpacity="0.1"
        />
        <path
          d="M651 186C704 266 716 385 674 469C633 551 538 595 462 649C387 704 332 771 258 782C184 792 91 746 62 664C31 581 60 464 112 367C164 270 239 191 333 148C427 105 598 106 651 186Z"
          fill="#6B8E23"
          fillOpacity="0.1"
        />
      </svg>

      <div className="relative z-10 flex h-full flex-col justify-between gap-10">
        <div className="space-y-5">
          <Badge variant="warning" className="w-fit">
            Governance impact login
          </Badge>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-black text-foreground xl:text-5xl">
              Build trust at the first touchpoint.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              CivicBridge AI starts with a calm, high-clarity onboarding flow so
              analysts, citizens, and policymakers can move with
              confidence from the first screen.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="bg-white/85">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Mission-aligned access</CardTitle>
                  <CardDescription>
                    Role-aware entry points reduce cognitive load and speed up
                    deployment readiness.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {impactStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-card/90 p-4"
                >
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="bg-white/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <HeartHandshake className="h-5 w-5 text-primary" />
                  Context-ready onboarding
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Surveyors add regional configurations upfront so spatial intake
                can be matched with localized admin needs.
              </CardContent>
            </Card>
            <Card className="bg-white/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="h-5 w-5 text-secondary" />
                  Secure policymaker setup
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Municipal sponsors are routed into a dedicated profile step for
                funding preferences, compliance, and reporting readiness.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export function AuthShell() {
  const router = useRouter();
  const { basic, mode, role, setMode, setRole, updateBasic, updateVolunteer, volunteer } =
    useOnboardingStore();

  const isVolunteerTrack = role === "VOLUNTEER" || role === "FIELD_WORKER";
  const activeRoleCopy = useMemo(
    () => roleOptions.find((option) => option.role === role),
    [role],
  );

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return true;
    },
    onSuccess: () => {
      if (role === "CSR_DONOR") {
        toast.success("Account details saved. Continue to policymaker profile setup.");
        router.push("/auth/csr-setup");
        return;
      }

      toast.success(
        isVolunteerTrack
          ? "Surveyor profile staged for regional analysis."
          : "Account created successfully. Your workspace is ready.",
      );
      router.push("/");
    },
    onError: () => {
      toast.error("We could not complete onboarding. Please try again.");
    },
  });

  const signInMutation = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return true;
    },
    onSuccess: () => {
      toast.success("Signed in successfully.");
      router.push("/");
    },
    onError: () => toast.error("Sign in failed. Please verify your details."),
  });

  function validateAndSubmit() {
    if (!basic.firstName.trim() || !basic.email.trim() || !basic.password.trim()) {
      toast.error("Please complete your name, email, and password first.");
      return;
    }

    if (isVolunteerTrack) {
      if (volunteer.skills.length === 0 || volunteer.languages.length === 0) {
        toast.error("Select at least one sector focus and one language.");
        return;
      }
    }

    createAccountMutation.mutate();
  }

  function validateSignIn() {
    if (!basic.email.trim() || !basic.password.trim()) {
      toast.error("Enter your email and password to continue.");
      return;
    }

    signInMutation.mutate();
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-6 px-5 py-6 lg:grid-cols-[1.18fr_0.82fr] lg:px-8 lg:py-8">
      <ImpactShowcase />

      <motion.section
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex min-h-[760px] flex-col justify-center rounded-[32px] border border-border bg-card px-5 py-6 shadow-soft sm:px-8 sm:py-8"
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back home
              </Link>
            </Button>
            <Badge variant="accent">Accessible onboarding</Badge>
          </div>

          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  mode === "signup"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  mode === "signin"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                Sign in
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl font-black text-foreground">
                {mode === "signup"
                  ? "Welcome to CivicBridge AI"
                  : "Continue your governance work"}
              </h2>
              <p className="text-muted-foreground">
                {mode === "signup"
                  ? "Choose how you contribute, then we will personalize the onboarding path."
                  : "Use your existing account to return to live operations, analyst updates, or municipal tasks."}
              </p>
            </div>
          </div>

          {mode === "signup" ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Role</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {roleOptions.map((option) => (
                    <button
                      key={option.role}
                      type="button"
                      onClick={() => setRole(option.role)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                        role === option.role
                          ? "border-accent bg-accent/8 shadow-sm"
                          : "border-border bg-background hover:border-accent/60 hover:-translate-y-0.5 hover:shadow-sm",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-heading text-lg font-bold text-foreground">
                            {option.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        {role === option.role ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Card className="bg-background">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit">
                    {activeRoleCopy?.title ?? "Account"} track
                  </Badge>
                  <CardTitle className="text-3xl">Profile basics</CardTitle>
                  <CardDescription>
                    Start with the essentials and we will adapt the next step to
                    your selected role.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={basic.firstName}
                      onChange={(event) => updateBasic({ firstName: event.target.value })}
                      placeholder="Ananya"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={basic.lastName}
                      onChange={(event) => updateBasic({ lastName: event.target.value })}
                      placeholder="Iyer"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={basic.email}
                      onChange={(event) => updateBasic({ email: event.target.value })}
                      placeholder="name@organization.org"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={basic.phone}
                      onChange={(event) => updateBasic({ phone: event.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={basic.password}
                      onChange={(event) => updateBasic({ password: event.target.value })}
                      placeholder="Create a secure password"
                    />
                  </div>
                </CardContent>
              </Card>

              <AnimatePresence mode="wait">
                {isVolunteerTrack ? (
                  <motion.div
                    key="volunteer-setup"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    <Card className="bg-background">
                      <CardHeader>
                        <Badge variant="success" className="w-fit">
                          Surveyor profile
                        </Badge>
                        <CardTitle className="text-3xl">
                          Sectors and language fluency
                        </CardTitle>
                        <CardDescription>
                          These details map reported issues to the correct municipal division.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <TagPicker
                          title="Sectors"
                          description="Highlight infrastructure sectors you focus on."
                          value={volunteer.skills}
                          suggestions={suggestedSkills}
                          onChange={(skills) => updateVolunteer({ skills })}
                        />
                        <TagPicker
                          title="Languages"
                          description="Add spoken languages for voice intake transcribing."
                          value={volunteer.languages}
                          suggestions={suggestedLanguages}
                          onChange={(languages) => updateVolunteer({ languages })}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="availability">Area notes</Label>
                          <Textarea
                            id="availability"
                            value={volunteer.availability}
                            onChange={(event) =>
                              updateVolunteer({ availability: event.target.value })
                            }
                            placeholder="Assigned municipal wards, preferred contact channels, or travel limitations."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : role === "CSR_DONOR" ? (
                  <motion.div
                    key="donor-setup"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card className="bg-background">
                      <CardHeader>
                        <Badge variant="accent" className="w-fit">
                          Policymaker route
                        </Badge>
                        <CardTitle className="text-3xl">
                          You will continue to agency setup next
                        </CardTitle>
                        <CardDescription>
                          We separate policymaker onboarding so agency details,
                          administrative bounds, and priority parameters can be captured
                          without cluttering the sign-up form.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-border bg-card p-4">
                          <UsersRound className="h-5 w-5 text-secondary" />
                          <p className="mt-3 text-sm text-muted-foreground">
                            Agency profile
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <Globe2 className="h-5 w-5 text-accent" />
                          <p className="mt-3 text-sm text-muted-foreground">
                            Regional priority bounds
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4">
                          <Languages className="h-5 w-5 text-primary" />
                          <p className="mt-3 text-sm text-muted-foreground">
                            Audit-ready decision logs
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Button
                onClick={validateAndSubmit}
                className="w-full"
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {role === "CSR_DONOR"
                  ? "Continue to agency setup"
                  : "Create account"}
              </Button>
            </div>
          ) : (
            <Card className="bg-background">
              <CardHeader>
                <Badge variant="info" className="w-fit">
                  Return to platform
                </Badge>
                <CardTitle className="text-3xl">Sign in securely</CardTitle>
                <CardDescription>
                  Resume dispatch, triage, or reporting from where you left off.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={basic.email}
                    onChange={(event) => updateBasic({ email: event.target.value })}
                    placeholder="name@organization.org"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={basic.password}
                    onChange={(event) => updateBasic({ password: event.target.value })}
                    placeholder="Enter your password"
                  />
                </div>
                <Button
                  onClick={validateSignIn}
                  className="w-full"
                  disabled={signInMutation.isPending}
                >
                  {signInMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Sign in
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </motion.section>
    </main>
  );
}
