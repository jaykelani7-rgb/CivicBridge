import type { LucideIcon } from "lucide-react";
import { BarChart3, ClipboardCheck, FileSearch, FolderKanban, Gauge, Home, MapPinned, MoreHorizontal, Route, Send, ShieldCheck } from "lucide-react";
import type { SafeStaffProfile } from "@/lib/api/auth";

export type StaffRole = SafeStaffProfile["role"];
export type MobileNavId = "home" | "explore" | "report" | "track" | "overview" | "hotspots" | "review" | "evidence" | "policy" | "projects" | "impact" | "more";
export type MobileNavItemConfig = { id: MobileNavId; label: string; href: string; icon: LucideIcon; primary?: boolean; reviewBadge?: boolean };

export const citizenNavigation = [
  { id: "home", label: "Home", href: "/", icon: Home },
  { id: "explore", label: "Explore", href: "/hotspots", icon: MapPinned },
  { id: "report", label: "Report", href: "/volunteer", icon: Send, primary: true },
  { id: "track", label: "Track", href: "/track", icon: Route },
  { id: "more", label: "More", href: "/more", icon: MoreHorizontal },
] as const satisfies readonly MobileNavItemConfig[];

const commandCenter = {
  overview: { id: "overview", label: "Overview", href: "/command-center#overview", icon: Gauge },
  hotspots: { id: "hotspots", label: "Hotspots", href: "/command-center#hotspots", icon: MapPinned },
  review: { id: "review", label: "Review", href: "/command-center#review", icon: ClipboardCheck, reviewBadge: true },
  evidence: { id: "evidence", label: "Evidence", href: "/command-center#evidence", icon: FileSearch },
} as const satisfies Record<string, MobileNavItemConfig>;
const policyWorkspace = {
  overview: { id: "overview", label: "Overview", href: "/csr-impact#overview", icon: Gauge },
  policy: { id: "policy", label: "Policy", href: "/csr-impact#policy", icon: ShieldCheck },
  projects: { id: "projects", label: "Projects", href: "/csr-impact#projects", icon: FolderKanban },
  impact: { id: "impact", label: "Impact", href: "/csr-impact#impact", icon: BarChart3 },
} as const satisfies Record<string, MobileNavItemConfig>;
const more = { id: "more", label: "More", href: "/more", icon: MoreHorizontal } as const satisfies MobileNavItemConfig;

export const staffNavigation: Record<StaffRole, readonly MobileNavItemConfig[]> = {
  analyst: [commandCenter.overview, commandCenter.hotspots, commandCenter.review, commandCenter.evidence, more],
  policymaker: [commandCenter.overview, commandCenter.review, policyWorkspace.policy, policyWorkspace.projects, policyWorkspace.impact],
  csr_partner: [policyWorkspace.overview, policyWorkspace.projects, policyWorkspace.impact, { id: "explore", label: "Explore", href: "/hotspots", icon: MapPinned }, more],
  admin: [commandCenter.overview, commandCenter.review, policyWorkspace.policy, policyWorkspace.projects, policyWorkspace.impact],
};

export function isMobileNavItemActive(item: MobileNavItemConfig, pathname: string, hash = ""): boolean {
  const [pathAndQuery, fragment = ""] = item.href.split("#");
  const path = pathAndQuery.split("?")[0] || "/";
  const normalizedHash = hash.replace(/^#/, "");
  const currentPath = pathname.split("?")[0] || "/";
  const pathMatches = path === "/" ? currentPath === "/" : currentPath === path || currentPath.startsWith(`${path}/`);
  if (!pathMatches) return false;
  if (path === "/command-center" && currentPath.startsWith("/command-center/hotspots/")) {
    if (currentPath.endsWith("/evidence")) return fragment === "evidence";
    return fragment === "hotspots";
  }
  if (fragment) return normalizedHash === fragment || (fragment === "overview" && !normalizedHash);
  return true;
}

export function navigationForRole(role?: StaffRole | null): readonly MobileNavItemConfig[] { return role ? staffNavigation[role] : citizenNavigation; }
export function formatReviewBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
