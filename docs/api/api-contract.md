# API Contract

All JSON APIs use the `/api` prefix and the common response envelope below.

```json
{
  "success": true,
  "data": {},
  "message": "Success"
}
```

## Implemented endpoints

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
| `GET` | `/api/alerts` | Operations, Management | Retrieve paginated alerts |
| `PATCH` | `/api/alerts/{id}/acknowledge` | Operations | Acknowledge an active alert |
| `PATCH` | `/api/alerts/{id}/resolve` | Operations | Resolve an active or acknowledged alert |

## Submit a metric reading

`POST /api/systems/{id}/metrics` stores a timestamped metric and updates the monitored system's health status in the same database transaction. The backend assigns the timestamp when it receives the reading.

### Request body

```json
{
  "cpuUsage": 72.5,
  "memoryUsage": 68.25,
  "responseTime": 240,
  "availability": true
}
```

CPU and memory usage must be between `0` and `100`, response time must be non-negative, and all four fields are required.

### Success response

The endpoint returns `201 Created`.

```json
{
  "success": true,
  "data": {
    "metricId": 42,
    "systemId": 7,
    "cpuUsage": 72.5,
    "memoryUsage": 68.25,
    "responseTime": 240,
    "availability": true,
    "timestamp": "2026-08-26T10:30:00Z",
    "systemStatus": "HEALTHY"
  },
  "message": "Metric submitted successfully"
}
```

### Error responses

- `400 Bad Request` when a required field is missing or a metric is outside its valid range.
- `404 Not Found` when the monitored system does not exist.

Errors use the common response envelope with `success` set to `false` and `data` set to `null`.

## Shared enum values

- Role: `OPERATIONS`, `MANAGEMENT`
- Health status: `HEALTHY`, `WARNING`, `CRITICAL`, `OFFLINE`
- Alert severity: `WARNING`, `CRITICAL`
- Alert status: `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`
- Alert type: `HIGH_CPU`, `HIGH_MEMORY`, `SLOW_RESPONSE`, `SERVICE_UNAVAILABLE`

## Alerts

Submitting an abnormal metric automatically creates one alert for each exceeded metric
threshold. An unavailable reading creates only a `SERVICE_UNAVAILABLE` alert. The metric,
system status and any new alerts are persisted in the same transaction.

An unresolved alert is not duplicated when later readings report the same condition. If
an acknowledged warning becomes critical, the existing alert is upgraded to `CRITICAL`
and becomes `ACTIVE` again.

`GET /api/alerts` returns alerts newest first. Optional `status` and `systemId` query
parameters can be used separately or together. Results are paged with zero-based `page`
(default `0`) and `size` (default `20`, maximum `100`) parameters. Invalid pagination
values return `400 Bad Request` using the common response envelope.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "alertId": 9,
        "systemId": 3,
        "systemName": "Payment API",
        "alertType": "HIGH_CPU",
        "severity": "WARNING",
        "message": "CPU usage reached the warning threshold",
        "status": "ACTIVE",
        "createdTime": "2026-08-28T01:05:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "first": true,
    "last": true
  },
  "message": "Alerts retrieved successfully"
}
```

`PATCH /api/alerts/{id}/acknowledge` changes an active alert to `ACKNOWLEDGED`.
Only Operations users may call alert status mutation endpoints. Repeating an acknowledge,
acknowledging a resolved alert, repeating a resolve, or making any other invalid status
transition returns `409 Conflict`. `PATCH /api/alerts/{id}/resolve` changes an active or
acknowledged alert to `RESOLVED`. An unknown alert ID returns `404 Not Found`.

## Authentication contract

The application uses a server-side HTTP session. The browser must include credentials on authentication requests. Before each state-changing request, call `GET /api/auth/csrf`, then send `data.token` in the header named by `data.headerName` (`X-CSRF-TOKEN`).

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

The server invalidates the session and clears the session cookie. Authentication stores the user
role, enforces authenticated versus public access, and restricts alert status mutation
endpoints to Operations users.

## Dashboard and system queries

- `GET /api/dashboard/summary` returns `total`, `healthy`, `warning`, `critical`, and
  `offline` counts. An empty database returns zero for every count.
- `GET /api/systems` returns all monitored systems as a JSON array. An empty database
  returns an empty array.
- `GET /api/systems/{id}` returns system details, the latest metric, a metric data status
  (`NO_DATA`, `FRESH`, or `STALE`), and human-readable threshold reasons.
- `GET /api/systems/{id}/metrics` returns up to 100 readings ordered newest first.
- System-specific endpoints return `404 Not Found` when the system does not exist.

Metric data is stale when its timestamp is older than `app.metrics.stale-after`, which
defaults to five minutes (`PT5M`).
