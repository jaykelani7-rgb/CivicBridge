export type CostLineItem = {
  label: string;
  amount: number;
};

export type FundingNeed = {
  id: string;
  title: string;
  location: string;
  urgency: "Critical" | "High" | "Moderate";
  category: string;
  verifiedBy: string;
  households: number;
  fundingGoal: number;
  fundedAmount: number;
  eta: string;
  summary: string;
  costBreakdown: CostLineItem[];
  tags: string[];
  fundedByYou?: boolean;
};

export type ImpactReceiptRecord = {
  id: string;
  receiptNumber: string;
  date: string;
  donor: string;
  needTitle: string;
  location: string;
  amount: number;
  resourcesDeployed: string[];
  verifiedOutcome: string;
  boardNotes: string[];
};

export const fundingNeeds: FundingNeed[] = [
  {
    id: "fund-1",
    title: "Emergency pediatric medical response kits",
    location: "Perungudi shelter cluster",
    urgency: "Critical",
    category: "Medical Relief",
    verifiedBy: "Dr. Meera, field verification",
    households: 65,
    fundingGoal: 128000,
    fundedAmount: 32000,
    eta: "Deploy within 2 hours",
    summary:
      "A verified shelter cluster needs pediatric fever support, ORS, gloves, and emergency triage supplies after multiple symptom escalations.",
    costBreakdown: [
      { label: "120 pediatric medical kits", amount: 78000 },
      { label: "ORS and hydration stock", amount: 18000 },
      { label: "Rapid transport to shelter", amount: 14000 },
      { label: "Triage volunteer support", amount: 18000 },
    ],
    tags: ["Verified", "Children", "High urgency"],
  },
  {
    id: "fund-2",
    title: "Water tanker and purification support",
    location: "Tambaram East relief point",
    urgency: "High",
    category: "Water Access",
    verifiedBy: "Zone coordinator Arjun",
    households: 112,
    fundingGoal: 94000,
    fundedAmount: 41000,
    eta: "Deploy within 4 hours",
    summary:
      "Hand-pump contamination has been confirmed and queue overflow is affecting a major relief point serving multiple blocks.",
    costBreakdown: [
      { label: "Two tanker trips", amount: 42000 },
      { label: "Portable filtration units", amount: 26000 },
      { label: "Water testing strips", amount: 6000 },
      { label: "Queue and distribution staffing", amount: 20000 },
    ],
    tags: ["Verified", "Infrastructure", "Logistics"],
  },
  {
    id: "fund-3",
    title: "Women-safe shelter privacy retrofit",
    location: "Velachery South overflow center",
    urgency: "High",
    category: "Shelter",
    verifiedBy: "Field worker Rahul N.",
    households: 38,
    fundingGoal: 86000,
    fundedAmount: 12000,
    eta: "Deploy by tonight",
    summary:
      "An overflow shelter is operating above comfort capacity and needs partitions, hygiene kits, and supervised night coverage.",
    costBreakdown: [
      { label: "Portable privacy dividers", amount: 36000 },
      { label: "Hygiene and sanitation kits", amount: 22000 },
      { label: "Night shift supervision", amount: 16000 },
      { label: "Contingency transport", amount: 12000 },
    ],
    tags: ["Verified", "Women support", "Night response"],
  },
];

export const impactReceipts: ImpactReceiptRecord[] = [
  {
    id: "receipt-1",
    receiptNumber: "RM-CSR-2026-0142",
    date: "April 18, 2026",
    donor: "Asterion Industries CSR",
    needTitle: "Dry ration replenishment for community kitchen",
    location: "Mylapore West Community Kitchen",
    amount: 154000,
    resourcesDeployed: [
      "180 rice bags",
      "120 dal kits",
      "Cooking oil reserve for 6 days",
      "Two local delivery vehicles",
    ],
    verifiedOutcome:
      "Kitchen capacity was restored to 540 meals per day within the same evening, with no interruption to scheduled distribution.",
    boardNotes: [
      "Verified by kitchen coordinator and donor logistics partner.",
      "Delivery timestamps matched distribution logs within a 14-minute variance.",
      "Follow-up showed stable inventory levels for the next 6 operating days.",
    ],
  },
  {
    id: "receipt-2",
    receiptNumber: "RM-CSR-2026-0136",
    date: "April 11, 2026",
    donor: "Asterion Industries CSR",
    needTitle: "Flood sanitation kit deployment",
    location: "Chromepet school shelter",
    amount: 98000,
    resourcesDeployed: [
      "240 sanitation kits",
      "Portable wash supplies",
      "Volunteer unloading support",
    ],
    verifiedOutcome:
      "Shelter health officers reported stabilized sanitation access for 240 residents and reduced re-supply risk over the next 72 hours.",
    boardNotes: [
      "Cross-verified through shelter intake and inventory sheets.",
      "Beneficiary feedback noted improved access for women and children.",
      "No duplicate resource claims detected in audit pass.",
    ],
  },
];
