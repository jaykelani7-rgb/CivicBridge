# CivicBridge editorial refinements

Implemented for local review on `design/civicbridge-editorial-redesign`, starting from `c818bf4e762bd6ebc43809d853fbad69d53352f1`. The starting working tree was clean. These refinements remain uncommitted; no push, pull request, merge, or deployment was performed.

## Result

- The example journey now shows four distinct states of the same original neighbourhood illustration: a resident’s report anchored to the school drain; illustrative nearby reports grouped around it; waterlogging, access and verification concerns; and an inspection/clearing plan awaiting human review. It never queries operational records or calculates a priority score.
- Manual controls sit above the scene. The largest intrinsic translated panel determines the shared height, allowing enlarged text to grow. There are no fixed text heights, automatic progression, or scroll-triggered step changes. Notices and captions are at least 12px; controls are 13px with targets of at least 44px. The transition lasts 180ms and is disabled for reduced motion.
- Intake opens with “What needs attention?”, a Write/Record choice, country and report language, then the selected input. Text and audio survive mode and step changes. Deletion is explicit; replacement preserves the previous attachment until a new recording/file is ready. Recording cannot be left for another step before it stops.
- Location/privacy explanation appears in the location step. Submission, consent, validation, correction, tracking, media conversion and upload contracts remain intact.
- A language selector beside the mobile menu shows English, हिन्दी and Português through the existing locale state. UI language changes do not modify report country or language metadata. At narrow widths and enlarged text, header controls wrap without clipping.
- Homepage section titles now read “Explore reported local issues”, “Track your report” and “Understand how issues are prioritised”, with Hindi and Portuguese equivalents.
- Sticky header height is measured for anchor/focus spacing. Horizontal clipping no longer creates an unintended vertical scrolling container. Intake actions clear the bottom navigation and use visual-viewport geometry when the keyboard covers part of the page. Global smooth scrolling was removed so focus and link activation do not compete with a scroll animation.
- Populated public-card actions align along the bottom. Evidence tabs clear the sticky header; score panels and contribution columns shrink/wrap at enlarged text sizes. Policy tracks and proposal form fields fit narrow screens.

## Populated layout verification

`frontend/dev-preview/` is a standalone, loopback-only Vite preview using the existing installed tooling. It sits outside the Next app and is absent from the production route manifest. It renders the actual public card/detail, evidence presentation, recommendation queue/brief/decision rail, editable proposal form, project metrics and empty/error/loading components with explicitly labelled test records.

Evidence rendering is now a controlled presentation component called only after the original production session and role checks. The policy presentation exports likewise leave production queries and mutations in their original containers. The preview does not supply a staff profile/session, alter roles, call production containers, or write to APIs. Its browser test observes **zero API requests**, including when its fixture create action is clicked. A persistent test banner remains visible over the mobile detail view. Numerical fixture scores/metrics are explicitly test data; they are independent of the homepage example.

From `frontend/`:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3101
npm run preview:fixtures
```

The app runs on port 3101 and isolated populated components on port 3102. Preview links to the app are read-only navigation; its action handlers remain local fixture handlers.

## Validation

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npx tsc -p dev-preview/tsconfig.json --noEmit` | Passed |
| `npm test` | 87 tests passed across 21 files |
| `npm run build` | Passed; fixture preview absent from production routes |
| `npm run test:e2e` | 81 passed; 3 intentional pre-existing skips |
| `npm run test:fixtures` | 2 tests passed |
| `git diff --check` | Passed |

Focused checks cover four distinct manual scene states, selected/focus state, keyboard operation, reduced motion, growing translated text, visible mobile language controls, report metadata preservation, mode/step preservation of text and recorded audio, explicit attachment replacement/deletion, and input/action/navigation geometry under a shrinking visual viewport. Existing submission/confirmation, coordinate-free prefills, authentication denial and navigation regressions still run.

