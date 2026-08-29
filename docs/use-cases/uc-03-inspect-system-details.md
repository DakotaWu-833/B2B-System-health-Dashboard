# UC-03 - Inspect system details and recent metrics

## Summary

| Field | Description |
| --- | --- |
| **Goal** | Investigate one monitored system by reviewing its current state, explanatory reasons and recent measurements. |
| **Primary actors** | Operations Staff; Management User |
| **Trigger** | The user selects a monitored system from the health overview. |
| **Related Jira issues** | ELG2-12; ELG2-13; ELG2-16 |

## Preconditions

- The user has a valid authenticated session and permission to view monitoring information.
- The user has opened the system-health overview.
- The selected monitored system exists when the use case begins.

## Main flow

1. The user selects a monitored system from the overview.
2. The system presents the selected system's name, type, host, description and current health state.
3. The system presents the latest available measurement and indicates whether that information is fresh or stale.
4. The system explains the health state using understandable reasons.
5. The system presents recent measurements in newest-first order, including time, CPU usage, memory usage, response time and availability.
6. The user compares the recent measurements and reasons to understand the system's condition.
7. The user returns to the overview or selects another system.

## Alternate flows

### A1 - No measurements are available

1. The selected system exists but has no recorded measurements.
2. The system presents the system information and a clear no-data state.
3. The system does not invent a current measurement or threshold reason.

### A2 - Latest measurement is stale

1. The latest measurement is older than the accepted freshness period.
2. The system labels the information as stale.
3. The user may still review the historical measurements with that limitation clearly visible.

### A3 - System is unavailable

1. The latest measurement reports that the system is unavailable.
2. The system presents the health state as Offline.
3. The system explains that the system is unavailable instead of listing lower-priority threshold reasons.

## Exception flows

### E1 - Selected system no longer exists

1. The system cannot find the selected monitored system.
2. The system displays a not-found message and does not display unrelated system information.
3. The user may return to the refreshed overview.

### E2 - Detail or measurement information cannot be retrieved

1. The system cannot complete the request.
2. The system displays a clear error state rather than incomplete data presented as complete.
3. The user may retry or return to the overview.

### E3 - User session is no longer valid

1. The user's authenticated session has expired or become invalid.
2. The system withholds protected detail information and requires the user to sign in again.

## Postconditions

- **Success:** The user has reviewed the selected system's current condition and recent measurements; no monitoring data has been modified.
- **Failure:** No monitoring data has been modified and no information from another system has been substituted.

## Business rules

- Measurements are presented newest first.
- Missing and stale data are explicitly distinguished from fresh data.
- Offline status takes precedence over CPU, memory and response-time thresholds.
- Status reasons use domain language that a business user can understand.
