import type { SafeStaffProfile } from "@/lib/api/auth";

const base = "https://civicbridge.local";

export function validatedStaffReturn(candidate?: string): string | undefined {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return undefined;
  try {
    const url = new URL(candidate, base);
    if (url.origin !== base || !/^\/(command-center|csr-impact)(?:\/|$)/.test(url.pathname)) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return undefined; }
}

export function allowedStaffDestination(user: SafeStaffProfile, returnTo?: string): string {
  const destination = validatedStaffReturn(returnTo);
  const fallback = user.role === "csr_partner" ? "/csr-impact#projects" : "/command-center";
  if (!destination) return fallback;
  if (destination.startsWith("/command-center") && ["analyst", "policymaker", "admin"].includes(user.role)) return destination;
  if (destination.startsWith("/csr-impact") && ["policymaker", "admin"].includes(user.role)) return destination;
  if (destination.startsWith("/csr-impact") && user.role === "csr_partner") return "/csr-impact#projects";
  return fallback;
}
