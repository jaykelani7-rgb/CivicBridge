import type { StaffRole } from "@/lib/navigation/mobile-navigation";

export type EvidenceVisibility = {
  workspace: boolean;
  technicalComponents: boolean;
  internalCitizenEvidence: boolean;
  formulaDiagnostics: boolean;
};

export const evidenceVisibilityByRole: Record<StaffRole, EvidenceVisibility> = {
  analyst: { workspace: true, technicalComponents: true, internalCitizenEvidence: true, formulaDiagnostics: false },
  policymaker: { workspace: true, technicalComponents: false, internalCitizenEvidence: true, formulaDiagnostics: false },
  admin: { workspace: true, technicalComponents: true, internalCitizenEvidence: true, formulaDiagnostics: true },
  csr_partner: { workspace: false, technicalComponents: false, internalCitizenEvidence: false, formulaDiagnostics: false },
};

export function evidenceVisibilityForRole(role: StaffRole): EvidenceVisibility { return evidenceVisibilityByRole[role]; }
