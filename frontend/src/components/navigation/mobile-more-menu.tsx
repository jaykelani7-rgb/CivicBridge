"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accessibility, CircleHelp, Languages, LockKeyhole, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi, authKeys } from "@/lib/api/auth";

export function MobileMoreMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locale, setLocale } = usePublicLocale();
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, retry: false, staleTime: 60_000 });
  const user = session.data?.user;
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: async () => { queryClient.removeQueries({ queryKey: ["auth"] }); router.replace("/auth?reason=signed_out"); router.refresh(); } });
  return <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <p className="text-sm font-black uppercase tracking-[0.16em] text-[#004E72]">CivicBridge settings</p><h1 className="mt-3 font-heading text-[clamp(2.25rem,9vw,4rem)] font-black leading-none text-[#092634]">More</h1>
    {user ? <Card className="mt-7"><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5"/>Staff profile</CardTitle><CardDescription>{user.displayName ?? user.email ?? "Verified CivicBridge staff member"}</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4"><span className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-[#004E72]"/>Verified role</span><span className="capitalize">{user.role.replace("_", " ")}</span></div></CardContent></Card> : null}
    <div className="mt-5 grid gap-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5"/>Language</CardTitle></CardHeader><CardContent><label className="sr-only" htmlFor="more-locale">Language</label><select id="more-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Accessibility className="h-5 w-5"/>Accessibility preferences</CardTitle><CardDescription>CivicBridge uses one high-contrast light interface. Motion automatically follows your device’s reduced-motion preference.</CardDescription></CardHeader></Card>
      <Card id="help"><CardHeader><CardTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5"/>Help</CardTitle><CardDescription>Citizen reports stay public-safe. Staff workspaces require a verified role and all decisions remain server-authorized.</CardDescription></CardHeader></Card>
      {!user ? <Card id="privacy"><CardHeader><CardTitle>Privacy</CardTitle><CardDescription>CivicBridge public pages show aggregated administrative geography, never exact citizen locations or private reports.</CardDescription></CardHeader></Card> : null}
    </div>
    <div className="mt-5">{user ? <Button className="min-h-11 w-full" variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut className="mr-2 h-5 w-5"/>{logout.isPending ? "Signing out…" : "Sign out securely"}</Button> : <Button asChild className="min-h-11 w-full"><Link href="/auth"><LockKeyhole className="mr-2 h-5 w-5"/>Staff sign-in</Link></Button>}</div>
    {logout.isError ? <p role="alert" className="mt-3 text-sm text-destructive">Secure sign-out failed. Please try again.</p> : null}
  </main>;
}
