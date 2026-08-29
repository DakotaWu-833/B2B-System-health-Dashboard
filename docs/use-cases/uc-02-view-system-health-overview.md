# UC-02 - View system health overview

## Summary

| Field | Description |
| --- | --- |
| **Goal** | Understand the current health of the organisation's monitored systems at a glance. |
| **Primary actors** | Operations Staff; Management User |
| **Trigger** | An authenticated user opens the system-health overview. |
| **Related Jira issues** | ELG2-14; ELG2-16 |

## Preconditions

- The user has a valid authenticated session.
- The user is permitted to view monitoring information.

## Main flow

1. The user opens the system-health overview.
2. The system determines the current status of each monitored system from its latest available information.
3. The system presents the total number of monitored systems.
4. The system groups the totals into Healthy, Warning, Critical and Offline states.
5. The system presents a list of monitored systems with identifying information and current health state.
6. The user reviews the summary and identifies any system that needs further investigation.

## Alternate flows

### A1 - No monitored systems

1. No monitored systems are currently registered.
2. The system displays zero summary counts and an empty-state message instead of an error.

### A2 - Refresh the overview

1. The user requests the latest overview.
2. The system refreshes the summary and system list.
3. The user continues from step 6 of the main flow.

## Exception flows

### E1 - Monitoring information cannot be retrieved

1. The system cannot obtain the overview information.
2. The system displays a clear, non-technical error message.
3. Existing information is not presented as newly refreshed data.
4. The user may try again later.

### E2 - User session is no longer valid

1. The system determines that the user's session has expired or is invalid.
2. Protected overview information is not displayed.
3. The user is required to sign in again.

## Postconditions

- **Success:** The user understands the current distribution of system health and can choose a system to inspect.
- **Failure:** No monitoring data is changed and the user receives a safe explanation of why the overview is unavailable.

## Business rules

- The overview is read-only for both Sprint 1 actors.
- Health states use the shared Healthy, Warning, Critical and Offline vocabulary.
- Offline takes precedence over threshold-based states when a system is unavailable.
