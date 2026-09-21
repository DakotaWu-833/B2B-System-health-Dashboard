# Sprint 2 Contribution Log

Use this table during the document-management part of the demo. File ownership
below is the minimal planned split; each row must be corrected to match the real
work and linked to external evidence before it is presented as final.

| Team member | Sprint 2 responsibility / evidence to explain | Jira / PR / commit / review evidence | Verification evidence |
| --- | --- | --- | --- |
| **Dakota Wu** (Jira: Bingyang Wu) | Integration coordination, Sprint 2 scope, rubric index and timed demo pack | **ADD ACTUAL LINK** | Evidence files are linked from `docs/sprint-2/README.md`; records two rehearsals below |
| **Zhouguang Li** | Review CSRF/session/RBAC behaviour and verify Management cannot mutate alerts | **ADD ACTUAL LINK** | `SecurityConfig.java`; Management 403 assertions in `AlertIntegrationTests.java` |
| **Yixuan Huang** | Alert Centre presentation, status filter, pagination and responsive UI | **ADD ACTUAL LINK** | `AlertCenter.jsx`; `styles.css`; list/filter/pagination frontend tests |
| **Zeheng Li** | Alert lifecycle integration and API/data behaviour | **ADD ACTUAL LINK** | `AlertService.java`; acknowledge/resolve frontend test and backend lifecycle tests |
| **Wentao Chen** | Accessibility, failure-state and regression verification; evidence maintenance | **ADD ACTUAL LINK** | `AlertCenter.test.jsx`; `verification.md`; production build result |

## Review and rehearsal record

Complete this small table rather than producing a long meeting log.

| Date | Participants | Evidence / outcome |
| --- | --- | --- |
| **ADD DATE** | **ADD NAMES** | PR reviewed; acceptance criteria checked; Jira statuses updated |
| **ADD DATE** | All members | Rehearsal 1: **ADD TIME**; issues found: **ADD** |
| **ADD DATE** | All members | Rehearsal 2: **ADD TIME**; final result: **ADD** |

## Fast completion rule

Each member should have at least one truthful implementation, test,
documentation, review or coordination artifact. Jira history and reviewed pull
requests are strongest; a screenshot of the filtered Sprint 2 board and PR list
is useful backup. Never invent a commit or attribute another member's work.
