# Advance verification — 31 October 2026 (Australia/Sydney)

Base: `advance` at `27a84e653350fc12a34f7af4b45ca60c516006cf` (same base as
`develop-3`). All feature changes were made on `advance`; no integration branch
was merged. Pre-existing untracked `output/` files were excluded.

## Local automated checks

| Check | Result |
| --- | --- |
| Java 21 backend suite, H2 Flyway V1–V6, real Redis test | 175 tests passed, no failures/errors/skips |
| Follow-up after final formatting and route handling changes | All 11 assistant/security integration tests passed again, including plain-text-to-JSON synthesis recovery and encoded-route limiting |
| React/Vitest | 79 tests passed across 15 files |
| Frontend production build | Passed |
| Executable backend package | Passed using a separate build directory |
| Live MySQL startup | MySQL 8.4.11 migrated V1–V6 and Hibernate schema validation passed |
| Real Redis | Redis 8.10.3 Windows MSYS2 port; cache TTL, namespace isolation and 60 concurrent increments across two service instances passed |

Backend tests cover role/CSRF restrictions, private documents, Chinese retrieval,
system filtering, updates/deletion, stale versions, hybrid retrieval and cached
embeddings, model failures, unknown references/tools, tool budget, ownership,
expired proposals, changed sources/alerts, idempotent confirmation and response
body timeouts. Frontend tests include the two-step confirmation flow, session
expiry, model outage evidence, Management read-only access and edit conflicts.

The full automated command was `scripts/verify-advance.ps1 -TestRedis -RedisPort
6386`, with Java 21 configured. The follow-up assistant test ran after the final
formatting change; no unrelated production code changed after the live run.

## Real model and database workflow

An independent local environment used backend `8086`, UI `5176`, MySQL `13316`,
Redis `6386` and Ollama `11436`. Models were the existing local
`qwen3.5:9b-q4_K_M` and `qwen3-embedding:0.6b`. It used a separate database,
generated credentials and explicitly synthetic monitored systems/runbooks.

All **17 live workflow checks** passed:

- Anonymous access and missing CSRF were rejected; private sources were hidden
  from Management. Responses included request IDs and `private, no-store`.
- A submitted CPU metric created a real alert, and an imported runbook was
  stored and indexed in MySQL.
- The embedding endpoint provided real hybrid retrieval, and Qwen returned an
  answer with known source references.
- Qwen selected `query_metrics`, `list_alerts`, `search_runbooks` and
  `propose_alert_action`, in addition to the initial `get_system` observation.
  The bounded loop completed with a source-referenced report.
- The alert remained ACTIVE after inference. The returned proposal required
  confirmation; Management was rejected. Two separate Operations sessions
  confirmed concurrently against MySQL and both received the same committed
  ACKNOWLEDGED result. The persisted alert matched it.

Additional middleware checks sent 20 Management Q&A requests with no visible
private evidence; the next request returned **429 + Retry-After**. Real Redis
contained content/model keyed embedding cache entries. Stopping the isolated
Redis server caused inference to return **503 + Retry-After**, while the
read-only runbook library remained available. Redis was restarted afterward.

The reusable loopback test is `scripts/smoke-advance.py`. It writes synthetic
fixtures and must run against a disposable local database with models enabled:

```sh
python scripts/smoke-advance.py
```

Provide `ADVANCE_BASE_URL`, `ADVANCE_OPERATIONS_USERNAME`,
`ADVANCE_MANAGEMENT_USERNAME`, `ADVANCE_OPERATIONS_PASSWORD` and
`ADVANCE_MANAGEMENT_PASSWORD` through the environment. Passwords and session
cookies are not included in its output. It saves a credential-free result at
`backend/target/advance-smoke.json` by default. It intentionally leaves the
synthetic fixture in place for review.

## Browser verification and boundaries

