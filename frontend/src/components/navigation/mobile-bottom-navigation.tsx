"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { authApi, authKeys } from "@/lib/api/auth";
import { normalizationApi, normalizationKeys } from "@/lib/api/normalization";
import { formatReviewBadge, isMobileNavItemActive, navigationForRole, type MobileNavItemConfig } from "@/lib/navigation/mobile-navigation";

const citizenLabels = { home: "home", explore: "navExplore", report: "navReport", track: "navTrack", more: "navMore" } as const;

function useCurrentHash() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => { window.removeEventListener("hashchange", update); window.removeEventListener("popstate", update); };
  }, []);
  return hash;
}

export function useMobileKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const focused = document.activeElement;
      const acceptsText = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || focused instanceof HTMLSelectElement || (focused instanceof HTMLElement && focused.isContentEditable);
      const covered = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setInset(acceptsText && covered > 150 ? covered : 0);
    };
    viewport?.addEventListener("resize", update);
    window.addEventListener("focusin", update);
    window.addEventListener("focusout", update);
    return () => { viewport?.removeEventListener("resize", update); window.removeEventListener("focusin", update); window.removeEventListener("focusout", update); };
  }, []);
  return inset;
}

export function useMobileKeyboardVisibility() { return useMobileKeyboardInset() > 0; }

function useBlockingOverlayVisibility() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(Boolean(document.querySelector('[aria-modal="true"], [data-mobile-nav-hidden="true"]')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "data-mobile-nav-hidden"] });
    return () => observer.disconnect();
  }, []);
  return visible;
}

export function MobileNavItem({ item, active, label, reviewCount, localized = false }: { item: MobileNavItemConfig; active: boolean; label: string; reviewCount?: number; localized?: boolean }) {
  const Icon = item.icon;
  const badge = item.reviewBadge ? formatReviewBadge(reviewCount ?? 0) : null;
  const accessibleLabel = badge ? `${label}, ${reviewCount} requests awaiting review.` : label;
  return <Link data-no-ui-translation={localized || undefined} href={item.href} scroll={false} aria-label={accessibleLabel} aria-current={active ? "page" : undefined} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center focus-visible:z-10 ${item.primary ? "bg-primary text-primary-foreground" : active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
    {active && !item.primary ? <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"/> : null}
    <span className="relative"><Icon aria-hidden="true" className={`h-5 w-5 ${active || item.primary ? "stroke-[2.5]" : "stroke-2"}`}/>{badge ? <span aria-hidden="true" className="absolute -right-3 -top-2 min-w-5 rounded-full bg-foreground px-1 text-[10px] font-black leading-5 text-primary-foreground">{badge}</span> : null}</span>
    <span className="max-w-full truncate text-[0.66rem] font-bold leading-tight sm:text-xs" title={label}>{label}</span>
  </Link>;
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const hash = useCurrentHash();
  const keyboardVisible = useMobileKeyboardVisibility();
  const overlayVisible = useBlockingOverlayVisibility();
  const { t } = usePublicLocale();
  const session = useQuery({ queryKey: authKeys.me, queryFn: authApi.me, retry: false, staleTime: 60_000 });
  const role = session.data?.user.role;
  const items = useMemo(() => navigationForRole(role), [role]);
  const canReview = role === "analyst" || role === "policymaker" || role === "admin";
  const reviews = useQuery({ queryKey: normalizationKeys.reviews, queryFn: normalizationApi.reviews, enabled: canReview, retry: false, staleTime: 60_000 });
  const hidden = keyboardVisible || overlayVisible;

  return <>
    <div aria-hidden="true" className={`h-[calc(4.75rem+env(safe-area-inset-bottom))] md:hidden ${hidden ? "hidden" : "block"}`}/>
    <nav aria-label="Primary mobile navigation" data-testid="mobile-bottom-navigation" className={`mobile-bottom-navigation fixed inset-x-0 bottom-0 z-[65] border-t border-border bg-background px-2 pt-1.5 shadow-[0_-4px_18px_rgba(9,38,52,0.08)] md:hidden ${hidden ? "hidden" : "block"}`} style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex h-[4.1rem] max-w-xl items-stretch gap-1 overflow-hidden">
        {session.isPending ? <div aria-label="Checking navigation access" aria-busy="true" className="grid w-full grid-cols-5 gap-1">{[0,1,2,3,4].map((item) => <span key={item} className="m-1 rounded-md bg-foreground/5"/>)}</div> : items.map((item) => {
          const labelKey = item.id in citizenLabels ? citizenLabels[item.id as keyof typeof citizenLabels] : null;
          const label = !role && labelKey ? t(labelKey) : item.label;
          return <MobileNavItem key={`${item.id}-${item.href}`} item={item} label={label} localized={!role} active={isMobileNavItemActive(item, pathname, hash)} reviewCount={reviews.data?.length}/>;
        })}
      </div>
    </nav>
  </>;
}
