# Sprint 2 Live Demo Script (Target: 9 minutes 30 seconds)

Use one presenter to drive the application. The named speaker changes should be
quick; do not log in, restart services or search for files during the timed demo.

## Preflight (complete before the tutor arrives)

- Use Java 21, start MySQL, backend and frontend, and confirm `/api/health` is
  `UP`.
- Enable `AUTH_SEED_ENABLED` and `DEMO_DATA_SEED_ENABLED` on a clean demo
  database. Keep the local demo password outside Git.
- Confirm the demo Operations account can log in and the seeded Alert Centre has
  Active, Acknowledged and Resolved records.
- Open the application, this evidence folder, Jira Sprint 2 board and GitHub PR
  list in separate tabs.
- Save screenshots of the dashboard, filtered alert views, contribution board
  and passing tests as a fallback.
- Set browser zoom to 100%, close notifications and start a visible timer.

## Timed path

| Time | Speaker and action | What to say / scoring purpose |
| --- | --- | --- |
| 0:00-0:35 | Dakota: show the dashboard | “Sprint 1 delivered authentication, system health and the backend alert API. Sprint 2 closes the alert-response workflow in the UI.” State the two functional and two non-functional features explicitly. |
| 0:35-2:10 | Yixuan: open Alert Centre; switch Active → Acknowledged → Resolved → All; use Next if enabled | **Functional 1:** users can inspect alert type, system, severity, status and time, filter by lifecycle state and page through a bounded result set. Point out loading/empty/error handling without forcing an error. |
| 2:10-3:40 | Zeheng: return to Active; acknowledge one alert; open Acknowledged and resolve it | **Functional 2:** show the visible success message and refreshed list. Explain allowed transitions: Active → Acknowledged → Resolved, or Active → Resolved. |
| 3:40-4:40 | Zhouguang: point to signed-in role and action controls; briefly show security test/code evidence | **NFR 1:** authenticated server session, fresh CSRF token per mutation, Management read-only UI and backend Operations-only rule. Do not spend time logging into multiple accounts unless already prepared. |
| 4:40-5:35 | Wentao: show five-row page boundary, keyboard focus and narrow responsive view or screenshot | **NFR 2:** bounded server-side pagination for scalable payloads plus labelled controls, visible focus and live feedback for usability/accessibility. |
| 5:35-6:25 | Dakota: show Git/Jira delta | Show the Sprint 1 baseline and Sprint 2 items/PRs. State what changed; do not walk through commits individually. |
| 6:25-7:25 | Dakota: open `sprint-backlog.md` and `contribution-log.md` | Show acceptance criteria, status, owner and real Jira/PR evidence for each person. This is the document-management and task-distribution evidence. |
| 7:25-8:15 | Wentao: show passing verification | Show 20/20 frontend tests, production build and the fresh Java 21 backend result. Mention tests only by coverage area. |
| 8:15-9:00 | Dakota: show `retrospective.md` | State one success, one challenge and one measurable improvement. |
| 9:00-9:30 | All: close | Recap exactly: two functional features, security, bounded/usability behaviour, current backlog, contribution evidence and retro. Stop before ten minutes. |

## Recovery path

- If live data is empty, use the prepared screenshots and explain the same API
  contract; do not debug the database during the timer.
- If an alert was already changed, switch to another seeded alert or reset the
  clean demo database before the next attempt.
- If the network/UI fails, show the relevant automated test and API response as
  evidence, then continue to documents.
- Keep Q&A separate from the ten-minute presentation unless the tutor instructs
  otherwise.