The actual local React application was signed into through its login form.
Runbook Q&A displayed a real Qwen answer, the source title, source version and
original excerpt. The library loaded persisted content and its current version
into the editor. The assistant had a two-column layout at 1280 px, and both the
assistant and library stayed within 320 px without horizontal document overflow.
The temporary viewport override was reset afterward.

This is local validation. Docker Compose execution, the Docker/Testcontainers
suite and remote CI were not run in this session. The workflow now targets
`advance` and includes a Redis service; its remote outcome must be checked
separately. This work does not establish public deployment, load capacity,
large-corpus retrieval quality or proven incident root causes.

## Follow-up: hanging request fix

The shared frontend source also appeared at the older `5173` preview, which was
still connected to the original `8080` backend. A build had overwritten that
running JVM's JAR, causing lazy class-loading errors on unsupported AI routes.
The browser had no whole-operation timeout, so it could remain on “Gathering
evidence” while waiting for that failed connection.

The original backend was rebuilt from the unchanged `27a84e6` source into a
separate directory and restored with its existing database and credentials.
Login returned 200 and the unsupported AI endpoint returned 404 in 0.03 seconds.
The AI preview uses `5176`/`8086`, and now runs from a copied immutable release
outside the Maven build directory. The affected Chrome tab was switched to that
preview and signed in.

The assistant now includes elapsed waiting time and cancellation. Its 55-second
Q&A and 110-second investigation browser deadlines include CSRF and transport
time. A never-resolving transport releases the UI at the deadline; cancellation
allows retry, retains the question and ignores old responses. Leaving the page
aborts its browser request. Backend Q&A shares one capped 45-second deadline
across retrieval and generation; Agent retrieval shares its existing 90-second
budget. Deadline exhaustion returns evidence without starting another model call.

Follow-up checks: 83 frontend tests passed, 15 affected backend tests passed,
frontend production build and executable backend package passed. These include
stalled-body HTTP timeout, expired retrieval budget, transport that never settles,
cancel/retry, stale response suppression and CSRF/mutation signal propagation.
Through the real `5176` proxy, the original question “how can we improve
efficiency” returned `insufficient_evidence` in 1.53 seconds; a question supported
by the CPU runbook returned `generated_with_sources` in 3.66 seconds. The question
“what the latest alert is” completed an investigation in 4.28 seconds using
`get_system` and `list_alerts`. These are individual local observations, not
performance guarantees. The original question was also retried in the actual
Chrome page, which displayed the evidence-insufficiency result and enabled the
form again.

## 2026-11-02: monitoring consistency and archived conversations

Java 21 backend packaging passed **264 tests**, including
`*Tests,H2FlywayMigrationIT`, in a separate build directory. Frontend Vitest
passed **119 tests across 18 files**, and its production build passed.
Regression coverage includes measured-only health counts, separate No data
and fresh/stale coverage, fixed summary query count, archived/ordinary context
and conversation isolation, and restoring page context after Archive/Undo.
Operational-answer checks cover incorrect counts, false freshness/current
availability, historical/negative/conditional wording, and suppressing actual
Agent drafts after an invalid final report.

The copied release was checked against the existing isolated native MySQL,
Redis and Ollama environment on `8086` (`5176` frontend). In this snapshot:

- Dashboard: 13 systems, 1 measured Healthy, 5 No data, 0 fresh and 8 stale
  latest readings. Both category totals matched the inventory.
- Archived chat received 0 archived alerts; ordinary chat received 11 alerts.
  Both returned source-referenced answers without changing the alerts.
- Dashboard chat returned the correct Healthy/No data counts and explained
  that stale/missing readings cannot establish current availability (8.77 s).
- Agent investigation completed using `get_system` and `list_alerts`, with
  no proposals (3.97 s).
- Runbook Q&A returned a hybrid retrieval answer with one validated citation
  (7.70 s).

These are individual local checks, not load-capacity guarantees. The answer
guard checks a limited set of common assertions, not every natural-language
claim. This follow-up did not execute Docker/Testcontainers or remote CI.
