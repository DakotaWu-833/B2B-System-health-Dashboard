# Sprint 2 Q&A Preparation

Answers should take 20-40 seconds: decision, reason, evidence, trade-off. Every
member must understand the whole project, not only read their own row.

## Shared facts everyone must know

- Architecture: React → Spring Boot REST API → JPA/MySQL; server-side session
  authentication.
- Sprint 2 delta: Alert Centre UI plus alert lifecycle integration; backend alert
  generation/lifecycle API was the Sprint 1 foundation.
- Allowed lifecycle: `ACTIVE → ACKNOWLEDGED → RESOLVED`, with direct
  `ACTIVE → RESOLVED`; invalid transitions return HTTP 409.
- Access: Operations and Management can read; only Operations can acknowledge or
  resolve. The backend is authoritative even if a client is modified.
- NFR evidence: RBAC + CSRF security; bounded paging, responsive layout,
  labelled/keyboard-visible controls and live messages.
- Verification: 20 frontend tests across 6 files and a successful production
  build; bring the fresh Java 21 backend result to the demo.

## Dakota Wu — scope, integration and process

**Why did you choose only this Sprint 2 scope?**
It completes a visible end-to-end workflow using the tested backend and maps
directly to two functional and two non-functional rubric requirements. Email,
bulk actions and configurable thresholds were deferred because they increase
risk without adding marks.

**How do you prove progress since Sprint 1?**
Sprint 1 stopped at backend alert endpoints. Sprint 2 adds a role-aware Alert
Centre, lifecycle actions, paging/error states, frontend tests and a single
rubric evidence pack. Jira/PR links show the time-bounded delta.

**How was work managed?**
Each backlog item has acceptance criteria, an owner, status and implementation/
review evidence. Definition of Done includes tests, Jira and documentation.

## Zhouguang Li — authentication and security

**Why use both UI role checks and backend RBAC?**
The UI avoids misleading controls, but it is not a security boundary. Spring
Security independently blocks Management mutation requests with 403.

**Why fetch a CSRF token before each mutation?**
Authentication uses cookies, which browsers send automatically. The CSRF token
proves the state-changing request originated from the application session.

**What happens when a session expires?**
Any 401 from dashboard, details or alerts clears the current user and returns to
sign-in; tests cover the Alert Centre path.

## Yixuan Huang — frontend design

**How is alert state kept consistent after an action?**
After a successful mutation, the client reloads the current server-side page
instead of guessing the new list. This respects the active filter and backend as
the source of truth.

**Why are loading, empty, error and success states explicit?**
Without them, a slow request and “no alerts” look identical. Live status/error
messages also support assistive technology and make the demo deterministic.

**How does the UI support small screens and keyboards?**
Controls stack below 720 px, tables can scroll horizontally, interactive rows
and controls have visible focus, and every filter/action has an accessible name.

## Zeheng Li — alert model and backend behaviour

**How are duplicate alerts avoided?**
For the same system/type, an existing open alert is reused and can be escalated;
the service does not create another open duplicate for every metric reading.

**Why enforce lifecycle transitions on the server?**
Multiple clients can act concurrently. Transactional, locked server updates
keep the state valid, while invalid/repeated transitions return 409.

**Why is pagination sorted by time and ID?**
Newest-first time is useful operationally; alert ID is a deterministic
tie-breaker when timestamps match, preventing unstable page boundaries.

## Wentao Chen — quality and verification

**What do the Sprint 2 frontend tests cover?**
Status filtering, Management read-only behaviour, CSRF-protected acknowledgement,
bounded next-page loading and session-expiry handling, plus existing login,
dashboard, details and API-client regressions.

**Which NFR is measurable?**
Every alert request asks for five records, and the backend caps size at 100. The
UI exposes deterministic Previous/Next controls rather than loading an
unbounded history.

**What would you test next?**
Browser-level tests against MySQL for both roles, including two simultaneous
Operators acting on one alert and a mobile-width accessibility audit.

## Two likely tutor challenges

**“Is alert generation itself really Sprint 2?”**
No. It is Sprint 1 foundation. The honest Sprint 2 increment is the user-facing
list/filter/pagination and lifecycle operation workflow. The demo explicitly
separates baseline from increment.

**“Does hiding a button secure the endpoint?”**
No. The backend `SecurityConfig` requires the Operations role and the integration
test proves a Management request receives 403. Hiding controls is only usability.
