export const howItWorks = [
  {
    step: "01",
    title: "Citizen Voice Intake",
    description:
      "Citizens submit reports in their native language (Hindi, Portuguese, English, etc.) via voice notes or text forms.",
  },
  {
    step: "02",
    title: "AI Normalization & Extraction",
    description:
      "Google Speech-to-Text and Translation prepare multilingual content; Gemini extracts validated structured issue records.",
  },
  {
    step: "03",
    title: "Deterministic Scoring & Ranking",
    description:
      "The scoring engine calculates explainable Need and Action scores, updating public hotspots and ranking project briefs.",
  },
] as const;

export const onboardingPanels = [
  {
    title: "Citizen intake portal",
    description:
      "Submit an infrastructure complaint or service outage report using text or voice recordings in your local language.",
    href: "/volunteer",
    cta: "Open intake portal",
  },
  {
    title: "CivicBridge analyst console",
    description:
      "Inspect prioritized demand hotspots, scoring explanations, and bounded evidence bundles.",
    href: "/command-center",
    cta: "Open analyst console",
  },
  {
    title: "Policy & Impact workspace",
    description:
      "Track approved public works projects, review AI project briefs, record decisions, and check target metrics.",
    href: "/csr-impact",
    cta: "Open Policy & Impact",
  },
] as const;
