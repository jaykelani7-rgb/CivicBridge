export type ParsedVoiceNeed = {
  request_id?: string;
  transcript: string;
  categories: string[];
  urgency: "Critical" | "High" | "Moderate";
  location: string;
  beneficiaryHint: string;
};

export type DistrictIndicator = {
  name: string;
  vulnerabilityIndex: string;
  eta: string;
  priorities: string[];
  languages: string[];
  rationale: string[];
};

export const parsedVoiceNeeds: ParsedVoiceNeed[] = [
  {
    transcript:
      "Need drinking water and ORS at the school shelter near East Tambaram. Several children are vomiting and the current stock is almost finished.",
    categories: ["Water Access", "Medical Relief", "Children"],
    urgency: "Critical",
    location: "East Tambaram Government School Shelter",
    beneficiaryHint: "Approx. 65 families currently on site",
  },
  {
    transcript:
      "Women's hygiene kits are running short at the Velachery overflow center and privacy partitions are still not installed.",
    categories: ["Shelter", "Women Support", "Hygiene"],
    urgency: "High",
    location: "Velachery South Overflow Shelter",
    beneficiaryHint: "Estimated 38 women and 19 children affected",
  },
];

export const districtIndicator: DistrictIndicator = {
  name: "Jaipur Ward 1 (Old City)",
  vulnerabilityIndex: "Vulnerability Index: 84%",
  eta: "Jaipur Regional Zone",
  priorities: ["Drainage repair", "Clean water access", "Waste management"],
  languages: ["Hindi", "Rajasthani", "English"],
  rationale: [
    "Stormwater drainage systems are severely blocked (80% gap index).",
    "High population density (4,500 people per sq km) requires rapid infrastructure clearance.",
    "Bilingual reports (Hindi & Rajasthani) are processed natively.",
  ],
};

export const quickStats = [
  { label: "Reports submitted", value: "24", note: "All verified by Analyst" },
  { label: "Avg processing time", value: "4.2s", note: "Fast transcribe & tag" },
];

export const fieldChecklist = [
  "Confirm country code 'IN' is configured in profile",
  "Capture clean audio without heavy background wind noise",
  "Confirm physical ward name before starting voice intake",
];

export const rotatingGuidance = [
  "Tap once to start the hands-free intake.",
  "AI will transcribe, translate, and classify the report automatically.",
  "Verify and submit the extracted request directly to the Government Triage Queue.",
];
