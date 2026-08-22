export type CommandNeed = {
  id: string;
  title: string;
  locationName: string;
  category: string;
  status: "NEW" | "TRIAGED" | "ASSIGNED" | "IN_PROGRESS";
  urgencyLabel: "critical" | "high" | "elevated";
  urgencyScore: number;
  heatScore: number;
  decayState: "fresh" | "warming" | "cooling";
  reports: number;
  radiusKm: number;
  updatedMinutesAgo: number;
  x: number;
  y: number;
  summary: string;
  needs: string[];
  media: string[];
  aiReason: string;
  aiEvidence: string[];
};

export type SilentFeedItem = {
  id: string;
  headline: string;
  area: string;
  time: string;
  signal: string;
  detail: string;
  relatedNeedId?: string;
  severity: "high" | "watch" | "info";
};

export type OCRQueueItem = {
  id: string;
  district: string;
  language: string;
  extractedType: string;
  confidence: number;
  receivedAt: string;
  summary: string;
  fields: string[];
};

export const commandNeeds: CommandNeed[] = [
  {
    id: "need-1",
    title: "Flood-relief medical kits required",
    locationName: "Perungudi, Chennai",
    category: "Medical Relief",
    status: "NEW",
    urgencyLabel: "critical",
    urgencyScore: 94,
    heatScore: 98,
    decayState: "fresh",
    reports: 14,
    radiusKm: 3,
    updatedMinutesAgo: 12,
    x: 68,
    y: 24,
    summary:
      "Multiple neighborhood reports indicate fever cases and depleted first-aid stock at a temporary shelter cluster.",
    needs: ["120 medical kits", "2 triage volunteers", "ORS packets", "Pediatric support"],
    media: ["4 WhatsApp voice notes", "3 survey photos", "1 OCR form"],
    aiReason:
      "Linked to 14 WhatsApp reports in a 3km radius over 48h, plus two low-stock shelter logs and one verified field escalation.",
    aiEvidence: [
      "Voice transcripts mention fever, saline, and child-care urgency across 9 messages.",
      "Shelter inventory dipped below minimum threshold 4 hours ago.",
      "Local volunteer supply run was marked incomplete due to road blockage.",
    ],
  },
  {
    id: "need-2",
    title: "Clean drinking water tanker request",
    locationName: "Tambaram East",
    category: "Water Access",
    status: "TRIAGED",
    urgencyLabel: "high",
    urgencyScore: 87,
    heatScore: 89,
    decayState: "fresh",
    reports: 11,
    radiusKm: 2,
    updatedMinutesAgo: 27,
    x: 41,
    y: 46,
    summary:
      "Reported hand-pump contamination and queue overflow near a school relief point serving 350 residents.",
    needs: ["1 tanker deployment", "Water quality strips", "Queue management volunteers"],
    media: ["2 geo-tagged photos", "1 voice memo"],
    aiReason:
      "Spiking water-related keywords across clustered reports, matched against contamination history for the same ward.",
    aiEvidence: [
      "11 clustered reports reference smell, sediment, or unsafe water.",
      "The affected relief point supports 350+ people according to last verified count.",
      "Water tanker service SLA is at risk if not assigned inside the next 35 minutes.",
    ],
  },
  {
    id: "need-3",
    title: "Women-safe shelter overflow",
    locationName: "Velachery South",
    category: "Shelter",
    status: "ASSIGNED",
    urgencyLabel: "high",
    urgencyScore: 82,
    heatScore: 74,
    decayState: "warming",
    reports: 8,
    radiusKm: 4,
    updatedMinutesAgo: 61,
    x: 57,
    y: 58,
    summary:
      "An overflow shelter is nearing safe capacity and requires privacy partitions, hygiene kits, and night staff.",
    needs: ["Privacy dividers", "Night-shift field worker", "Hygiene kits"],
    media: ["2 OCR forms", "1 coordinator note"],
    aiReason:
      "Capacity threshold breached at 92%, reinforced by two paper intake forms and a field worker check-in.",
    aiEvidence: [
      "Shelter census increased by 28 residents since the last verified update.",
      "Two OCR forms include requests for women-only sanitation support.",
      "Existing assignment has not yet checked in on site.",
    ],
  },
  {
    id: "need-4",
    title: "Dry ration replenishment",
    locationName: "Mylapore West",
    category: "Food Security",
    status: "IN_PROGRESS",
    urgencyLabel: "elevated",
    urgencyScore: 73,
    heatScore: 51,
    decayState: "cooling",
    reports: 5,
    radiusKm: 2,
    updatedMinutesAgo: 144,
    x: 22,
    y: 39,
    summary:
      "Dry ration stock is trending low at a community kitchen but an outbound delivery team is already scheduled.",
    needs: ["Rice bags", "Dal packs", "Cooking oil"],
    media: ["1 stock ledger photo", "2 volunteer updates"],
    aiReason:
      "Need remains visible due to high beneficiary count, though heat is decaying after resource dispatch confirmation.",
    aiEvidence: [
      "Community kitchen supports 540 meals daily.",
      "Dispatch ETA from donor warehouse is 46 minutes.",
      "No new distress signals in the last 90 minutes.",
    ],
  },
];

