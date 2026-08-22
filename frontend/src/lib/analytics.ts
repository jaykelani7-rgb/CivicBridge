declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type AnalyticsEvent = {
  event: string;
  category?: string;
  label?: string;
  destination?: string;
  value?: number;
};

export function trackEvent(payload: AnalyticsEvent) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function analyticsAttributes(event: AnalyticsEvent) {
  return {
    "data-analytics-event": event.event,
    "data-analytics-category": event.category,
    "data-analytics-label": event.label,
    "data-analytics-destination": event.destination,
  };
}
