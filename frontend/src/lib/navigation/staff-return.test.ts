import { describe, expect, it } from "vitest";
import { allowedStaffDestination, validatedStaffReturn } from "./staff-return";
import type { SafeStaffProfile } from "@/lib/api/auth";

const staff = (role: SafeStaffProfile["role"]): SafeStaffProfile => ({ uid: role, emailVerified: true, role });

describe("staff return destinations", () => {
  it("keeps same-origin workspace paths and rejects open redirects", () => {
    expect(validatedStaffReturn("/csr-impact?recommendation=rec-1#policy")).toBe("/csr-impact?recommendation=rec-1#policy");
    for (const candidate of ["https://evil.example", "//evil.example", "/\\evil.example", "/command-center.evil", "/volunteer", "/csr-impact%2f%2fevil.example"]) {
      expect(validatedStaffReturn(candidate)).toBeUndefined();
    }
  });
  it("honors only destinations authorized by the verified role", () => {
    expect(allowedStaffDestination(staff("analyst"), "/csr-impact")).toBe("/command-center");
    expect(allowedStaffDestination(staff("policymaker"), "/csr-impact?recommendation=rec-1")).toBe("/csr-impact?recommendation=rec-1");
    expect(allowedStaffDestination(staff("csr_partner"), "/csr-impact#policy")).toBe("/csr-impact#projects");
    expect(allowedStaffDestination(staff("admin"), "//evil.example")).toBe("/command-center");
  });
});
