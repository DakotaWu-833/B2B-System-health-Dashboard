# Sprint 2 Verification Record

## Current results

| Check | Command | Result | Date |
| --- | --- | --- | --- |
| Frontend automated tests | `cd frontend; pnpm test` | **PASS — 20 tests, 6 files** | 21 Sep 2026 |
| Frontend production build | `cd frontend; pnpm build` | **PASS — 21 modules transformed** | 21 Sep 2026 |
| Backend automated tests | `cd backend; .\mvnw.cmd clean test` | **RE-RUN REQUIRED WITH JAVA 21**; current machine resolves Java 8 | Before tutor check |

Sprint 2 did not change backend production code. The repository's last recorded
integrated Sprint 1 result was 51 passing backend tests, but that historical
result must not be presented as a fresh Sprint 2 run.

## Evidence covered by the frontend suite

- Alert list and lifecycle-status filtering.
- Management read-only presentation.
- Operations acknowledgement using a CSRF-protected PATCH request.
- Five-record server-side pagination.
- Session-expiry recovery.
- Existing login/logout, dashboard, system details, error/empty states and API
  base URL behaviour.

## Presentation-machine commands

```powershell
java -version
cd backend
.\mvnw.cmd clean test
cd ..\frontend
pnpm test
pnpm build
```

Paste the fresh backend summary here and capture one screenshot:

> **ADD JAVA 21 BACKEND RESULT, DATE AND MACHINE OWNER**
