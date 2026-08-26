# API Contract - Sprint 1 Draft

The team should review this draft before feature development. All JSON APIs use the `/api` prefix and the common response envelope below.

```json
{
  "success": true,
  "data": {},
  "message": "Success"
}
```

## Planned endpoints

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Confirm frontend/backend connectivity |
| `GET` | `/api/auth/csrf` | Public | Start a session and obtain a CSRF token |
| `POST` | `/api/auth/login` | Public + CSRF | Authenticate a persisted user and create a session |
| `GET` | `/api/auth/me` | Authenticated | Retrieve the current public user profile |
| `POST` | `/api/auth/logout` | Authenticated + CSRF | Invalidate the authenticated session |
| `GET` | `/api/dashboard/summary` | Operations, Management | Retrieve KPI summary |
| `GET` | `/api/systems` | Operations, Management | List monitored systems |
| `GET` | `/api/systems/{id}` | Operations, Management | Retrieve one monitored system |
| `GET` | `/api/systems/{id}/metrics` | Operations, Management | Retrieve recent metrics |
| `POST` | `/api/systems/{id}/metrics` | Operations | Submit a metric reading |
| `GET` | `/api/alerts` | Operations, Management | Retrieve alerts |

## Shared enum values

- Role: `OPERATIONS`, `MANAGEMENT`
- Health status: `HEALTHY`, `WARNING`, `CRITICAL`, `OFFLINE`
- Alert severity: `WARNING`, `CRITICAL`
- Alert status: `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`

## Authentication contract

Sprint 1 uses a server-side HTTP session. The browser must include credentials on authentication requests. Before each state-changing request, call `GET /api/auth/csrf`, then send `data.token` in the header named by `data.headerName` (`X-CSRF-TOKEN`).

### Obtain a CSRF token

```http
GET /api/auth/csrf
```

```json
{
  "success": true,
  "data": {
    "token": "generated-token",
    "headerName": "X-CSRF-TOKEN",
    "parameterName": "_csrf"
  },
  "message": "CSRF token issued"
}
```

### Log in

```http
POST /api/auth/login
Content-Type: application/json
X-CSRF-TOKEN: generated-token
```

```json
{
  "username": "demo.operations",
  "password": "local-password"
}
```

A successful response is `200 OK` and creates a `JSESSIONID` session cookie:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "demo.operations",
    "role": "OPERATIONS"
  },
  "message": "Login successful"
}
```

The API never returns a password or password hash. Invalid or unknown credentials both return the same `401 Unauthorized` response:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid username or password"
}
```

Missing fields and malformed JSON return `400 Bad Request`. A protected endpoint without a valid session returns `401 Unauthorized`. A state-changing request without a valid CSRF token returns `403 Forbidden`.

### Read the current user

```http
GET /api/auth/me
Cookie: JSESSIONID=...
```

The response uses the same public user shape as successful login.

### Log out

Obtain a fresh CSRF token in the authenticated session, then call:

```http
POST /api/auth/logout
Cookie: JSESSIONID=...
X-CSRF-TOKEN: generated-token
```

The server invalidates the session and clears the session cookie. Complete endpoint-specific RBAC is outside the Sprint 1 authentication scope; Sprint 1 stores the user role and enforces authenticated versus public access.
