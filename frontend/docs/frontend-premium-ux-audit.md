# Frontend Premium UX Audit

## Scope

This audit covers the current Next.js frontend for ResourceMatch and establishes the first migration slice toward a premium, accessible, and reusable UI system without removing any existing features.

## Feature Inventory

| Surface | Route | Purpose | Current Status | Upgrade Priority |
| --- | --- | --- | --- | --- |
| Public landing | `/` | Volunteer/NGO discovery and routing | Placeholder foundation summary | P0 |
| Auth and onboarding | `/auth` | Role-based entry and signup | Functional and visually strong | P0 |
| CSR setup | `/auth/csr-setup` | Donor onboarding | Functional | P1 |
| Command Center | `/command-center` | Operations dashboard, OCR queue, explainable AI | Functional and feature-rich | P0 |
| Volunteer PWA | `/volunteer` | Voice intake and buddy match | Functional, mobile-first | P0 |
| CSR impact portal | `/csr-impact` | Funding board and impact receipts | Functional | P0 |

## Component Inventory

| Component | Location | Notes | Action |
| --- | --- | --- | --- |
| `Button` | `src/components/ui/button.tsx` | Good variant base, already supports multiple tones | Keep and standardize analytics/loading patterns |
| `Card` | `src/components/ui/card.tsx` | Reusable shell used throughout app | Keep and reinforce as primary layout primitive |
| `Input` and `Textarea` | `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx` | Accessible defaults and visible focus | Keep and use for shorter public forms |
| `Badge` | `src/components/ui/badge.tsx` | Useful semantic accent component | Keep, reuse for status and filters |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Existing loading strategy | Keep and extend to additional surfaces |

## Visual Audit

- Strengths:
  - Earthy palette already exists in CSS variables and Tailwind mappings.
  - Typography and shadows already support a warm, premium visual direction.
  - Existing product pages have stronger visual identity than the public landing surface.
- Gaps:
  - Public homepage did not reflect the maturity of the internal app flows.
  - Shared design tokens were implicit in CSS and Tailwind, not documented in a reusable system artifact.
  - Navigation and IA on the public-facing route were not yet aligned to common nonprofit portal patterns.

## Accessibility Audit

- Existing strengths:
  - Semantic buttons and links are used widely.
  - Inputs have visible focus states.
  - Base text sizes are readable and line-height is generous.
- Risks to monitor:
  - Decorative motion should respect `prefers-reduced-motion`.
  - Public navigation needs stronger keyboard and skip-link support.
  - Future imagery should include descriptive `alt` text and avoid text baked into images.
- Target:
  - WCAG 2.1 AA on migrated public surfaces.

## Performance Audit

- Existing strengths:
  - App uses route-based rendering and mostly local mock data, so interaction latency is low.
  - Shared primitives are lightweight.
- Risks to monitor:
  - Framer Motion use should stay purposeful and small.
  - Future media should be optimized and lazy-loaded.
  - Analytics hooks should stay lightweight and non-blocking.
- Success targets:
  - Lighthouse performance score above 90.
  - LCP under 2.5 seconds.
  - CLS under 0.1.

## Analytics Audit

- No analytics abstraction was present in `src` before this migration slice.
- Action taken:
  - Added a safe `dataLayer` helper in `src/lib/analytics.ts` and attached analytics metadata to key CTA interactions.

## Prioritization

1. Public landing and navigation
2. Shared design-system documentation and primitives
3. Cross-surface consistency for analytics, loading, and theming
4. Incremental hardening of command, volunteer, and CSR surfaces using the shared library
