import { describe, expect, it } from "vitest";
import { confidenceLabel, contributionText, influenceLabel, reconcileActionScore } from "./scoring-presentation";

describe("scoring presentation", () => {
  it("uses documented presentation-only confidence labels", () => {
    expect(confidenceLabel(.8)).toBe("High confidence");
    expect(confidenceLabel(.6)).toBe("Moderate confidence");
    expect(confidenceLabel(.2)).toBe("Limited confidence");
    expect(confidenceLabel(undefined)).toBe("Confidence unavailable");
  });

  it("describes positive, negative, and zero contributions without misleading signs", () => {
    expect(influenceLabel(12.6)).toBe("Strong influence");
    expect(contributionText("gap", 12.6)).toContain("Added 12.60");
    expect(contributionText("existing_coverage_penalty", -4.4)).toContain("Reduced");
    expect(contributionText("existing_coverage_penalty", 0)).toBe("No penalty applied");
  });

  it("reconciles the documented action formula and declines unknown versions", () => {
    const base = { hotspot_id: "h", need_score: 50, action_score: 45, evidence_confidence: .8, warnings: [], calculation_timestamp: "2026-08-22", history: [], change_since_previous: null };
    const component = (name: string, weighted_contribution: number) => ({ name, raw_value: 1, normalized_value: 1, weight: 1, weighted_contribution, source_ids: [], missing: false, fallback_used: null, confidence: 1, formula_version: "priority-1.0.0", calculated_at: "2026-08-22" });
    expect(reconcileActionScore({ ...base, score_version: "priority-1.0.0", components: [component("strategic_alignment", 16), component("delivery_readiness", 5), component("data_confidence", 4), component("existing_coverage_penalty", -10)] }).withinTolerance).toBe(true);
    expect(reconcileActionScore({ ...base, score_version: "future", components: [] }).supported).toBe(false);
  });
});
