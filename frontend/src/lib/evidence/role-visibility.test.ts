import { describe, expect, it } from "vitest";
import { evidenceVisibilityForRole } from "./role-visibility";

describe("evidence role presentation", () => {
  it("keeps analyst and admin audit fields while limiting policymaker technical identifiers", () => {
    expect(evidenceVisibilityForRole("analyst").technicalComponents).toBe(true);
    expect(evidenceVisibilityForRole("admin").formulaDiagnostics).toBe(true);
    expect(evidenceVisibilityForRole("policymaker").technicalComponents).toBe(false);
  });

  it("does not present the internal workspace to CSR partners", () => {
    expect(evidenceVisibilityForRole("csr_partner").workspace).toBe(false);
  });
});
