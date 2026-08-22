"use client";

import { ArrowLeft, KeyRound, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell() {
  return <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10"><Card className="w-full overflow-hidden"><CardHeader className="space-y-4 bg-earth-glow"><Badge variant="warning" className="w-fit">Configuration required</Badge><div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning"><ShieldAlert className="h-6 w-6"/></div><CardTitle className="text-4xl">Staff authentication is not configured in this repository.</CardTitle><CardDescription>CivicBridge no longer simulates account creation or sign-in. Citizen submissions remain public; analyst and policymaker API routes enforce authorization server-side.</CardDescription></CardHeader><CardContent className="space-y-5 p-6"><div className="rounded-2xl border border-border bg-background p-5"><p className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-accent"/>Owner setup required</p><p className="mt-2 text-sm text-muted-foreground">Provide a Firebase / Google Identity Platform project, configure the web client, issue custom role claims, and set FIREBASE_PROJECT_ID. Supported staff roles are analyst, policymaker, admin, and csr_partner.</p></div><p className="text-sm text-muted-foreground">For explicit local testing only, set STAFF_AUTH_MODE=development and NEXT_PUBLIC_CIVICBRIDGE_DEV_ROLE. Development authorization is rejected in production.</p><Button asChild variant="outline"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Return home</Link></Button></CardContent></Card></main>;
}
