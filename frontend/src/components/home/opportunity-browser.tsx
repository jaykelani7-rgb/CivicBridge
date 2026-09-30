"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { publicHotspotApi, publicHotspotKeys } from "@/lib/api/public-hotspots";
import { usePublicLocale } from "@/components/providers/public-locale-provider";
import { PublicHotspotCard } from "@/components/public-hotspots/public-hotspot-card";

export function HotspotBrowser() {
  const { t } = usePublicLocale();
  const filters = { page: 1, page_size: 6 };
  const query = useQuery({ queryKey: publicHotspotKeys.list(filters), queryFn: () => publicHotspotApi.list(filters) });
  if (query.isLoading) return <div role="status" aria-label={t("loading")} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((item) => <Skeleton key={item} className="h-80 rounded-2xl"/>)}</div>;
  if (query.isError) return <Card><CardContent className="p-6"><AlertTriangle className="h-5 w-5 text-warning"/><p className="mt-3 font-semibold">{t("unavailable")}</p><p className="mt-1 text-sm text-muted-foreground">{t("hotspotUnavailableBody")}</p><Button size="sm" className="mt-3" onClick={() => void query.refetch()}>{t("retry")}</Button></CardContent></Card>;
  if (!query.data?.items.length) return <Card><CardContent className="p-8 text-center"><p className="font-semibold">{t("emptyTitle")}</p><p className="mt-1 text-sm text-muted-foreground">{t("hotspotEmptyBody")}</p></CardContent></Card>;
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.items.slice(0, 3).map((item) => <PublicHotspotCard key={item.id} item={item}/>)}</div><Button asChild variant="outline"><Link href="/hotspots">{t("allHotspots")}<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div>;
}
