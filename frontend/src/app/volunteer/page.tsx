import { Suspense } from "react";
import { SiteHeader } from "@/components/navigation/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { VolunteerShell } from "@/components/volunteer/volunteer-shell";

export default function VolunteerPage() {
  return <><SiteHeader/><Suspense fallback={<main className="mx-auto max-w-3xl p-4"><Skeleton className="h-[40rem] rounded-3xl"/></main>}><VolunteerShell /></Suspense></>;
}