The populated fixture tests cover 390×844, 768×1024, 1440×1000 and 320×844, plus 200% root text size. They check descendant bounds as well as document overflow, so an overflow-hidden wrapper cannot conceal clipped content. The main browser suite uses Chromium and WebKit configurations for mobile, tablet and desktop. The pre-existing broad viewport matrix runs once on Desktop Chrome; its other three project instances are deliberately skipped. The six-combination translated journey matrix has a 60-second budget because it visits both languages at three widths and keyboard-selects every step.

## Screenshots

All captures are viewport screenshots. No stitched full-page captures were used. Public/staff records in files prefixed `fixture-` are isolated test records, not a signed-in operational session.

| View | Capture |
| --- | --- |
| Desktop hero / Report · 1440×1000 | [Report](screenshots/desktop-hero-report.jpg) |
| Desktop journey / Connect · 1440×1000 | [Connect](screenshots/desktop-journey-connect.jpg) |
| Desktop journey / Understand · 1440×1000 | [Understand](screenshots/desktop-journey-understand.jpg) |
| Desktop journey / Review · 1440×1000 | [Review](screenshots/desktop-journey-review.jpg) |
| Mobile journey top controls · 390×844 | [Top controls](screenshots/mobile-journey-top-controls.jpg) |
| Tablet journey · 768×1024 | [Tablet](screenshots/tablet-journey.jpg) |
| Mobile intake / first input · 390×844 | [Write](screenshots/mobile-intake-first-input.jpg) |
| Mobile intake / recording entry · 390×844 | [Record](screenshots/mobile-intake-record-option.jpg) |
| Visible mobile Hindi selector · 390×844 | [Hindi](screenshots/mobile-language-hindi.jpg) |
| Visible mobile Portuguese selector · 390×844 | [Portuguese](screenshots/mobile-language-portuguese.jpg) |
| Populated public cards · 1440×1000 | [Desktop cards](screenshots/fixture-public-desktop.jpg) |
| Populated public cards · 768×1024 | [Tablet cards](screenshots/fixture-public-tablet.jpg) |
| Populated public card · 390×844 | [Mobile card](screenshots/fixture-public-mobile.jpg) |
| Portuguese public detail / long locality · 390×844 | [Selected detail](screenshots/fixture-public-detail-mobile-portuguese.jpg) |
| Populated evidence overview · 1440×1000 | [Overview](screenshots/fixture-evidence-overview-desktop.jpg) |
| Populated score contribution/detail · 1440×1000 | [Score breakdown](screenshots/fixture-evidence-score-desktop.jpg) |
| Populated evidence · 390×844 | [Mobile evidence](screenshots/fixture-evidence-mobile.jpg) |
| Populated score contribution · 390×844 | [Mobile scoring](screenshots/fixture-evidence-score-mobile.jpg) |
| Populated policy / editable prefills · 1440×1000 | [Desktop policy](screenshots/fixture-policy-prefill-desktop.jpg) |
| Policy prefills · 390×844 | [Mobile policy](screenshots/fixture-policy-prefill-mobile.jpg) |
| Policy inputs at 200% text · 320×844 | [Enlarged text](screenshots/fixture-policy-narrow-200percent.jpg) |
| Populated, pending and unavailable metrics · 1440×1000 | [Impact](screenshots/fixture-impact-desktop.jpg) |
| Loading, empty and error · 1440×1000 | [States](screenshots/fixture-loading-empty-error-desktop.jpg) |

## Limits of verification

The local app returns an unavailable state for public updates and has no available authorized staff session. Populated staff/public visuals were therefore verified using the isolated presentation preview described above, not live records. No operational data was created or changed.

Actual microphone hardware, native mobile keyboards/safe-area hardware, real uploads, transcription, live authorization and backend mutations were not exercised. Recording lifecycle and WAV preparation were tested with media doubles; audio preservation/replacement was checked with local file fixtures. Keyboard spacing was tested with deterministic visual-viewport geometry in Chromium and WebKit, which is not a substitute for testing physical devices. Hindi rendering uses the established Devanagari fallback fonts. Long record titles and locality names remain source data rather than being automatically translated.
