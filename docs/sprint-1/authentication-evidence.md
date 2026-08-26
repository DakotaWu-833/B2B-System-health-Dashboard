# ELG2-10 Authentication Evidence

## Delivered scope

- Reuse the database workstream's canonical `dashboard.user.User` model and `users` table, with a unique username, BCrypt password hash and role.
- Database-backed Spring Security `UserDetailsService`.
- Optional environment-controlled demo-user seed; disabled by default and never logs the password.
- CSRF-protected server-side session endpoints for login, current user and logout.
- Public health and CSRF endpoints; all other endpoints require authentication by default.
- Consistent safe JSON responses for validation, malformed JSON, invalid credentials, unauthenticated access and CSRF rejection.
- Sprint 1 stores the role in the authenticated principal. Full endpoint-specific RBAC remains later-Sprint work.

## Acceptance criteria traceability

| Acceptance criterion | Implementation and automated evidence |
| --- | --- |
| Credentials are read from MySQL and a session/token contract is returned | Shared `User`, `UserRepository`, `DatabaseUserDetailsService`, `AuthController`; repository, service and successful-login integration tests |
| Passwords are not stored or logged in plain text | `BCryptPasswordEncoder`; `DemoUserSeederTests` verifies a BCrypt hash and the API integration test verifies password fields are absent |
| Missing, malformed and invalid credentials return safe errors | `AuthExceptionHandler`; blank, malformed, incorrect-password and unknown-user integration tests |
| Protected endpoints reject unauthenticated users | Spring Security default-deny route policy plus unauthenticated `/api/auth/me` integration test |
| Tests cover successful login and principal failure paths | Repository, service, seeder, login/session/logout and failure-path suites |

## Local verification

From `backend` on Windows PowerShell:

```powershell
$env:JAVA_HOME="D:\jdk21"
.\mvnw.cmd test
```

Expected result: `BUILD SUCCESS` with all tests passing.

## Five-minute demo flow

1. Start MySQL and the backend with the environment-controlled demo user enabled.
2. Call `GET /api/health` to show that it remains public.
3. Call `GET /api/auth/csrf` and keep the session plus returned token.
4. Log in with `POST /api/auth/login`; show the public user response and `JSESSIONID`.
5. Call `GET /api/auth/me` using that session and receive `200 OK`.
6. Call `POST /api/auth/logout` with a fresh CSRF token.
7. Repeat `GET /api/auth/me` and receive the safe `401 Authentication required` response.
8. Attempt a bad password and show the generic `401 Invalid username or password` response.

## Git evidence

- Branch: `authentication-backend`
- `c03fd2d` — Spring Security authentication baseline
- `9345067` — persisted user accounts and repository tests
- `03789d6` — BCrypt database authentication and safe seed user
- `f86f0e6` — session login/current-user/logout API and happy-path tests
- `7305eff` — safe authentication failure handling and failure-path tests

Link the branch and resulting pull request to Jira ELG2-10. Add the final documentation commit and pull-request URL to this file or the Jira completion note when available.
