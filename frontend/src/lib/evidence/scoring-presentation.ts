import type { EvidenceBundleDto, ScoreResponseDto } from "@/lib/api/types";

export const PRESENTATION_CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  moderate: 0.6,
} as const;

export type ConfidenceLabel = "High confidence" | "Moderate confidence" | "Limited confidence" | "Confidence unavailable";
export type InfluenceLabel = "Strong influence" | "Moderate influence" | "Limited influence" | "No measurable influence";

type ComponentCopy = { label: string; meaning: string };

export const SCORE_COMPONENT_COPY: Record<string, ComponentCopy> = {
  demand_rate: { label: "Demand rate", meaning: "Validated request volume relative to the available population value for this administrative area." },
  infrastructure_gap: { label: "Infrastructure gap", meaning: "The documented gap in infrastructure coverage supplied by the configured source." },
  severity: { label: "Reported severity", meaning: "Aggregated urgency from the privacy-safe normalized requests in this hotspot." },
  equity_vulnerability: { label: "Equity vulnerability", meaning: "The configured equity-vulnerability value for this administrative area." },
  affected_population: { label: "Affected population", meaning: "The population value associated with the administrative area in the configured source." },
  recent_trend: { label: "Recent trend", meaning: "Change in validated demand when at least 30 days of history is available." },
  evidence_confidence: { label: "Evidence confidence", meaning: "A composite of request and location confidence, completeness, freshness, source reliability, and corroboration." },
  strategic_alignment: { label: "Strategic alignment", meaning: "Alignment recorded in the available investment-planning evidence." },
  delivery_readiness: { label: "Delivery readiness", meaning: "Readiness recorded in the available investment-planning evidence." },
  data_confidence: { label: "Data confidence", meaning: "Completeness, freshness, and reliability of the configured supporting data." },
  existing_coverage_penalty: { label: "Existing coverage penalty", meaning: "A reduction applied when existing service coverage is already recorded for the area." },
};

export function componentCopy(name: string): ComponentCopy {
  return SCORE_COMPONENT_COPY[name] ?? {
    label: name.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
    meaning: "This component was supplied by the scoring service. No additional interpretation is available in the current contract.",
  };
}

export function confidenceLabel(value: number | null | undefined): ConfidenceLabel {
  if (value == null || !Number.isFinite(value)) return "Confidence unavailable";
  if (value >= PRESENTATION_CONFIDENCE_THRESHOLDS.high) return "High confidence";
  if (value >= PRESENTATION_CONFIDENCE_THRESHOLDS.moderate) return "Moderate confidence";
  return "Limited confidence";
}

export function influenceLabel(contribution: number): InfluenceLabel {
  const absolute = Math.abs(contribution);
  if (absolute < 0.005) return "No measurable influence";
  if (absolute >= 10) return "Strong influence";
  if (absolute >= 5) return "Moderate influence";
  return "Limited influence";
}

export function sortedComponents(bundle: EvidenceBundleDto) {
  return [...bundle.score_explanation].sort((a, b) => Math.abs(b.weighted_contribution) - Math.abs(a.weighted_contribution));
}

export function isPenalty(name: string, contribution: number): boolean {
  return name.includes("penalty") || contribution < 0;
}

export function contributionText(name: string, value: number): string {
  if (isPenalty(name, value)) return Math.abs(value) < 0.005 ? "No penalty applied" : `Reduced the component score by ${Math.abs(value).toFixed(2)} points`;
  if (Math.abs(value) < 0.005) return "No measurable contribution";
  return `Added ${value.toFixed(2)} points`;
}

export function strongestInfluences(bundle: EvidenceBundleDto, count = 3) {
  return sortedComponents(bundle).filter((component) => !isPenalty(component.name, component.weighted_contribution) && component.weighted_contribution > 0).slice(0, count);
}

export function primaryWarning(bundle: EvidenceBundleDto): string | null {
  if (bundle.data_sources.some((source) => source.synthetic === true || source.synthetic === 1)) return "Demonstration data influenced this result and must not be treated as official statistics.";
  const fallback = bundle.score_explanation.find((component) => component.missing || component.fallback_used != null);
  if (fallback) return `${componentCopy(fallback.name).label} used an estimate and should be verified before approval.`;
  return bundle.known_limitations[0] ?? bundle.missing_information[0] ?? null;
}

export function groundedSummary(bundle: EvidenceBundleDto): string {
  const factors = strongestInfluences(bundle).map((component) => componentCopy(component.name).label.toLowerCase());
  const factorText = factors.length ? factors.join(factors.length > 1 ? factors.length === 2 ? " and " : ", " : "") : "the supplied scoring components";
  const warning = primaryWarning(bundle);
  return `The hotspot's strongest recorded influences are ${factorText}. Evidence is ${confidenceLabel(bundle.hotspot_snapshot.evidence_confidence).toLowerCase()}.${warning ? ` ${warning}` : ""}`;
}

export type Reconciliation = { supported: boolean; calculated?: number; difference?: number; withinTolerance?: boolean; formulaText: string };

export function reconcileActionScore(score: ScoreResponseDto, tolerance = 0.02): Reconciliation {
  if (score.score_version !== "priority-1.0.0") return { supported: false, formulaText: "This formula version is not documented by the current frontend." };
  const directNames = new Set(["strategic_alignment", "delivery_readiness", "data_confidence", "existing_coverage_penalty"]);
  const direct = score.components.filter((component) => directNames.has(component.name)).reduce((sum, component) => sum + component.weighted_contribution, 0);
  const calculated = Math.max(0, Math.min(100, score.need_score * 0.6 + direct));
  const difference = Math.abs(calculated - score.action_score);
  return {
    supported: true,
    calculated,
    difference,
    withinTolerance: difference <= tolerance,
    formulaText: `60% of Need Score (${(score.need_score * 0.6).toFixed(2)}) plus supplied direct Action contributions and penalties (${direct.toFixed(2)})`,
  };
}

export function presentationDecisionReadiness(bundle: EvidenceBundleDto): "Ready for review" | "Review with caution" | "Insufficient evidence" {
  if (bundle.hotspot_snapshot.evidence_confidence < 0.4 || bundle.score_explanation.every((component) => component.missing)) return "Insufficient evidence";
  if (primaryWarning(bundle)) return "Review with caution";
  return "Ready for review";
}

export type LimitationGroup = "Evidence completeness" | "Geographic precision" | "Data recency" | "Estimated/fallback values" | "Synthetic/demo status" | "Methodological limitations";

export function limitationGroup(text: string): LimitationGroup {
  const value = text.toLowerCase();
  if (value.includes("synthetic") || value.includes("demo")) return "Synthetic/demo status";
  if (value.includes("spatial") || value.includes("centroid") || value.includes("geograph")) return "Geographic precision";
  if (value.includes("recent") || value.includes("trend") || value.includes("stale") || value.includes("date")) return "Data recency";
  if (value.includes("fallback") || value.includes("missing") || value.includes("estimate")) return "Estimated/fallback values";
  if (value.includes("evidence") || value.includes("summary")) return "Evidence completeness";
  return "Methodological limitations";
}
