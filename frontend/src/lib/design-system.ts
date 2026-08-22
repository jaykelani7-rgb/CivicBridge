export const designTokens = {
  colors: {
    terracotta: "#D1603D",
    neem: "#6B8E23",
    indigo: "#3F51B5",
    offWhite: "#F5F5F5",
    charcoal: "#333333",
    tomato: "#E53935",
    sky: "#039BE5",
    harvest: "#E6A157",
    white: "#FFFFFF",
  },
  typography: {
    body: {
      fontFamily: "var(--font-inter), sans-serif",
      baseSize: "18px",
      lineHeight: "1.6",
    },
    heading: {
      fontFamily: "var(--font-lato), sans-serif",
      scale: ["24px", "32px", "40px", "56px"],
    },
  },
  spacing: {
    base: 8,
    scale: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    xl: "24px",
  },
  shadows: {
    soft: "0 18px 52px -24px rgba(51, 51, 51, 0.2)",
    elevated: "0 24px 60px -28px rgba(51, 51, 51, 0.28)",
  },
  motion: {
    productive: "200ms ease-out",
    expressive: "400ms ease-out",
  },
} as const;

export const informationArchitecture = [
  {
    label: "Home",
    href: "#home",
    description: "Hero, mission framing, and primary volunteer CTA.",
  },
  {
    label: "Browse",
    href: "#browse",
    description: "Search and filter live opportunities without losing context.",
  },
  {
    label: "Impact",
    href: "#impact",
    description: "Proof points, testimonials, and measurable outcomes.",
  },
  {
    label: "Join",
    href: "#join",
    description: "Separate onboarding paths for volunteers and NGO teams.",
  },
  {
    label: "Contact",
    href: "#contact",
    description: "Trust, support, and follow-up details.",
  },
] as const;

export const premiumUxTargets = {
  lighthouse: {
    performance: 90,
    accessibility: 95,
    bestPractices: 90,
    seo: 90,
  },
  coreWebVitals: {
    lcp: "< 2.5s",
    cls: "< 0.1",
    inp: "< 200ms",
  },
  rollout: {
    qaCoverage: "All primary flows verified on mobile, tablet, and desktop.",
    accessibility: "Keyboard, focus order, and contrast reviewed for all migrated surfaces.",
  },
} as const;
