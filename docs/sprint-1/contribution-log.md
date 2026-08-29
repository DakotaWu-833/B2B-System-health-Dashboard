# Sprint 1 Contribution Log

This log records the merged Sprint 1 baseline on `develop` plus the follow-up work present on the `database` branch through commit `b6e9552` in the [team GitHub repository][repository]. Jira issues and GitHub pull requests remain the primary evidence. Where a Git author name differs from the team member's name, the mapping is stated explicitly.

| Team member | Jira issue(s) | Delivered contribution | Pull request / commit evidence | Review and verification evidence |
| --- | --- | --- | --- | --- |
| **Dakota Wu** (Jira: Bingyang Wu) | ELG2-8; Sprint integration and release coordination | Initialised the React/Vite and Spring Boot project structure, shared configuration, documentation layout and team workflow; coordinated integration of the authentication, backend API, database and frontend workstreams into `develop`. | Commit `28ab367`; merged [PR #2], [PR #3], [PR #4], [PR #8], [PR #9] and [PR #5] through commits `54969e8`, `dd1c0d4`, `58cd66d`, `a13baca`, `8437d36` and `0218c10`. | Verified integration after review rounds; latest `develop` passes 50 backend tests and 11 frontend tests, and the frontend production build succeeds. |
| **Zhouguang Li** (Git author: Tony) | ELG2-10 | Implemented persisted BCrypt authentication, Spring Security configuration, CSRF-protected session login/current-user/logout APIs, safe JSON authentication errors and an environment-controlled demo user. | [PR #2], branch `authentication-backend`; key commits `c03fd2d`, `9345067`, `03789d6`, `f86f0e6`, `7305eff`, `6d90567`, `79fd162`, `38b8c5c`, `0ce991c` and `f14e217`. | Repository, user-details service, demo-user seeder and MockMvc integration tests cover successful authentication and principal failure paths; detailed traceability is in `authentication-evidence.md`. |
| **Yixuan Huang** | ELG2-15, ELG2-16 | Built the React login/logout flow, session restoration, KPI dashboard, monitored-system list, system detail and recent-metrics views; connected the UI to the backend and improved responsive layout, accessibility, error handling and test coverage. | [PR #5], branch `feature/dashboard`; key commits `6d1126a`, `9e8e30f`, `6246e3d`, `f0a32d5`, `21a7a59`, `8b8cb90`, `86eb3e5`, `a4b68cd` and `96155a8`. | Four Vitest files pass 11/11 tests; the Vite production build succeeds; review feedback was addressed before the final merge. |
| **Zeheng Li** | ELG2-9, ELG2-13 | Designed the JPA/MySQL entity relationships and indexes; implemented configurable health calculation, transactional metric submission, demo dashboard data, alert generation, deduplication, escalation and lifecycle APIs. Follow-up review work enforced Operations-only metric and alert mutations, added pessimistic locking for concurrent submissions and lifecycle transitions, standardised API errors, introduced Flyway schema migration and database integration verification, paginated alert queries, and completed frontend API-base, session-expiry, dashboard empty-state and refresh behaviour. | [PR #9], branch `database`; implementation commits `41743d2`, `5851f3b`, `30ae710`, `7d94391`, `3f5f616` and `50994d4`; review-fix commits `a9fc865`, `d161369` and `b6e9552`. | Persistence, health-boundary, metric-submission, demo-seed, alert lifecycle, concurrency, RBAC, pagination and migration assertions are covered by the 50-test backend suite. Five Vitest files pass 15/15 tests, the frontend production build succeeds, and the Flyway H2/MySQL-compatibility migration validation passes; a Docker-aware MySQL 8.4 Testcontainers test is also included. |
| **Wentao Chen** | ELG2-12, ELG2-14, ELG2-20 | Implemented the read-only dashboard summary, monitored-system list/detail and recent-metric APIs; added stale/missing-data handling, threshold reasons, API documentation, integration tests and contribution evidence. | [PR #3] and [PR #4] for the APIs and review fix; [PR #8] for evidence updates; commits `ea3d089`, `013018a`, `86a503c` and `56db1b4`. | Nine dashboard/system integration tests pass. Review identified the OFFLINE precedence issue; commits `013018a` and `86a503c` added the regression test and ensured unavailable systems return only the OFFLINE reason. Latest backend suite: 50 tests passed. |

## Shared Sprint 1 verification

- Backend: 50 tests passed with Java 21 on the current `database` branch.
- Frontend: 15 tests passed across five Vitest files.
- Frontend production build: successful.
- Database migration profile: Flyway migration and JPA validation passed on H2 in MySQL compatibility mode; the MySQL 8.4 Testcontainers test runs automatically when Docker is available.
- Integrated browser smoke flow: login, session restoration, dashboard, system details, recent metrics and logout.

Detailed authentication evidence is recorded in [authentication-evidence.md](authentication-evidence.md). The team should keep the matching Jira issues updated with the final PR links and completion notes.

[repository]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02
[PR #2]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/2
[PR #3]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/3
[PR #4]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/4
[PR #5]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/5
[PR #8]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/8
[PR #9]: https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/9
