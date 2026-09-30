import { HotspotDetailWorkspace } from "@/components/evidence/hotspot-detail-workspace";

export default async function HotspotDetailPage({ params }: { params: Promise<{ hotspotId: string }> }) {
  const { hotspotId } = await params;
  return <HotspotDetailWorkspace hotspotId={hotspotId}/>;
}
