# Sprint 1 Retrospective

**Sprint:** Sprint 1, 22 August - 4 September 2026

**Prepared:** 29 August 2026

**Team:** Dakota Wu, Zhouguang Li, Yixuan Huang, Zeheng Li and Wentao Chen

This retrospective is based on the merged GitHub history, pull-request review rounds, automated test results and the Jira backlog. The team will review these observations together before Sprint 1 is closed.

## Sprint outcome

The team delivered a working React-Spring Boot-MySQL vertical slice on `develop`. The merged application supports session login/logout, dashboard health counts, monitored-system list and detail views, recent metrics, threshold-based health calculation, demo data and backend alert lifecycle APIs. The latest integrated code passes 50 backend tests and 11 frontend tests, and the frontend production build succeeds.

## What went well

- **End-to-end ownership was visible.** Authentication, dashboard APIs, database/health logic and the React UI were developed on separate branches and integrated through pull requests.
- **Review feedback produced concrete quality improvements.** The review of the system-detail API identified that an unavailable system should return only the OFFLINE reason. PR #4 added a regression test and fixed the precedence behaviour before final integration.
- **Automated coverage grew with the implementation.** The backend reached 50 tests covering persistence, authentication, health boundaries, metric submission, system queries, seed data and alerts. The frontend added 11 tests across login, application, dashboard and system-detail behaviour.
- **The team maintained a demonstrable vertical slice.** PR #5 connected the React login and dashboard to the merged backend APIs, while PR #9 supplied deterministic demo data for the core workflow.
- **Security fundamentals were included early.** Passwords are BCrypt-hashed, authentication uses persisted users and server-side sessions, and state-changing authentication requests use CSRF protection.

## Challenges and impact

| Challenge | Evidence and impact |
| --- | --- |
| Parallel branches became long-lived and repeatedly merged `develop`. | The backend and dashboard histories contain several merge-from-`develop` commits. This increased review noise and made it harder to see the exact change introduced by each PR. |
| Sprint scope was larger than the two-week capacity. | The Sprint 1 backlog contains 43 story points and several issues remain In Progress or To Do. Some acceptance criteria, such as dashboard alert/KPI fields and frontend user-role/session-expiry presentation, are not yet complete. |
| Jira and contribution evidence lagged behind implementation. | PRs were merged while some Jira statuses, assignees and the contribution table were still incomplete or stale. Git identity differences (`Tony`/Zhouguang and Bingyang/Dakota) also made authorship less obvious. |
| Reproducible database verification was weaker than automated H2 verification. | The backend test suite is strong, but a clean MySQL smoke test and a versioned migration strategy are still pending. This creates avoidable live-demo setup risk. |
| Analysis documentation was postponed while implementation progressed. | The use-case directory still requires the three conceptual briefs and UML diagram planned for Sprint 1, reducing the documentation available for the demo and Q&A. |

## Improvement actions

| Action | Owner | Due date | Success measure |
| --- | --- | --- | --- |
| Complete the three conceptual use-case briefs and UML use-case diagram, then link them to the matching Jira issues. | Zeheng Li | 31 August 2026 | Three reviewed briefs and one readable diagram are committed. |
| Add a PR checklist requiring Jira status, acceptance-criteria evidence, tests and contribution-log updates before merge. | Dakota Wu | 31 August 2026 | Every subsequent PR uses the checklist and has a non-author review. |
| Run the application from a clean MySQL database and record the exact setup/smoke-test result; document the migration decision. | Zhouguang Li and Zeheng Li | 2 September 2026 | Login, dashboard, system detail and logout pass against clean MySQL with repeatable steps. |
| Maintain one shared Sprint 1 test matrix and update contribution evidence after every remaining merge. | Wentao Chen | 3 September 2026 | Test results, PR links and all five contribution rows are current before release review. |
| Close or explicitly defer the remaining frontend acceptance-criteria gaps and prepare backup screenshots for the live demo. | Yixuan Huang | 3 September 2026 | Jira scope matches the demonstrated UI and a fallback demo path is available. |
| Conduct two timed demo rehearsals and a round-robin Q&A in which every member explains their own contribution and one design decision. | Dakota Wu and all team members | 3 September 2026 | Demo finishes within five minutes twice; every member answers without another member taking over. |

## Decisions for the next sprint

- Keep Sprint goals smaller and select only the user stories that can be completed and demonstrated within the time-box.
- Prefer smaller Jira-linked pull requests and synchronise with `develop` before review rather than after extensive parallel work.
- Treat documentation, Jira evidence and contribution updates as part of the Definition of Done, not as end-of-sprint cleanup.
- Keep full RBAC administration and alert-management UI in the Product Backlog until the current Sprint 1 acceptance criteria and release evidence are closed.

## Team review record

At the final retrospective meeting, record any corrections agreed by the team and add the meeting date here before moving ELG2-21 to Done.

**Meeting date:** Pending team review

**Agreed changes:** Pending team review
