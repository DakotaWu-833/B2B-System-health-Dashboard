# Sprint 3 backend handoff

> The sections below are dated historical handoff records. For the current develop-3 implementation and Docker/browser results, see [Sprint 3 integration](README.md) and [verification](verification.md).

## Implemented locally

- POST /api/systems and PUT /api/systems/{id}, validated request DTO and transactional persistence.
- Operations-only route rules; existing alert/metric permissions retained.
- System management integration tests, including missing/invalid CSRF, role denial,
  input validation, unknown IDs, NO_DATA and preserving calculated status.
- Permission matrix and frontend request contract in system-management-api.md.
- Completed system list: latestMetric, lastUpdated and metricDataStatus with null
  handling, stable latest-reading selection and two-query batch retrieval.

This is an uncommitted local working copy, not evidence of a reviewed or merged PR.
Owners, Jira issue IDs and actual review links must be filled by the team.
Profile API and email verification are separate assigned workstreams; this does
not claim their authorization or implementation is complete.

## Verification

Run with Java 21 from backend:

```powershell
mvn test
mvn -Pdatabase-integration verify
```

Record actual results below. H2 API tests do not establish a live MySQL/browser
result. MySQL migration checks require Docker; the frontend production files are
unchanged from the supplied Sprint 2 ZIP.

### Previous verification on 15 October 2026 (before list extension)

- Java: Eclipse Temurin 21.0.10; Maven 3.9.16.
- Full backend suite: **83 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**.
- SystemManagementIntegrationTests: 13 passing tests.
- PermissionMatrixIntegrationTests: 19 passing parameterized cases.
- Existing authentication, alert, metric, persistence and dashboard tests passed.
- Raw evidence: backend/target/surefire-reports (locally generated, not committed).
- Live MySQL, browser/form integration and database-integration profile were not run.

The normal test launch encountered a Windows Mockito dynamic-attachment pipe
error. The successful run explicitly preloaded the cached Byte Buddy agent using
the Maven argLine option; production configuration and dependencies are unchanged.
To reproduce in this workspace, run from backend:

```powershell
$env:JAVA_HOME='D:\jdk21'
$workspaceRoot = 'C:\Users\Tony\Documents\Codex\2026-09-04\github-plugin-github-openai-curated-remote'
$testCache = Join-Path $workspaceRoot '.m2/repository'
$testAgent = Join-Path $testCache 'net/bytebuddy/byte-buddy-agent/1.17.8/byte-buddy-agent-1.17.8.jar'
mvn -B "-Dmaven.repo.local=$testCache" "-DargLine=-javaagent:$testAgent" test
```

## Jira handoff status

System-management backend and the permission matrix for currently implemented
routes are ready for review. Do not claim frontend integration, future Profile/
email permissions, a reviewed PR or live MySQL acceptance has been completed.
Keep final acceptance open until the frontend and other account workstreams are
integrated. Each contributor records their actual implementation and review work.

## Scope confirmed on 16 October 2026

The user's two backend modules are monitored-system management and system-list
data completion. Existing route authorization/tests are retained as necessary
protection; they are not a claim of ownership of the entire security workstream.
Profile, email verification, Dashboard aggregation, evaluated-threshold additions
and frontend forms belong to other workstreams. Historical Sprint 1/2 materials
and frontend source are preserved. No unrelated implementation was removed.

### Verification on 16 October 2026

- Final verification in the fresh Git checkout on feature/sprint3-system-management-list:
  **87 tests passed, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS** (Java 21/H2).

- Full backend regression suite after list implementation: **86 passed**, no failures/errors/skips.
- After adding late-arriving-reading coverage and an additional metadata-update
  regression, reran both affected suites: **26 passed**, no failures/errors/skips
  (12 query tests and 14 system-management tests).
- Production source was unchanged between the full run and the targeted rerun.
- Query-count assertion confirms two SQL statements for a 12-system list after
  clearing the persistence context. Empty-list handling, FRESH/STALE/NO_DATA,
  timestamp ties and backdated submissions are covered.
- PUT regression verifies that changing metadata preserves status and metrics,
  and returns the actual latest metric timestamp rather than the edit time.
- Validation used H2; live MySQL and frontend integration remain outstanding.

### Files to coordinate with other backend owners

- MetricRepository adds findLatestForAllSystems() and a deterministic single-system
  latest-reading method. Existing methods remain available for other callers.
- SystemListItemResponse adds optional metric/time fields without removing original fields.
- SystemService changes list/detail latest-reading selection and system mutation behaviour.
- DashboardService and health-threshold response contracts are untouched.
