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

CPU and memory usage must be between `0` and `100` with at most two fractional digits. Response time must be a non-negative JSON integer in milliseconds. All four fields are required.

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

### Dashboard alert count and metric KPIs (ELG2-26)

`GET /api/dashboard/summary` retains the five existing stored-system counts and
adds five fields inside `data`:

| Field | Type / unit | Meaning |
| --- | --- | --- |
| `activeAlertCount` | Integer count | All alerts whose status is exactly `ACTIVE`, across all systems |
| `averageCpuUsage` | Number, percent (0-100), or null | Mean CPU usage of eligible latest readings |
| `averageMemoryUsage` | Number, percent (0-100), or null | Mean memory usage of eligible latest readings |
| `averageResponseTime` | Number, milliseconds, or null | Mean response time of eligible latest readings |
| `evaluatedAt` | UTC ISO-8601 timestamp | Time this summary was evaluated, also used for all freshness decisions in this response |

Example response:

```json
{
  "success": true,
  "data": {
    "total": 3,
    "healthy": 1,
    "warning": 1,
    "critical": 0,
    "offline": 1,
    "activeAlertCount": 2,
    "averageCpuUsage": 40.00,
    "averageMemoryUsage": 50.00,
    "averageResponseTime": 200.00,
    "evaluatedAt": "2026-10-18T09:30:00Z"
  },
  "message": "Dashboard summary retrieved successfully"
}
```

Aggregation rules:

- Select at most one reading per system: highest `recordedAt`, then highest
  metric ID when timestamps tie. Late insertion of an older reading does not
  replace the latest measurement. Selection happens before eligibility filtering.
- A reading is eligible only if `availability` is true and it is `FRESH` under
  `app.metrics.stale-after`. All readings use one evaluation time per request,
  with the same freshness policy as system details. A timestamp exactly at the
  freshness cutoff is still fresh; an older timestamp is stale.
- Each eligible system contributes equally. Historical readings do not increase
  a system's weight. Missing, stale and unavailable readings are excluded, and
  an unavailable latest reading never falls back to an older available one.
- Round each mean to two decimal places using decimal arithmetic and `HALF_UP`.
  With no eligible readings, all three average fields are explicitly `null`.
  A measured zero remains the number zero and is not treated as missing.
- An empty database returns all six counts as zero and all three averages as
  null. The original five counts still reflect persisted system statuses,
  independently of metric freshness; reading the summary does not change them.
- `activeAlertCount` counts alerts, not affected systems or the current alert
  page. `ACKNOWLEDGED` and `RESOLVED` are excluded. Alert age and metric freshness
  do not remove an alert from this count. Acknowledgement or resolution changes
  the count on the next summary request according to the stored alert status.
- `evaluatedAt` is returned even when there are no eligible readings or systems.
  It is the summary evaluation time, not a measurement timestamp or proof that a
  system has fresh data. Display it as the summary update time; individual
  measurement times remain available in `GET /api/systems` as `lastUpdated`.

The latest readings are fetched in a single batch using
`MetricRepository.findLatestForAllSystems()`, matching the system-management/list
workstream's query. Dashboard aggregation does not issue a query per system or
load full metric history. Access remains authenticated for Operations and
Management; anonymous requests return `401`. The frontend can consume the new
fields without changing existing summary field names.

# Sprint 3 system-management extension

See [system management and permission contract](../sprint-3/system-management-api.md)
for POST /api/systems, PUT /api/systems/{id}, enriched GET /api/systems data,
validation and role requirements.

### Evaluated health thresholds (ELG2-25)

`GET /api/systems/{id}` also returns `data.evaluatedThresholds`. Existing response
fields are unchanged. This object exposes the current runtime configuration used
by both the health-status calculator and the detail API's `statusReasons`, including
environment-variable or Spring property overrides. The values are not hard-coded
response defaults or a historical snapshot of the configuration when a reading
was submitted. Returning thresholds does not recalculate the stored system status.

With the default configuration, the additional field is:

```json
{
  "evaluatedThresholds": {
    "cpuWarning": 75.0,
    "cpuCritical": 90.0,
    "memoryWarning": 75.0,
    "memoryCritical": 90.0,
    "responseTimeWarning": 500,
    "responseTimeCritical": 1000
  }
}
```

| Fields | Unit | Comparison |
| --- | --- | --- |
| `cpuWarning`, `cpuCritical` | CPU usage percent (0-100) | Reading `>=` threshold |
| `memoryWarning`, `memoryCritical` | Memory usage percent (0-100) | Reading `>=` threshold |
| `responseTimeWarning`, `responseTimeCritical` | Milliseconds | Reading `>=` threshold |

Critical takes precedence over Warning for each metric. Unavailable readings retain
only the `System is unavailable` reason, even if stale or above thresholds.
Threshold configuration remains visible for `FRESH`, `STALE`, `NO_DATA` and offline
readings; its presence does not mean a measurement exists or is fresh. Missing
readings still return `latestMetric: null` and only the no-data reason. Stale
available readings retain their stale warning and any threshold reasons.

Access remains authenticated for both Operations and Management users. Unknown
system IDs retain the existing `404` response.

## Sprint 3 integrated additions (develop-3)

