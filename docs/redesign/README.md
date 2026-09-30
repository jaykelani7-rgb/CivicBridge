# CivicBridge editorial redesign

The subsequent local refinement review, checks and populated-component screenshots are in [refinements/README.md](refinements/README.md).

Implemented for review on a separate branch. Branch publication was subsequently requested by the repository owner. No pull request, merge, or deployment is part of this change.

## Baseline and scope

- Branch: `design/civicbridge-editorial-redesign`
- Base branch: `data-intelligence-jay`
- Base commit: `50896f9ae053538d4af719106a0c60f5b420f02d` — “Made Changes in Backend”
- Worktree: `/Users/jaykelani/CivicBridge`
- The checkout was clean before work began. The redesign is committed separately from the baseline on the requested branch.
- The rendered current deployment and Kavach homepage/intake were inspected. The deployment shared the checkout’s rounded hero and feature-panel composition; the browser showed Portuguese copy while the local baseline used English. The redesign follows the current checkout, rather than assuming an older implementation.

## Design and behavior

The homepage now sits directly on warm ivory, with a concise Newsreader headline, DM Sans body text, forest primary actions, and small terracotta accents. An original bridge mark, illustrated street, open numbered steps, dividers, and one forest section establish CivicBridge’s identity and vary the page rhythm. Fonts are self-hosted with their open-source licenses; Devanagari system-font fallbacks are included. No dependencies were added.

The drainage example has four manual, keyboard-operable controls, a polite announcement region, stable content dimensions, and explicit illustrative labels. It is independent of operational queries and contains no invented scores, totals, or approved projects. Live hotspots retain their API integration and show clear loading, empty, and unavailable states.

Citizen intake prioritizes recording or writing, then location/evidence and review. Existing state, consent, validation, private media handling, corrections, confirmation, and tracking remain connected to the original APIs. Submission shows the actual saving/uploading phase, without an invented percentage or determinate progress bar. New copy is available in English, Hindi, and Portuguese. In-place language changes no longer leave the new navigation or skip-link labels in a previous language.

Authentication, public hotspot cards, tracking, analyst evidence screens, and Policy & Impact use the shared palette and clearer typography. Staff data controls remain compact and sans-serif. Existing formulas, source provenance, uncertainty, ranking, filtering, pagination, Firebase sessions, role checks, BFF routes, and private-service boundaries are preserved.

A real hotspot and its loaded evidence bundle can now prefill the existing recommendation form. Linked recommendations open with their selected context. The fields remain editable; creation requires the existing explicit action and server authorization. No backend change was required.

## Main files

| Area | Files/components |
| --- | --- |
| Visual system | `frontend/src/app/globals.css`, `fonts.css`, `layout.tsx`, `frontend/public/fonts`, `frontend/src/lib/design-system.ts`, shared button/card/badge/section components |
| Homepage | `resource-match-home.tsx`, new `example-journey.tsx`, `opportunity-browser.tsx` |
| Navigation/localization | `site-header.tsx`, `mobile-bottom-navigation.tsx`, new `editorial-messages.ts`, `public-messages.ts`, `static-ui-translations.ts`, `static-ui-localizer.tsx` |
| Citizen/public | `volunteer-shell.tsx`, `public-hotspot-card.tsx`, `public-hotspot-explorer.tsx`, `track-request-shell.tsx`, `auth-shell.tsx` |
| Staff | `command-center-shell.tsx`, evidence/scoring/detail/explanation components, `csr-impact-shell.tsx`, `frontend/src/app/csr-impact/page.tsx` |
| Verification | Existing citizen/localization/navigation/hotspot tests; new editorial-home browser tests and recommendation-context unit test |

## Verification

Commands run from `frontend`:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run test` — 21 files, 85 tests passed.
- `npm run build` — production build passed.
- `npm run test:e2e -- --workers=2` — 65 passed, 3 intentional skips. The viewport matrix is run once under Desktop Chrome; its three duplicate project executions are skipped.
- `git diff --check` — passed.

Browser coverage includes Mobile Chrome, Mobile Safari/WebKit, Tablet, and Desktop Chrome. Checks cover consent-based fixture submission and confirmation, preserved input on back navigation, public hotspot filtering and privacy, role-specific navigation, protected redirects, translation persistence and in-place switching, fonts actually loading, manual demo height/keyboard behavior, 200% navigation text scaling, and overflow.

The local production build was visually inspected at 390×844, 768×1024, and 1440×1000. English, Hindi, and Portuguese views, the manual proposal step, section rhythm, mobile menus, focus styling, empty-intake validation, and truthful API/auth unavailable states were inspected. Reduced-motion behavior uses the existing device preference and CSS suppression; the demonstration has no automatic progression.

## Screenshots

Unedited local viewport captures are saved under `screenshots/`:

- [Before — desktop](screenshots/before-desktop.png)
- [After — desktop](screenshots/after-desktop.png)
- [Forest section and report steps](screenshots/after-desktop-sections.png)
- [Public updates unavailable](screenshots/after-desktop-availability.png)
- [Tracking, final action, and footer](screenshots/after-desktop-footer.png)
- [Tablet](screenshots/after-tablet.png)
- [Mobile](screenshots/after-mobile.png)
- [Hindi mobile](screenshots/after-mobile-hindi.png)
- [Portuguese mobile](screenshots/after-mobile-portuguese.png)
- [Illustrative proposal review](screenshots/example-mobile-review.png)
- [Citizen intake](screenshots/intake-mobile.png)
- [Hindi intake](screenshots/intake-mobile-hindi.png)
- [Local authentication unavailable](screenshots/auth-mobile.png)

## Remaining integration limits

The local environment does not supply valid live backend/Firebase configuration or an authorized staff session. Public queries show an unavailable state; staff sign-in shows its configuration error. Authenticated analyst/policy layouts were changed and covered by existing component/data tests, but were not visually inspected with live authorized data. No staff-access bypass was created.

Physical microphone capture, browser geolocation permission, real private media upload/transcription, production status polling, and real recommendation creation were not exercised end to end. Existing WAV/media/API tests pass, and citizen submission/confirmation use local Playwright response fixtures. No test records were submitted to production.

The real map still requires its existing enabled runtime configuration and source data. Existing backend limitations on staff filters, rank/readiness fields, export contracts, and measured impact remain visible; the frontend does not invent missing values. There was no theme switch in this baseline; the existing light-only behavior remains.

## Local review

The production preview is at `http://127.0.0.1:3101/`. If it has stopped, run `npm run start -- --hostname 127.0.0.1 --port 3101` from `frontend` after building. Live data and staff review require the project’s normal local configuration and an authorized account.
