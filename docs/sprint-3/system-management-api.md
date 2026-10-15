# System management API and authorization contract

Local implementation baseline: supplied develop-2 ZIP (Sprint 2 Alert Centre included).

## Permission matrix

| Endpoint | Anonymous | Operations | Management |
| --- | --- | --- | --- |
| GET /api/health, GET /api/auth/csrf | Allowed | Allowed | Allowed |
| POST /api/auth/login | Valid credentials and CSRF required | Same | Same |
| GET /api/auth/me | 401 | Own identity | Own identity |
| POST /api/auth/logout | 401 with valid CSRF | Allowed with CSRF | Allowed with CSRF |
| GET /api/dashboard/summary | 401 | Read | Read |
| GET /api/systems, GET /api/systems/{id} | 401 | Read | Read |
| GET /api/systems/{id}/metrics, GET /api/alerts | 401 | Read | Read |
| POST /api/systems | 401 with valid CSRF | Create | 403 |
| PUT /api/systems/{id} | 401 with valid CSRF | Update | 403 |
| POST /api/systems/{id}/metrics | 401 with valid CSRF | Submit | 403 |
| PATCH /api/alerts/{id}/acknowledge or /resolve | 401 with valid CSRF | Mutate | 403 |

Missing/invalid CSRF on a mutation returns 403 before authorization; supply a valid
token when testing the distinction between 401 and role-based 403. The existing
safe JSON message is `Access denied` for both CSRF and permission rejections.

Management retains existing read access to details/history pending a different
team-approved policy. Profile extension and email verification belong to other
workstreams; their future endpoints require an explicit permission review.

## Request body (POST and PUT)

```json
{"name":"Orders API","type":"SERVICE","host":"orders.internal.example","description":"Order service"}
```

Name, type and host are required, nonblank strings with maximum lengths 120, 50
and 255. Description is optional, maximum 1000. Values are trimmed; blank or
omitted description becomes null. PUT replaces these editable fields, so omitted
description clears the old description. Health status is not an editable field.

POST returns 201; PUT returns 200. Both return the existing ApiResponse envelope
and a system list item (including description and the reading fields below). Invalid input
returns 400; unknown update ID returns 404. Re-read GET /api/systems/{id} for the
description, metrics and freshness information.

New systems use the existing HEALTHY enum default for schema compatibility, but
have no measurement evidence: detail returns latestMetric=null,
metricDataStatus=NO_DATA and a no-data reason. HEALTHY here must not be presented
as a measured health guarantee. Update preserves the existing calculated health
status, measurements and alerts and locks the system row during the transaction.

## Frontend integration sequence

1. Retain credentials: include on every API request.
2. GET /api/auth/csrf after login and before mutation; use returned headerName/token.
3. POST or PUT with Content-Type: application/json and the CSRF header.
4. On success refresh the system list/details. Handle 400/403/404 visibly and 401
   through the existing session-expiry callback.
5. Hide create/edit controls for Management, while relying on backend enforcement.

No frontend form or schema migration is required by this backend change. The
frontend owner implements the forms separately against this contract.

## GET /api/systems: completed list data

Existing fields remain: id, name, type, host, status, description. New fields:

| Field | Meaning |
| --- | --- |
| latestMetric | Existing MetricReadingResponse shape, or null |
| latestMetric.metricId | ID of the selected reading |
| latestMetric.cpuUsage / memoryUsage | Percent values |
| latestMetric.responseTime | Milliseconds |
| latestMetric.availability | Boolean |
| latestMetric.timestamp | UTC measurement timestamp |
| lastUpdated | Same measurement timestamp, or null; not a metadata-edit time |
| metricDataStatus | FRESH, STALE or NO_DATA |

```json
{
  "success": true,
  "data": [{
    "id": 1, "name": "Orders API", "type": "SERVICE",
    "host": "orders.internal.example", "status": "WARNING", "description": null,
    "latestMetric": {
      "metricId": 10, "cpuUsage": 80.00, "memoryUsage": 35.00,
      "responseTime": 150, "availability": true, "timestamp": "2026-10-16T00:00:00Z"
    },
    "lastUpdated": "2026-10-16T00:00:00Z", "metricDataStatus": "FRESH"
  }],
  "message": "Systems retrieved successfully"
}
```

Example freshness assumes the reading is retrieved within the configured window.
No readings: latestMetric=null, lastUpdated=null, metricDataStatus=NO_DATA.
Expired readings remain visible as STALE (default threshold PT5M); do not silently
replace them with zeros. Stored health status is separate from measurement freshness.

Latest means highest recordedAt, then highest metric ID on ties. List and detail
use this rule. List order is ascending system ID. The list uses two database
queries (one for systems and one for latest readings); an empty list uses one.
PUT returns the same latest reading/freshness fields without changing the reading.

For the Dashboard owner: MetricRepository.findLatestForAllSystems() is available
for reuse. Agree separately how stale/missing readings contribute to aggregates;
this module does not modify DashboardService or the threshold contract.
