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
| `POST` | `/api/auth/login` | Public | Authenticate a user |
| `GET` | `/api/dashboard/summary` | Operations, Management | Retrieve KPI summary |
| `GET` | `/api/systems` | Operations, Management | List monitored systems |
| `GET` | `/api/systems/{id}` | Operations, Management | Retrieve one monitored system |
| `GET` | `/api/systems/{id}/metrics` | Operations, Management | Retrieve recent metrics |
| `POST` | `/api/systems/{id}/metrics` | Operations | Submit a metric reading |
| `GET` | `/api/alerts` | Operations, Management | Retrieve alerts |

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

Document request bodies, response bodies and error cases in the relevant Jira issue before implementation.

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
