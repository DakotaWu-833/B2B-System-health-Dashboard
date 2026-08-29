# UC-01 - Sign in and sign out

## Summary

| Field | Description |
| --- | --- |
| **Goal** | Access the monitoring dashboard through an authenticated session and end that session when finished. |
| **Primary actors** | Operations Staff; Management User |
| **Trigger** | A user wants to access protected system-health information. |
| **Related Jira issues** | ELG2-10; ELG2-15 |

## Preconditions

- The user has an active account recognised by the organisation.
- The system is available to receive a sign-in request.
- The user is not already using an active authenticated session.

## Main flow

1. The user opens the sign-in page.
2. The system asks for the user's username and password.
3. The user supplies both credentials and submits the request.
4. The system verifies the credentials without disclosing sensitive account information.
5. The system establishes an authenticated session for the user.
6. The system presents the system-health overview.
7. When finished, the user chooses to sign out.
8. The system ends the session and returns the user to the sign-in page.

## Alternate flows

### A1 - Existing session

1. The user returns while a valid session is still active.
2. The system recognises the session and presents the overview without requesting credentials again.

### A2 - Correcting missing input

1. The user omits a username or password.
2. The system identifies the missing input without submitting a sign-in attempt.
3. The user supplies the missing value and continues from step 3 of the main flow.

## Exception flows

### E1 - Credentials are not accepted

1. The system cannot verify the supplied credentials.
2. The system displays a generic failure message that does not reveal whether an account exists.
3. No authenticated session is created and the user may try again.

### E2 - Authentication service is unavailable

1. The sign-in request cannot be completed.
2. The system tells the user that the service is temporarily unavailable.
3. No authenticated session is created.

## Postconditions

- **Success:** The user has an authenticated session and can access the overview, or the user has signed out and the prior session is no longer valid.
- **Failure:** No new authenticated session exists and protected information remains inaccessible.

## Business rules

- Authentication failures must not expose credentials, password data or account-existence details.
- Protected monitoring information is available only during a valid authenticated session.
- The user's organisational role is retained for later authorisation decisions.
