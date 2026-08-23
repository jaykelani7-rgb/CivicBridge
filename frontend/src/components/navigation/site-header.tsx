"use client";

import { HandHeart, LockKeyhole, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePublicLocale } from "@/components/providers/public-locale-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, setLocale, t } = usePublicLocale();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  const publicLinks = [{ href: "/", label: t("home") }, { href: "/hotspots", label: t("hotspots") }, { href: "/volunteer", label: t("submit") }];
  const staffLinks = [{ href: "/command-center", label: t("analyst") }, { href: "/csr-impact", label: t("policy") }];
  const current = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return <>
    <a href="#main-content" className="skip-link focus:clip-auto focus:left-4 focus:top-4 focus:z-[100] focus:h-auto focus:w-auto focus:rounded-lg focus:bg-card focus:px-4 focus:py-3">{t("skip")}</a>
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-lg">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg py-2" aria-label="CivicBridge AI home">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HandHeart className="h-5 w-5"/></span>
          <span className="min-w-0"><span className="block truncate font-heading text-lg font-black sm:text-xl">CivicBridge AI</span><span className="hidden text-xs text-muted-foreground sm:block">{t("brandTagline")}</span></span>
        </Link>
        <nav aria-label={t("publicNav")} className="hidden items-center gap-1 lg:flex">{publicLinks.map((link) => <Link key={link.href} href={link.href} aria-current={current(link.href) ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${current(link.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{link.label}</Link>)}</nav>
        <div className="hidden items-center gap-2 lg:flex"><label className="sr-only" htmlFor="header-locale">{t("language")}</label><select id="header-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-11 rounded-lg border border-border bg-card px-3 text-base"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select><Button asChild variant="outline"><Link href="/auth"><LockKeyhole className="mr-2 h-4 w-4"/>{t("staffNote")}</Link></Button></div>
        <div className="hidden items-center gap-2 md:flex lg:hidden"><Button ref={triggerRef} type="button" size="icon" variant="outline" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? t("menuClose") : t("menuOpen")} onClick={() => setOpen((value) => !value)}>{open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</Button></div>
      </div>
    </header>
    {open ? <div className="fixed inset-0 z-[60] bg-black/35 lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div ref={panelRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label={t("menuOpen")} className="ml-auto flex h-full w-[min(90vw,24rem)] flex-col overflow-y-auto bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"><div className="flex items-center justify-between"><p className="font-heading text-xl font-black">CivicBridge AI</p><Button size="icon" variant="ghost" aria-label={t("menuClose")} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X className="h-5 w-5"/></Button></div><p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("publicNav")}</p>{publicLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={current(link.href) ? "page" : undefined} className={`min-h-12 rounded-xl px-4 py-3 font-semibold ${current(link.href) ? "bg-muted" : "hover:bg-muted/60"}`}>{link.label}</Link>)}<p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("staffNav")}</p>{staffLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="min-h-12 rounded-xl px-4 py-3 hover:bg-muted/60"><LockKeyhole className="mr-2 inline h-4 w-4"/>{link.label}<span className="block pl-6 text-xs text-muted-foreground">{t("staffNote")}</span></Link>)}<label className="mb-2 mt-6 text-sm font-semibold" htmlFor="mobile-locale">{t("language")}</label><select id="mobile-locale" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-12 rounded-lg border border-border bg-background px-3 text-base"><option value="en">English</option><option value="hi">हिन्दी</option><option value="pt">Português</option></select></div></div> : null}
  </>;
}
