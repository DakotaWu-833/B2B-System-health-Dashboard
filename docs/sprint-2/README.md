# Sprint 2 Evidence Pack

This folder is the single entry point for the ELEC5619 Sprint 2 check. It is
deliberately limited to the evidence required by the 2.5-mark schema.

## Rubric traceability

| Marking item | Minimal evidence to show | Repository evidence |
| --- | --- | --- |
| Functional feature 1 | View current alerts, filter by lifecycle status and move between bounded pages | `frontend/src/AlertCenter.jsx`; `GET /api/alerts`; `AlertCenter.test.jsx` |
| Functional feature 2 | Acknowledge an active alert and resolve an active or acknowledged alert | `AlertCenter.jsx`; the two alert `PATCH` endpoints; frontend and backend alert tests |
| Non-functional feature 1 | Security: authenticated session, role-aware controls, server-side Operations-only enforcement and CSRF on mutations | `SecurityConfig.java`; `AlertCenter.jsx`; `AlertIntegrationTests.java` |
| Non-functional feature 2 | Usability and scalability: keyboard-visible controls, live success/error messages, responsive layout and five-record server-side pagination | `styles.css`; `AlertCenter.jsx`; `AlertCenter.test.jsx` |
| Presentation quality | A rehearsed path under ten minutes, clear Sprint 1-to-2 delta, and one document index | [demo-script.md](demo-script.md) |
| Backlog and contribution | Tasks have owners, acceptance criteria, status and evidence; contribution rows identify individual work | [sprint-backlog.md](sprint-backlog.md) and [contribution-log.md](contribution-log.md) |
| Retrospective | Short summary of successes, challenges and measurable improvements | [retrospective.md](retrospective.md) |
| Q&A | Every member owns named questions and can explain one cross-functional decision | [qa-preparation.md](qa-preparation.md) |

## Sprint 2 increment

Sprint 1 supplied authentication, health summaries, system details, metric
history and backend alert APIs. Sprint 2 closes the user-facing alert workflow:

1. Both Operations and Management users can inspect and filter alerts.
2. Operations users can acknowledge and resolve alerts from the dashboard.
3. Mutations obtain a fresh CSRF token and remain protected by backend RBAC.
4. Alert traffic is bounded to five records per page, with explicit loading,
   empty, error and success states.

## Verified locally on 21 September 2026

- Frontend tests: **20 passed across 6 files**.
- Frontend production build: **passed**.
- Sprint 2 changes do not modify backend production code. The last recorded
  integrated Sprint 1 backend result is 51 passing tests; rerun it with Java 21
  on the presentation machine and record the fresh result in
  [verification.md](verification.md).

## Four actions the team must complete with real evidence

These cannot be truthfully generated from source code and should be completed
before the tutor check:

1. Mirror the `SP2-*` items in Jira (or replace them with the team's real Jira
   IDs), then set the actual assignee and status.
2. Replace every `ADD ACTUAL LINK` cell in `contribution-log.md` with the real
   Jira issue, pull request, commit or review evidence. Do not claim work a
   member did not perform.
3. Rerun the backend tests with Java 21 and paste the result into
   `verification.md`.
4. Rehearse `demo-script.md` twice, capture backup screenshots, and verify that
   every member can answer their assigned and cross-functional questions.
