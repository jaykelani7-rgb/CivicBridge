export type InboundMessageKind = "text" | "image" | "audio" | "mixed" | "unknown";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ExplainabilityEvidence {
  summary: string;
  data_points: string[];
}

export interface JobEnvelope {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  created_at: string;
}

export interface TwilioWebhookAck {
  accepted: boolean;
  source: "WHATSAPP";
  message_kind: InboundMessageKind;
  normalized_event_id: string;
  queued_for_processing: boolean;
}

export interface VoiceTranscriptionRequest {
  report_id?: string;
  media_url: string;
  language_hint?: string;
  duration_seconds?: number;
  location_hint?: GeoPoint;
  source: "WHATSAPP" | "VOICE" | "MANUAL";
}

export interface VoiceTranscriptionResponse extends JobEnvelope {
  transcript: string;
  detected_language: string;
  confidence_score: number;
  source: "WHISPER";
  media_duration_seconds?: number;
}

export interface NeedCandidate {
  title: string;
  summary: string;
  category: string;
  urgency_score: number;
  beneficiary_count_hint?: number;
  tags: string[];
  location?: GeoPoint;
}

export interface NeedExtractionRequest {
  report_id?: string;
  transcript: string;
  language?: string;
  source: "WHATSAPP" | "VOICE" | "MANUAL";
  location_hint?: GeoPoint;
}

export interface NeedExtractionResponse extends JobEnvelope {
  normalized_text: string;
  needs_review: boolean;
  confidence_score: number;
  candidate: NeedCandidate;
  explainability: ExplainabilityEvidence;
}

export interface OCRExtractionRequest {
  report_id?: string;
  image_url: string;
  language_hint?: string;
  script_hint?: string;
  source: "WHATSAPP" | "OCR" | "MANUAL";
}

export interface OCRField {
  name: string;
  value: string;
  confidence_score: number;
}

export interface OCRExtractionResponse extends JobEnvelope {
  engine: string;
  detected_language?: string;
  confidence_score: number;
  needs_review: boolean;
  extracted_text: string;
  parsed_fields: OCRField[];
  explainability: ExplainabilityEvidence;
}

export interface OCRReviewRequest {
  extraction_id: string;
  approved: boolean;
  reviewer_user_id: string;
  review_notes?: string;
}

export interface DecayRecalculationRequest {
  run_reason: "scheduler" | "manual" | "backfill";
  triggered_by?: string;
  open_need_ids: string[];
  as_of?: string;
}

export interface DecayNeedUpdate {
  need_id: string;
  previous_heat_score: number;
  recalculated_heat_score: number;
  decay_state: "fresh" | "warming" | "cooling";
  severity_weight: number;
  elapsed_minutes: number;
}

export interface DecayRecalculationResponse extends JobEnvelope {
  processed_count: number;
  interval_minutes: number;
  updates: DecayNeedUpdate[];
}
