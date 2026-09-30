import type { SafeStaffProfile } from "@/lib/api/auth";

type Role = SafeStaffProfile["role"];

export function staffWorkspaces(role: Role) {
  const analyst = [
    { href: "/command-center#overview", label: "Analyst overview" },
    { href: "/command-center#review", label: "AI review" },
    { href: "/command-center#hotspots", label: "Hotspots and evidence" },
  ];
  const policy = [
    { href: "/csr-impact#policy", label: "Recommendations" },
    { href: "/csr-impact#projects", label: "Projects" },
    { href: "/csr-impact#impact", label: "Impact" },
  ];
  if (role === "analyst") return analyst;
  if (role === "csr_partner") return policy.slice(1);
  return [...analyst, ...policy];
}

export function defaultStaffWorkspace(role: Role) {
  return role === "csr_partner" ? "/csr-impact#projects" : "/command-center#overview";
}
