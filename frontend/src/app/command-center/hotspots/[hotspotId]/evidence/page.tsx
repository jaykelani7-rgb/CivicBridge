import { Suspense } from "react";
import { EvidenceScoringWorkspace } from "@/components/evidence/evidence-scoring-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export default async function EvidenceScoringPage({ params }: { params: Promise<{ hotspotId: string }> }) {
  const { hotspotId } = await params;
  return <Suspense fallback={<main className="min-h-screen bg-[#F9F9F9] p-6"><Skeleton className="mx-auto h-96 max-w-6xl"/></main>}><EvidenceScoringWorkspace hotspotId={hotspotId}/></Suspense>;
}
