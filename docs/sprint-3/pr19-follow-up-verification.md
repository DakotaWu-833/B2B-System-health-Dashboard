# PR #19 integration follow-up verification

**Date:** 19 October 2026, Australia/Sydney

**Code and test revision:** `b0ea36c4d748b26cd234989a97e08cb2d99337a7`

**PR:** [#19](https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/19)

**Integrated baseline:** `develop-3` at `73331e3727f0c3d7aa0d362791615e2b532a984a`, including merged PR #18

**Delivery:** fast-forward update to the existing `database` branch; no merge of PR #19 into `develop-3` or `main` is implied.

## Changes verified

- Resolve the eight frontend conflicts against merged PR #18. Retain manual metric entry, role-aware system creation/editing, active-alert and metric KPIs, configured thresholds, system/status alert filtering, detail retry and visible logout failure/retry.
- Keep PR #19's bounded system pages, time-range/cursor history and personal-profile/email-verification interface. Additional alert-filter options use explicit bounded page requests rather than an unbounded legacy system list or an automatic traversal of every page.
- Route initial history loading, time-range changes and older-history requests through one cancellation boundary. A superseded response cannot overwrite the newer range result, even if the mock transport ignores cancellation.
- Align the timestamp-tied history fixture with the microsecond precision of DATETIME(6), avoiding a persistence-context/database precision mismatch. This corrects a reproducibility issue; the original H2 test failure was not evidence of a confirmed production MySQL pagination defect.
- Commit the new regression tests rather than relying on untracked local validation.

## Current results

| Check | Result | Environment / scope |
| --- | --- | --- |
| Backend regular suite | 158 passed; 0 failures/errors/skips | Java 21.0.12.1, Maven Wrapper; H2-backed application tests and unit tests |
| H2 Flyway migration | 1 passed | V1-V5 migrations and JPA schema validation |
| Frontend suite | 64 passed across 12 files | Node 24.20.0, pnpm 11.19.0, frozen-lockfile install |
| Production build | Passed | Vite production bundle |
| Standalone MySQL/API checks | 26 passed | Disposable MySQL 8.4.11 on loopback, packaged Spring Boot application, real session login/CSRF; no mocked database or HTTP responses |
| Whitespace and conflict checks | Passed | No unresolved merge entries or conflict markers in the delivered source |

Commands for the committed automated tests:

```sh
cd backend
./mvnw clean test
./mvnw -Dtest=H2FlywayMigrationIT test
./mvnw -DskipTests package
cd ../frontend
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Windows uses `mvnw.cmd` with JAVA_HOME set to the Java 21 runtime. The package command runs after the successful test commands; its skip flag avoids repeating the same checks and is not used as test evidence.

## Standalone MySQL coverage

The disposable database and application were started with unique test data and locally generated credentials, bound only to loopback. Both services were stopped after verification; the team's configured database was not used.

1. Fresh startup applies migrations V1, V2, V3, V4 and V5 and validates the model.
2. Operations session login and CSRF-protected requests work. Anonymous monitoring reads return 401; Management can read but receives 403 for operational writes/maintenance.
3. Create, duplicate-create rejection (409), edit, conflicting-edit rejection (409) and measurement-time preservation work.
4. Metric submission, health calculation, alert generation, configured thresholds, active-alert count and acknowledgement are retained. Dashboard averages use latest fresh available readings; list/detail/edit agree on stale status.
5. System paging returns bounded items and totals. Excess decimal precision and fractional response times return 400 without metric inserts.
6. A dedicated system with **125 records sharing a database timestamp** is read across **seven history pages**, terminating without duplicate or missing IDs.
7. Profile updates normalize email; an email collision across roles returns 409. With SMTP explicitly disabled, sending returns 503 and rolls back the verification challenge.
8. Retention preview reports disabled by default; execution returns 409 without deleting records.
9. After stopping and restarting the application, session login, saved email and metric history still work, with exactly five successful Flyway migrations and no reapplication.

These are 26 smoke assertions covering the scenarios above; they are separate from the project's Testcontainers suite. They do not test real SMTP receipt or email verification completion.

## Evidence boundaries

Docker is unavailable on this verification machine. The Docker MySQL/Mailpit integration suite, remote GitHub Actions and a new full browser acceptance run were **not executed for this revision**. The 18 October results in [verification.md](verification.md), [automated-results.json](evidence/automated-results.json), screenshots and source manifest describe the earlier PR #19 snapshot and remain historical evidence.

Before accepting this updated PR, run `bash scripts/verify.sh` on a Docker-capable machine and attach the tested SHA and fresh reports. Repeat the combined UI workflow in a browser, including time-range changes under a slow response, system-filter option loading, manual metric submission with KPI/alert refresh, profile verification against local Mailpit and logout failure/retry. Final user-task evaluation, accessibility review, timed rehearsals and external email delivery remain separate acceptance work.

Local logs and the disposable smoke harness are retained outside tracked source in `F:/tec/5619/output/pr19-fix-2026-10-19/`; regular-suite/build logs are under its parent output directory. No credentials, codes, database dumps or generated build outputs are committed.
