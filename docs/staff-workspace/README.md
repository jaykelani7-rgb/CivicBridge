# Staff workspace visual verification

These captures use the isolated component preview in `frontend/dev-preview`; every visible record is a labelled test fixture. They do not represent a signed-in staff session or live backend result. Run `cd frontend && npm run test:fixtures` to regenerate them. The Playwright check measures horizontal overflow at 320, 390, 768 and 1440 pixels and at 200% text size, then exercises the populated policy, evidence, impact, and state components without API writes.

- [Desktop policy brief](screenshots/policy-desktop.png)
- [Laptop policy brief](screenshots/policy-laptop.png)
- [Tablet policy brief](screenshots/policy-tablet.png)
- [Mobile policy brief](screenshots/policy-mobile.png)
- [Mobile recommendation queue](screenshots/queue-mobile.png)
- [Desktop decision drawer](screenshots/decision-desktop.png)
- [Mobile decision drawer](screenshots/decision-mobile.png)
