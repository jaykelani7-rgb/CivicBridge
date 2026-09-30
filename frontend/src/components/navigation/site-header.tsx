"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { authApi, authKeys } from "@/lib/api/auth";
import { defaultStaffWorkspace, staffWorkspaces } from "@/lib/navigation/staff-workspaces";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, retry: false, staleTime: 60_000 });
  const staff = session.data?.user;
  const workspaces = staff ? staffWorkspaces(staff.role) : [];
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: () => { queryClient.removeQueries({ queryKey: ["auth"] }); router.replace("/auth?reason=signed_out"); router.refresh(); } });
  const { locale, setLocale, t } = usePublicLocale();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--site-header-height", `${header.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update); observer.observe(header);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--site-header-height"); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button,select")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button,select,[tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const publicLinks = [ { href: "/hotspots", label: t("hotspots") }, { href: "/volunteer", label: t("reportIssue") }];
  const current = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return <>
    <a data-no-ui-translation href="#main-content" className="skip-link focus:clip-auto focus:left-4 focus:top-4 focus:z-[100] focus:h-auto focus:w-auto focus:rounded-lg focus:bg-card focus:px-4 focus:py-3">{t("skip")}</a>
    <header ref={headerRef} data-no-ui-translation className="sticky top-0 z-50 border-b border-border/80 bg-background">
      <div className="site-header-inner mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="site-brand flex min-w-0 items-center gap-3 rounded-lg py-2" aria-label="CivicBridge home">
          <span className="brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><svg viewBox="0 0 32 32" fill="none" className="h-7 w-7" aria-hidden="true"><path d="M3 23h26M7 23V9m18 14V9M7 10c5 11 13 11 18 0M12 17v6m8-6v6M3 27h26" stroke="currentColor" strokeWidth="1.5"/></svg></span>
          <span className="min-w-0"><span className="brand-name block truncate font-heading text-2xl font-normal sm:text-[28px]">CivicBridge</span><span className="hidden">{t("brandTagline")}</span></span>
        </Link>
        <nav aria-label={t("publicNav")} className="hidden items-center gap-1 lg:flex">{publicLinks.map((link) => <Link key={link.href} href={link.href} aria-current={current(link.href) ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${current(link.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{link.label}</Link>)}</nav>
        <div className="hidden items-center gap-2 lg:flex"><label className="sr-only" htmlFor="header-locale">{t("language")}</label><select id="header-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-11 rounded-lg border border-border bg-card px-3 text-base"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select>{session.isPending ? <span aria-label="Checking staff session" aria-busy="true" className="h-11 w-28 rounded-lg bg-muted"/> : staff ? <><Button asChild variant="ghost"><Link href={defaultStaffWorkspace(staff.role)}>Open workspace</Link></Button>{workspaces.length > 1 ? <details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold">Workspaces</summary><nav aria-label="Staff workspaces" className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-card p-2 shadow-xl">{workspaces.map((item) => <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">{item.label}</Link>)}</nav></details> : null}<details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold">Account</summary><div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-border bg-card p-3 shadow-xl"><p className="text-sm font-semibold">{staff.displayName ?? staff.email ?? "CivicBridge staff"}</p><p className="mt-1 text-xs capitalize text-muted-foreground">Verified role: {staff.role.replaceAll("_", " ")}</p><Button className="mt-3 w-full" variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button>{logout.isError ? <p role="alert" className="mt-2 text-xs text-destructive">Sign-out failed. Try again.</p> : null}</div></details></> : <Button asChild variant="ghost"><Link href="/auth"><LockKeyhole className="mr-2 h-4 w-4"/>{t("staffSignIn")}</Link></Button>}</div>
        <div className="mobile-header-tools flex items-center gap-2 lg:hidden"><label className="sr-only" htmlFor="header-mobile-locale">{t("language")}</label><select id="header-mobile-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="mobile-locale"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select><Button ref={triggerRef} type="button" size="icon" variant="outline" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? t("menuClose") : t("menuOpen")} onClick={() => setOpen((value) => !value)}>{open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</Button></div>
      </div>
    </header>
    {open ? <div className="fixed inset-0 z-[60] bg-black/35 lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div data-no-ui-translation ref={panelRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label={t("menuOpen")} className="ml-auto flex h-full w-[min(90vw,24rem)] flex-col overflow-y-auto bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"><div className="flex items-center justify-between"><p className="font-heading text-xl font-normal">CivicBridge</p><Button size="icon" variant="ghost" aria-label={t("menuClose")} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X className="h-5 w-5"/></Button></div><p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("publicNav")}</p>{publicLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={current(link.href) ? "page" : undefined} className={`min-h-12 rounded-xl px-4 py-3 font-semibold ${current(link.href) ? "bg-muted" : "hover:bg-muted/60"}`}>{link.label}</Link>)}<p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("staffNav")}</p>{session.isPending ? <p role="status" className="px-4 py-3 text-sm">Checking staff session…</p> : staff ? <><p className="px-4 text-sm capitalize text-muted-foreground">Verified role: {staff.role.replaceAll("_", " ")}</p><Link href={defaultStaffWorkspace(staff.role)} onClick={() => setOpen(false)} className="min-h-12 rounded-xl px-4 py-3 font-semibold">Open workspace</Link>{workspaces.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="min-h-12 rounded-xl px-4 py-3 hover:bg-muted/60">{link.label}</Link>)}<Button className="mt-3" variant="outline" disabled={logout.isPending} onClick={() => { setOpen(false); logout.mutate(); }}>Sign out</Button>{logout.isError ? <p role="alert" className="px-4 text-sm text-destructive">Sign-out failed. Try again.</p> : null}</> : <Link href="/auth" onClick={() => setOpen(false)} className="min-h-12 rounded-xl px-4 py-3">{t("staffSignIn")}</Link>}<label className="mb-2 mt-6 text-sm font-semibold" htmlFor="mobile-locale">{t("language")}</label><select id="mobile-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-12 rounded-lg border border-border bg-background px-3 text-base"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select></div></div> : null}
  </>;
}