export const silentFeedItems: SilentFeedItem[] = [
  {
    id: "feed-1",
    headline: "Silent need cluster detected near informal settlement",
    area: "Pallikaranai fringe",
    time: "2 min ago",
    signal: "NLP cluster uplift",
    detail:
      "Unstructured WhatsApp messages show recurring mentions of soaked bedding and fever symptoms without direct resource ask wording.",
    relatedNeedId: "need-1",
    severity: "high",
  },
  {
    id: "feed-2",
    headline: "Paper survey mismatch flagged for human review",
    area: "Saidapet ward 142",
    time: "9 min ago",
    signal: "OCR confidence drop",
    detail:
      "Regional script parsing fell below threshold after image blur and overlapping handwritten quantities.",
    severity: "watch",
  },
  {
    id: "feed-3",
    headline: "Road access degradation may delay tanker route",
    area: "Tambaram East",
    time: "17 min ago",
    signal: "Field telemetry",
    detail:
      "Two field workers marked a primary lane partially blocked, pushing reroute probability above 60%.",
    relatedNeedId: "need-2",
    severity: "watch",
  },
  {
    id: "feed-4",
    headline: "Volunteer language match opportunity surfaced",
    area: "Velachery South",
    time: "29 min ago",
    signal: "Buddy match engine",
    detail:
      "A Tamil-native counselor and a logistics volunteer are both within deployment radius for the shelter overflow case.",
    relatedNeedId: "need-3",
    severity: "info",
  },
];

export const ocrQueueItems: OCRQueueItem[] = [
  {
    id: "ocr-1",
    district: "Saidapet",
    language: "Tamil",
    extractedType: "Shelter intake form",
    confidence: 81,
    receivedAt: "6 min ago",
    summary:
      "Possible family count mismatch between handwritten total and itemized names.",
    fields: ["Family size", "Sanitation kits", "Women-only section"],
  },
  {
    id: "ocr-2",
    district: "Chromepet",
    language: "Telugu",
    extractedType: "Medicine request slip",
    confidence: 77,
    receivedAt: "18 min ago",
    summary:
      "Dosage fields partially obscured by shadow; quantities may be undercounted.",
    fields: ["Pediatric syrup", "Antibiotics", "Delivery contact"],
  },
  {
    id: "ocr-3",
    district: "MKB Nagar",
    language: "Hindi",
    extractedType: "Ration voucher batch",
    confidence: 83,
    receivedAt: "31 min ago",
    summary:
      "Two beneficiary IDs are low-confidence and require coordinator confirmation.",
    fields: ["Voucher IDs", "Rice quantity", "Pickup point"],
  },
];
