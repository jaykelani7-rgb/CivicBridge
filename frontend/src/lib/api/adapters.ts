import type { CitizenFormInput, CitizenStatus, CreateCitizenRequest, EvidenceBundleDto, HotspotDto, HotspotPage, HotspotViewModel, ImpactMetric, ProjectMetricViewModel, Recommendation, RecommendationViewModel } from "./types";

export function adaptCitizenRequest(input: CitizenFormInput): CreateCitizenRequest {
  if (!input.consentAccepted) throw new Error("Consent is required before submission.");
  return { channel: input.channel, country_code: input.country_code, language_hint: input.language_hint, location: input.location, administrative_area: input.administrative_area, text: input.text, consent: { accepted: true, version: "2026-08-01" } };
}

export function adaptCitizenStatus(status: CitizenStatus): CitizenStatus {
  return { ...status };
}

export function adaptHotspot(item: HotspotDto): HotspotViewModel {
  let warnings = item.warnings ?? [];
  if (!warnings.length && item.warnings_json) {
    try {
      const parsed: unknown = JSON.parse(item.warnings_json);
      if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) warnings = parsed;
    } catch { /* malformed warnings are omitted, not fabricated */ }
  }
  return {
    id: item.hotspot_id,
    countryCode: item.country_code,
    geographyId: item.geography_id,
    category: item.category,
    status: item.status,
    requestCount: item.request_count,
    uniqueRequestCount: item.unique_request_count,
    duplicateCount: item.suspected_duplicates,
    relatedCount: item.corroboration_count,
    affectedPopulation: item.affected_population,
    needScore: item.need_score,
    actionScore: item.action_score,
    evidenceConfidence: item.evidence_confidence,
    calculatedAt: item.calculated_at,
    evidenceBundleId: item.evidence_bundle_id ?? undefined,
    warnings,
    geography: item.geography,
    provenance: item.provenance,
    priority: item.priority,
    evidenceReadiness: item.evidence_readiness,
  };
}

export function adaptHotspotPage(input: { items: HotspotDto[]; pagination: { page: number; page_size: number; total: number; pages: number } }): HotspotPage {
  return {
    items: input.items.map(adaptHotspot),
    pagination: { page: input.pagination.page, pageSize: input.pagination.page_size, total: input.pagination.total, pages: input.pagination.pages },
  };
}

export function evidenceUsesDemoData(bundle: EvidenceBundleDto): boolean {
  return [...bundle.data_sources, ...(bundle.sources ?? [])].some((source) =>
    source.synthetic === true || source.synthetic === 1 || source.classification === "synthetic_demo"
  );
}

export function adaptRecommendation(item: Recommendation): RecommendationViewModel {
  return { id: item.recommendation_id, hotspotId: item.hotspot_id, title: item.title, status: item.status, confidencePercent: item.confidence == null ? null : Math.round(item.confidence * 100), evidenceCount: item.supporting_evidence_ids.length, humanApproved: item.human_approved };
}

export function adaptProjectMetric(item: ImpactMetric): ProjectMetricViewModel {
  const span = item.target == null || item.baseline == null ? null : item.target - item.baseline;
  const progress = span == null || span === 0 || item.current == null || item.baseline == null ? null : Math.max(0, Math.min(100, Math.round(((item.current - item.baseline) / span) * 100)));
  return { id: item.metric_id, code: item.metric_code, baseline: item.baseline, target: item.target, current: item.current, unit: item.unit, progressPercent: progress, sourceId: item.source_id, confidencePercent: item.confidence == null ? null : Math.round(item.confidence * 100) };
}

export function demoModeEnabled(value = process.env.NEXT_PUBLIC_DEMO_MODE): boolean { return value === "true"; }
