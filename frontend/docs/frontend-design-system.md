# Frontend Design System

## Design Tokens

The frontend uses CSS variables, Tailwind theme bindings, and a TypeScript token reference.

- CSS source: `src/app/globals.css`
- Tailwind mapping: `tailwind.config.ts`
- TypeScript documentation object: `src/lib/design-system.ts`

### Core palette

| Token | Value | Purpose |
| --- | --- | --- |
| `terracotta` | `#D1603D` | Primary CTA and warm emphasis |
| `neem` | `#6B8E23` | Secondary actions, trust, success |
| `indigo` | `#3F51B5` | Focus, links, interactive emphasis |
| `offWhite` | `#F5F5F5` | Canvas background |
| `charcoal` | `#333333` | Main text |
| `harvest` | `#E6A157` | Warnings and soft highlights |
| `tomato` | `#E53935` | Errors and urgency |
| `sky` | `#039BE5` | Informational states |

## Atomic Structure

### Atoms

- `Button`
- `Input`
- `Textarea`
- `Label`
- `Badge`
- `Skeleton`

### Molecules

- `ThemeToggle`
- Filter chips and grouped filter controls
- Onboarding tag pickers

### Organisms

- `SectionShell`
- Public header and footer
- Opportunity browser
- Dashboard and portal shells

## Theming Strategy

- Light and dark modes both run through shared CSS variables.
- `next-themes` controls the root class.
- Components should always consume semantic tokens instead of hard-coded colors unless a one-off visual treatment is intentionally localized.

## Interaction Rules

- Focus states must stay visible and high-contrast.
- Primary actions should remain easy to scan and easy to tap on mobile.
- Motion should be purposeful, brief, and compatible with reduced-motion preferences.
- Analytics should be attached to high-value CTAs using `src/lib/analytics.ts`.

## Migration Strategy

Use a strangler-fig approach:

1. Document tokens and patterns.
2. Strengthen shared primitives.
3. Replace the public-facing route first.
4. Gradually migrate product surfaces to the shared section/layout language.
5. Remove legacy variants only after all usages are replaced.
