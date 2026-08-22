"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, LogIn, LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi, authKeys, type SafeStaffProfile } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { browserFirebaseAuth, emailPasswordSignInEnabled, firebaseClientConfigured } from "@/lib/firebase/client";

type AuthShellProps = { returnTo?: string; reason?: string };
const reasonCopy: Record<string, { title: string; message: string }> = {
  authentication_required: { title: "Staff sign-in required", message: "Sign in with an approved CivicBridge staff account to continue." },
  invalid_session: { title: "Invalid session", message: "Your session could not be verified. Sign in again." },
  expired_session: { title: "Session expired", message: "Your staff session expired. Sign in again to continue." },
  permission_denied: { title: "Permission denied", message: "Your verified account does not have the role required for that workspace." },
  signed_out: { title: "Signed out", message: "Your server session was cleared and revoked." },
};

function defaultWorkspace(user: SafeStaffProfile): string { return user.role === "analyst" ? "/command-center" : "/csr-impact"; }
function allowedDestination(user: SafeStaffProfile, returnTo?: string): string {
  if (!returnTo) return defaultWorkspace(user);
  if (returnTo.startsWith("/command-center") && ["analyst", "policymaker", "admin"].includes(user.role)) return returnTo;
  if (returnTo.startsWith("/csr-impact") && ["policymaker", "admin", "csr_partner"].includes(user.role)) return returnTo;
  return defaultWorkspace(user);
}

export function AuthShell({ returnTo, reason }: AuthShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const configured = firebaseClientConfigured();
  const emailEnabled = emailPasswordSignInEnabled();
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, retry: false, staleTime: 0 });
  const existingUser = session.data?.user;

  async function exchangeCredential(user: { getIdToken: (forceRefresh?: boolean) => Promise<string> }) {
    const auth = await browserFirebaseAuth();
    try {
      const idToken = await user.getIdToken(true);
      return await authApi.createSession(idToken);
    } finally { await signOut(auth); }
  }

  const googleMutation = useMutation({
    mutationFn: async () => {
      const auth = await browserFirebaseAuth();
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
      return exchangeCredential((await signInWithPopup(auth, provider)).user);
    },
    onSuccess: ({ user }) => { queryClient.setQueryData(authKeys.me, { user }); toast.success("Secure staff session created."); router.replace(allowedDestination(user, returnTo)); router.refresh(); },
    onError: (error) => toast.error(isApiError(error) ? error.message : error.message || "Google sign-in could not be completed."),
  });
  const emailMutation = useMutation({
    mutationFn: async () => { const auth = await browserFirebaseAuth(); return exchangeCredential((await signInWithEmailAndPassword(auth, email, password)).user); },
    onSuccess: ({ user }) => { setPassword(""); queryClient.setQueryData(authKeys.me, { user }); toast.success("Secure staff session created."); router.replace(allowedDestination(user, returnTo)); router.refresh(); },
    onError: (error) => { setPassword(""); toast.error(isApiError(error) ? error.message : "Email sign-in failed. Check the account and try again."); },
  });
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => { queryClient.removeQueries({ queryKey: authKeys.me }); toast.success("Signed out securely."); router.replace("/auth?reason=signed_out"); router.refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const pending = googleMutation.isPending || emailMutation.isPending;
  const message = reason ? reasonCopy[reason] : undefined;
  const sessionError = session.error;
  const denied = isApiError(sessionError) && sessionError.status === 403;
  const invalid = isApiError(sessionError) && sessionError.status === 401;

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10"><Card className="w-full overflow-hidden"><CardHeader className="space-y-4 bg-earth-glow"><Badge variant={existingUser ? "success" : "accent"} className="w-fit">{existingUser ? "Verified staff session" : "CivicBridge staff access"}</Badge><div className={`flex h-14 w-14 items-center justify-center rounded-full ${existingUser ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{existingUser ? <CheckCircle2 className="h-6 w-6"/> : <KeyRound className="h-6 w-6"/>}</div><CardTitle className="text-4xl">{existingUser ? "You are signed in securely." : "Sign in to a protected workspace."}</CardTitle><CardDescription>Citizen submissions remain public. Analyst, policymaker, admin, and CSR access uses verified Firebase session cookies and server-side custom role claims.</CardDescription></CardHeader><CardContent className="space-y-5 p-6">
    {message ? <StatusNotice title={message.title} message={message.message} warning={reason !== "signed_out"}/> : null}
    {session.isLoading ? <div aria-live="polite" className="space-y-3"><Skeleton className="h-5 w-40"/><Skeleton className="h-24"/></div> : existingUser ? <div className="space-y-4 rounded-2xl border border-success/25 bg-success/5 p-5"><div><p className="font-semibold">{existingUser.displayName ?? existingUser.email ?? "CivicBridge staff member"}</p><p className="mt-1 text-sm text-muted-foreground">Role: {existingUser.role.replaceAll("_", " ")}</p></div><div className="flex flex-wrap gap-3"><Button onClick={() => router.push(allowedDestination(existingUser, returnTo))}>Continue to workspace</Button><Button variant="outline" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>{logoutMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4"/>}Sign out</Button></div></div> : <>
      {denied ? <StatusNotice title="Permission denied" message={sessionError.message} warning/> : invalid && !message ? <StatusNotice title="Session unavailable" message={sessionError.message} warning/> : null}
      {!configured ? <StatusNotice title="Firebase web configuration required" message="Set the NEXT_PUBLIC_FIREBASE_* values in .env.local. No credentials or tokens should be committed." warning/> : <div className="space-y-4"><Button className="w-full" size="lg" disabled={pending} onClick={() => googleMutation.mutate()}>{googleMutation.isPending ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/> : <LogIn className="mr-2 h-5 w-5"/>}Continue with Google</Button>
        {emailEnabled ? <div className="space-y-4 border-t border-border pt-4"><p className="text-sm font-semibold">Email and password</p><div className="space-y-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)}/></div><div className="space-y-2"><Label htmlFor="staff-password">Password</Label><Input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></div><Button variant="outline" className="w-full" disabled={pending || !email || !password} onClick={() => emailMutation.mutate()}>{emailMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}Sign in with email</Button></div> : null}
      </div>}
    </>}
    <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground"><ShieldAlert className="mr-2 inline h-4 w-4 text-accent"/>Tokens are exchanged immediately for an HttpOnly server session and are not stored in localStorage or Zustand.</div><Button asChild variant="ghost"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Return home</Link></Button>
  </CardContent></Card></main>;
}

function StatusNotice({ title, message, warning }: { title: string; message: string; warning?: boolean }) { return <div role="status" className={`rounded-2xl border p-4 ${warning ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}`}><div className="flex items-center gap-2 font-semibold">{warning ? <AlertTriangle className="h-4 w-4 text-warning"/> : <CheckCircle2 className="h-4 w-4 text-success"/>}{title}</div><p className="mt-1 text-sm text-muted-foreground">{message}</p></div>; }
