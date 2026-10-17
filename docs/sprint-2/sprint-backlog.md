# Sprint 2 Backlog

**Sprint goal:** give users a secure, usable way to inspect and act on system
alerts while keeping the increment small enough to demonstrate reliably within
ten minutes.

The planned owners below follow the team's established roles. The team must
align the owner and Jira ID with what actually happened before submission.

| Local ID | Backlog item and planned owner | Acceptance criteria | Status | Repository evidence |
| --- | --- | --- | --- | --- |
| SP2-01 | Alert list, filtering and paging — Yixuan Huang | Authenticated users see newest alerts; can select Active, Acknowledged, Resolved or All; empty/loading/error states are explicit; Previous/Next request no more than five rows | Done | `AlertCenter.jsx`; alert-list and pagination tests |
| SP2-02 | Alert acknowledgement and resolution — Zeheng Li | Operations can acknowledge an Active alert; resolve Active/Acknowledged alerts; successful actions refresh the selected filter; invalid server responses are shown without corrupting UI state | Done | `AlertCenter.jsx`; existing alert lifecycle API and integration tests |
| SP2-03 | Security integration — Zhouguang Li | Every mutation sends a fresh CSRF token; Management sees a read-only UI; backend returns 403 for Management mutations; 401 returns the UI to sign-in | Done | `SecurityConfig.java`; `AlertCenter.jsx`; RBAC and session-expiry tests |
| SP2-04 | Responsive/accessibility regression coverage — Wentao Chen | Filter has an associated label; tables have scoped headings/caption; keyboard focus is visible; results/actions have live feedback; layout works at 320 px; automated frontend suite passes | Done | `styles.css`; `AlertCenter.test.jsx`; 20/20 frontend tests |
| SP2-05 | Integration, rubric evidence and demo coordination — Dakota Wu | Sprint 1-to-2 delta is explicit; rubric has one evidence index; demo script is under ten minutes; backlog, contribution, retro and Q&A files are linked from one page | Done | `docs/sprint-2/` evidence pack |
| SP2-06 | External evidence and rehearsal — all members | Real Jira/PR/review links replace placeholders; Java 21 backend verification is current; two timed rehearsals finish in 9:30 or less; every member answers one own-area and one cross-area question | Team action before check | Jira/GitHub screenshots, `contribution-log.md`, `verification.md` |

## Definition of Done

An item is Done only when its acceptance criteria pass, relevant tests pass,
the Jira issue is current, implementation/review evidence is linked, and the
integrated frontend still builds. Documentation and contribution evidence are
part of Done rather than end-of-sprint cleanup.

## Scope deliberately excluded

- Email/SMS notifications.
- A custom monitoring agent.
- Bulk alert operations.
- Configurable alert thresholds in the UI.
- Analytics beyond bounded lifecycle filtering.

These are valuable product-backlog candidates but add no Sprint 2 rubric marks.
