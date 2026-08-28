# Sprint 1 Contribution Log

Update this table throughout the sprint. Jira issues and pull requests remain the primary evidence.

| Team member | Jira issue | Deliverable | Pull request / commit | Review or test evidence |
| --- | --- | -- | --- | --- |
| Zhouguang Li | ELG2-10 | Persisted BCrypt user authentication; CSRF-protected session login, current-user and logout APIs; safe JSON errors | `authentication-backend`, commits `9345067`–`7305eff` | Repository, service and MockMvc integration tests; see `authentication-evidence.md` |
| Bingyang Wu |  |  |  |  |
| Yixuan Huang |  |  |  |  |
| Zeheng Li | Jira IDs pending: seed data; alert lifecycle | MySQL/JPA entity relationships and persistence; configurable metric health calculation; transactional metric submission and system status update; optional dashboard seed data; threshold-based alert generation, querying, deduplication, escalation and Operations-only lifecycle management | `database`; commits `5851f3b`, `30ae710`, `7d94391`, `3f5f616`; replacement PR pending | Persistence, health-calculation, metric-submission, seed-data and alert integration coverage; full Java 21 backend suite: 50 tests passed, 0 failures, 0 errors |
| Wentao Chen | ELG2-12, ELG2-14 | UC2/UC3 Spring Boot read APIs: dashboard KPI summary, monitored-system list and details, recent metric history, stale/missing-data handling, threshold reasons, API documentation, and integration tests |  | 9 dashboard/system integration tests passed; full merged Java 21 backend suite: 42 tests passed, 0 failures, 0 errors |

Detailed authentication evidence is recorded in [authentication-evidence.md](authentication-evidence.md).
