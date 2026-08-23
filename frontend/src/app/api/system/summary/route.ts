import { NextRequest } from "next/server";
import { cloudRunRequest } from "@/lib/server/cloud-run-client";
import { routeError, success } from "@/lib/server/route-response";

type CitizenSummary = { reports_received: number; updated_at: string; provenance: "live" };
type IntelligenceSummary = { normalized: number; clustered: number; active_priorities: number; updated_at: string | null; provenance: "live" | "synthetic" };
type Project = { status?: string };

export async function GET(request: NextRequest) {
  try {
    const [citizen, intelligence, projects] = await Promise.all([
      cloudRunRequest<CitizenSummary>({ service: "citizen", path: "/v1/summary", signal: request.signal }),
      cloudRunRequest<IntelligenceSummary>({ service: "intelligence", path: "/v1/summary", signal: request.signal }),
      cloudRunRequest<Project[]>({ service: "policy", path: "/v1/projects", signal: request.signal }),
    ]);
    const underway = projects.data.filter((project) => !["completed", "cancelled", "rejected"].includes(project.status ?? "")).length;
    return success({
      reports_received: citizen.data.reports_received,
      normalized: intelligence.data.normalized,
      clustered: intelligence.data.clustered,
      active_priorities: intelligence.data.active_priorities,
      projects_underway: underway,
      provenance: intelligence.data.provenance,
      updated_at: intelligence.data.updated_at ?? citizen.data.updated_at,
    }, intelligence.traceId);
  } catch (error) { return routeError(error); }
}
