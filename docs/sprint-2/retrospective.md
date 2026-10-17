# Sprint 2 Retrospective

**Review draft:** 21 September 2026

**Team:** Dakota Wu, Zhouguang Li, Yixuan Huang, Zeheng Li and Wentao Chen

The team should validate this short draft together and add the meeting date
before presenting it.

## Outcome

Sprint 2 delivered a user-facing alert workflow on top of the Sprint 1 backend.
Users can inspect lifecycle-filtered alerts in bounded pages, while Operations
users can acknowledge and resolve incidents through CSRF-protected requests.
The frontend suite now passes 20 tests across six files and the production build
succeeds.

## Successes

- Reusing the tested Sprint 1 alert API kept the Sprint 2 increment small and
  produced two complete, demonstrable user features instead of another partial
  backend component.
- Security and usability were included in acceptance criteria: role-aware
  controls, backend RBAC, fresh CSRF tokens, keyboard-visible focus, live status
  feedback and responsive layout.
- One evidence index now maps every rubric item to a screen, test or document,
  reducing time lost during the ten-minute check.

## Challenges

- The alert capability existed in the backend but was invisible to end users;
  this made progress look smaller than it was until the vertical slice was
  completed.
- Contribution evidence can drift from Git/Jira activity when it is prepared at
  the end of the sprint.
- One development machine currently defaults to Java 8 although the backend
  requires Java 21, which makes last-minute backend verification unreliable.

## Improvements for the next sprint

| Improvement | Owner | Measurable completion rule |
| --- | --- | --- |
| Update Jira and the contribution row in the same pull request | Every issue owner | No Done item lacks an assignee, acceptance evidence and PR/review link |
| Add a Java 21 preflight check to rehearsal | Dakota Wu | Backend test command runs before both rehearsals, not on presentation day |
| Prefer one small vertical slice per story | Feature owner | Each story has visible UI, API behaviour, tests and error handling before Done |
| Cross-train for tutor questions | All members | Every member answers one own-area and one cross-area question in both rehearsals |