All responses retain `{success,data,message}`. Authentication uses the existing server session cookie; mutations additionally require the current `/api/auth/csrf` token. Never send a user ID or role when editing a profile.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| POST | `/api/systems` | Operations + CSRF | 201 system; duplicate identity 409 |
| PUT | `/api/systems/{id}` | Operations + CSRF | 200 system; missing 404; duplicate 409 |
| GET | `/api/systems/page?page=0&size=10` | Both roles | 200 paged systems with latest readings |
| GET | `/api/systems/{id}/metrics/history` | Both roles | 200 bounded time window and cursor |
| GET | `/api/profile` | Both roles, own user | 200 profile from the database |
| PUT | `/api/profile` | Both roles, own user + CSRF | 200 saved profile |
| POST | `/api/profile/email-verification` | Both roles, own user + CSRF | 200 `{expiresAt,resendAt}` after SMTP accepts mail |
| POST | `/api/profile/email-verification/confirm` | Both roles, own user + CSRF | 200 verified profile |
| GET | `/api/admin/metrics-retention/preview` | Operations | 200 preview; no data changes |
| POST | `/api/admin/metrics-retention/run` | Operations + CSRF | 200 one archive batch; 409 if disabled |

### Numbers and freshness

CPU/memory are required JSON numbers in `[0,100]` with **at most two fractional digits**, matching `DECIMAL(5,2)`. Excess precision is rejected with 400 before any write; it is not rounded into another health band. `responseTime` is a required non-negative JSON **integer in milliseconds**; fractional JSON values, including `-0.9`, are rejected with 400. `availability` is required and non-null. Illegal submissions leave metrics, calculated system status and alerts unchanged.

`latestMetric` and `lastUpdated` are null for NO_DATA. `metricDataStatus` distinguishes NO_DATA, FRESH and STALE independently of health. Summary averages use fresh available readings; real zero is returned as 0, absent applicable readings as null. `activeAlertCount` counts ACTIVE, independently of freshness. `evaluatedAt` is the summary evaluation time. The configured freshness duration must be positive.

### System pagination

`/api/systems/page` returns `data: {items,page,size,totalElements,totalPages,first,last}`. Page is zero-based, bounded to `0..1000000`; size defaults to 20 and is `1..100`. Sorting is stable by ascending system ID. Latest metrics are retrieved in a batch scoped to the returned systems. The legacy `/api/systems` array remains for at most 500 systems; larger lists return 400 instructing the client to use `/page`. This prevents an unbounded legacy response.

### Metric history

`GET /api/systems/{id}/metrics/history?from=<ISO-Instant>&to=<ISO-Instant>&size=20&cursor=<opaque>` returns `{items,nextCursor,hasMore,from,to}`. Defaults: the last seven days, 20 records; maximum: 31 days per window, 100 per page. Invalid ranges, dates, cursors or sizes return 400; missing system returns 404. Order is `(recordedAt DESC, metricId DESC)`. Equal timestamps do not skip/duplicate records. The cursor preserves the original time window; reuse that returned cursor without changing the range. New readings after its upper bound appear after a fresh query. The old `/metrics` route remains a stable latest-100 array.

Retention is opt-in. Archived readings leave these active-history endpoints; retained archive data is available to authorized database maintenance/export tooling, not a new public archive endpoint.

### Current profile and email lifecycle

Profile shape: `{id,username,role,email,emailVerified,emailVerifiedAt}`. Nullable email/date support existing users. No password/hash/verification code is returned. PUT accepts `{email:"owner@example.test"}`; spaces are trimmed and ASCII email is lowercased, with maximum length 254. Invalid/missing addresses return 400 and case-normalized duplicate addresses return 409. Names, roles and verification state cannot be changed through this endpoint. A changed email resets verification/date and invalidates the previous challenge. Saving the unchanged normalized email preserves verification.

Sending requires a stored unverified address. Codes are random six-digit values stored only as BCrypt hashes, bound to the requesting user and target email. Defaults: 15-minute expiry, one send per 60 seconds per user, at most five wrong attempts per issued code. Changing email does not bypass the send cooldown. Reissuing invalidates the old challenge. Confirmation body is `{code:"012345"}`; the value is a string preserving leading zeroes. A correct code atomically consumes the challenge and persists verification/date. Wrong-attempt counters commit even when the HTTP response is an error.

| Condition | HTTP | Safe behavior |
| --- | --- | --- |
| Malformed/incorrect code, missing email/challenge | 400 | No verification; wrong guesses are counted |
| Session missing/expired | 401 | Frontend returns to login |
| Missing/invalid CSRF or disallowed role | 403 | No mutation |
| Duplicate email/system, consumed code, already verified | 409 | Original record remains valid |
| Expired code | 410 | Request a new code |
| Resend cooldown / exhausted guesses | 429 | Cooldown includes `Retry-After` seconds |
| SMTP disabled/fails | 503 | No newly persisted challenge or false verification |
| Transaction still locked after five attempts | 503 | Safe error with `Retry-After: 1`; never partial write |

Metrics, alert actions, profile changes and retention use complete transaction retries at READ COMMITTED, with explicit row locks and a maximum of five attempts. Alert transition conflicts remain 409. Server diagnostic details are not exposed to clients. SMTP acceptance proves transport delivery to the configured server; local Mailpit acceptance does not establish external provider delivery.
