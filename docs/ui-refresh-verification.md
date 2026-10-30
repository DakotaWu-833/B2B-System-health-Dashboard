# StudyCrew UI refresh — verification

Verified on 31 October 2026 (Australia/Sydney).

## Design reference and scope

The reference is the local StudyCrew implementation: `static/css/app.css`,
`frontend/src/styles.css`, `frontend/src/components/Layout.tsx`,
`frontend/src/components/UI.tsx`, and its login template. The refresh reuses its
Inter/system font stack, paper login background, sidebar,
white panels, profile cover, form dimensions, status badges, focus treatment,
card hover feedback and dialog motion (680 ms entrance, 180 ms exit).

React/Vite, Spring Boot, REST contracts, JPA and MySQL remain the architecture.
No backend business code or frontend dependencies were changed. All five
workspaces remain available with their original role restrictions. Existing
search, sort, filtering, pagination, history cursors, threshold explanations,
metric submission, email verification and deferred alert resolution remain.

Interaction improvements include explicit sidebar collapse, a mobile menu with
focus containment and Escape support, password visibility, unsaved form guards,
save-in-progress protection, restored focus, reduced motion, and profile retry.

The palette was subsequently adapted to system monitoring: a mist-green sidebar,
graphite text and teal actions, with slate and warm brown chart series. Semantic
health green, warning amber, critical red and offline grey remain distinct.

## Automated verification

| Check | Result |
| --- | --- |
| Frontend regression suite, including Docker build-stage container | 74 passed across 14 files |
| Backend ordinary tests | 158 passed |
| Real MySQL/SMTP integration tests | 18 passed |
| Production frontend build inside Docker | Passed |
| Final Compose health | frontend, backend, mysql and mailpit healthy |
| Patch whitespace validation | Passed |

The original frontend baseline was 41 passing and 23 failing tests. All original
64 test cases were retained and updated for the existing separate overview,
system and alert workspaces, current API pagination and explicit detail tabs.
Ten further tests cover the new accessibility and draft-protection behavior.

## Browser acceptance against the Docker application

Both seeded roles were exercised through the served frontend and actual APIs:

- Login, session restoration, logout, sidebar collapse and backend connection check.
- System card browsing, name search, creation and editing.
- Draft preservation, continuing editing and successful save.
- Manual metric submission, resulting health/alerts, history charts and range refresh.
- Alert name search, sorting, status filtering, pagination, acknowledgement,
  cancellation of a scheduled resolution, and committed resolution after the delay.
- Profile email saving, SMTP delivery to Mailpit, six-digit verification, and
  verification status retained after backend restart and a new login.
- Retention preview, cancelling confirmation, and archiving one eligible batch.
- Management read-only behavior: no create/edit/resolve actions, disabled metric
  submission and no Operations retention navigation.
- 390 px mobile navigation, inventory, history dialog, internal scrolling,
  Escape closure, navigation focus, no page-wide horizontal overflow, and
  switching an open mobile menu to desktop without retaining a scroll lock.
- Reduced-motion preference.

The preview database contains synthetic data only, including a system named
`UI acceptance server`. To exercise archiving, a local ignored Compose override
was used to enable the existing retention policy with a 24-hour schedule, and
one 40-day-old non-latest reading was inserted for that synthetic system. The
browser archived exactly that reading. Normal tracked configuration retains its
existing default policy.

## Preview and evidence

See [Docker startup](ui-docker.md). The running app is at
<http://localhost:5619>, and the local email inbox is at
<http://localhost:8561>. Both demonstration passwords are in the ignored root
`.env` file, under `UI_OPERATIONS_PASSWORD` and `UI_MANAGEMENT_PASSWORD`.

Screenshots are local, ignored artifacts in `output/playwright/`:
`login-desktop.png`, `dashboard-desktop.png`, `systems-desktop.png`,
`add-system-dialog.png`, `metric-history-desktop.png`, `alerts-desktop.png`,
`profile-desktop.png`, `retention-desktop.png`, `dashboard-mobile.png`,
`systems-mobile.png`, `navigation-mobile.png`, and `history-mobile.png`.

### Monitoring palette refinement

The subsequent colour-only refinement passed the existing 74 frontend tests and
a fresh production build in Docker. Browser checks covered the overview, profile,
mobile navigation and metric history, including absence of page-wide overflow.
Updated captures are `dashboard-teal-desktop.png`, `profile-teal-desktop.png`,
`navigation-teal-mobile.png` and `history-teal-mobile.png` in `output/playwright/`.
