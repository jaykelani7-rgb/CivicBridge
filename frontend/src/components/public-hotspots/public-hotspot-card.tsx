"use client";

import { ArrowRight, MapPinned, MessagesSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import type { PublicHotspot } from "@/lib/api/types";

export function publicArea(item: PublicHotspot): string {
  return [item.administrative_area.locality, item.administrative_area.admin2, item.administrative_area.admin1].filter(Boolean).join(", ");
}

export function affectedHref(item: PublicHotspot): string {
  const query = new URLSearchParams({
    country: item.country_code,
    administrative_area: publicArea(item),
    category: item.category,
    source_hotspot: item.id,
  });
  return `/volunteer?${query}`;
}

export function PublicHotspotCard({ item, selected = false, onSelect }: { item: PublicHotspot; selected?: boolean; onSelect?: (id: string) => void }) {
  const { locale, t } = usePublicLocale();
  const exact = new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale === "hi" ? "hi-IN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.updated_at));
  const relative = formatRelative(item.updated_at, locale);
  const status = item.public_status === "under_review" ? t("governmentReview") : item.public_status === "project_active" ? t("projectActive") : item.public_status === "completed" ? t("completed") : t("monitoring");
  return <article data-no-ui-translation data-hotspot-id={item.id} className={`flex h-full min-w-0 flex-col rounded-md border bg-card p-5 transition-colors ${selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-accent/40"}`}>
    <div className="flex flex-wrap items-center gap-2"><Badge variant={item.priority_band === "high" ? "warning" : item.priority_band === "medium" ? "accent" : "secondary"}>{item.priority_band} {t("priority")}</Badge>{item.synthetic ? <Badge variant="info">{t("synthetic")}</Badge> : null}</div>
    <h3 className="mt-4 font-heading text-[28px] font-normal capitalize">{item.public_title}</h3>
    <p className="mt-2 flex items-start gap-2 text-base font-medium text-foreground"><MapPinned className="mt-0.5 h-4 w-4 shrink-0"/><span>{publicArea(item)}</span></p>
    <div className="mt-4 grid gap-2 text-sm"><p className="flex items-center gap-2 border-t border-border py-3"><MessagesSquare className="h-4 w-4 text-accent"/><strong>{item.request_count}</strong> {t("reports")}</p><p title={`${t("exactUpdated")}: ${exact}`} className="border-t border-border py-3"><span className="sr-only">{t("exactUpdated")}: {exact}. </span>{t("updated")} {relative}</p></div>
    <p className="mt-4 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-secondary"/>{t("status")}: {status}</p>
    <details className="mt-4 rounded-md border border-border px-4 py-3 text-sm"><summary className="cursor-pointer font-semibold">{t("howPrioritised")}</summary><p className="mt-2 text-muted-foreground">{t("priorityHelp")}</p></details>
    <div className="mt-auto grid gap-2 pt-4">{onSelect ? <Button type="button" variant="outline" onClick={() => onSelect(item.id)} className="w-full">{t("viewUpdate")}<ArrowRight className="ml-2 h-4 w-4"/></Button> : <Button asChild variant="outline" className="w-full"><Link href={`/hotspots?hotspot=${encodeURIComponent(item.id)}`}>{t("viewUpdate")}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button>}<Button asChild className="w-full"><Link href={affectedHref(item)}>{t("affected")}</Link></Button></div>
  </article>;
}

function formatRelative(value: string, locale: "en" | "hi" | "pt") {
  const deltaSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale === "pt" ? "pt-BR" : locale === "hi" ? "hi-IN" : "en", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
  for (const [unit, seconds] of ranges) if (Math.abs(deltaSeconds) >= seconds) return formatter.format(Math.round(deltaSeconds / seconds), unit);
  return formatter.format(deltaSeconds, "second");
}
