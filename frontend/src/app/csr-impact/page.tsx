import { CSRImpactShell } from "@/components/csr-impact/csr-impact-shell";

export default async function CSRImpactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  // Navigation context only. Existing BFF authorization and validation govern all mutations.
  return <CSRImpactShell context={{ hotspotId: value("hotspot"), bundleId: value("evidence"), title: value("title"), recommendationId: value("recommendation") }}/>;
}
