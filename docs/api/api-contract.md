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

## Shared enum values

- Role: `OPERATIONS`, `MANAGEMENT`
- Health status: `HEALTHY`, `WARNING`, `CRITICAL`, `OFFLINE`
- Alert severity: `WARNING`, `CRITICAL`
- Alert status: `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`

Document request bodies, response bodies and error cases in the relevant Jira issue before implementation.
