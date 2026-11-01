# Operations assistant on `advance`

This extension connects the existing Spring Boot monitoring domain to Redis,
versioned runbook retrieval and a bounded model-directed investigation agent.
The React navigation includes **Operations assistant** with Runbook Q&A,
Investigate a system and Runbook library views.

## Ask AI from any workspace page

Every signed-in business page now has an **Ask AI** launcher at the lower right.
It opens a compact conversation on the right without leaving the page. Dashboard,
systems, alerts, profile, retention and the knowledge workspace each provide
their own preset questions **above the message input**. Clicking a preset sends
that question immediately. Presets remain available after a response and change
with the page or selected alert; they are not an empty-state-only feature.

Alert rows and system cards also have **Ask AI** buttons. They select that
record, open the conversation and prepare a question. **Clear selection** returns
to the page/filter context. A selected system/alert also offers an
**Investigate** button that runs the existing bounded Agent through the same
conversation and retains the existing review/confirmation step for alert writes.

Normal chat reads current server-side snapshots for the selected page and
retrieves visible runbooks. It can therefore explain current alert/system data
and page workflows without requiring a matching runbook for every question.
Snapshots use `T` references, and versioned runbooks use `D` references. Lists are
bounded samples: dashboard active alerts up to eight, inventory/alert context up
to ten, and metric context up to ten readings in the last seven days. Alert
context carries system/status filters; free-text inventory/alert search and
client-side sort/page position are not replicated in the snapshot.

Selected-system evidence separates **last reported health**, measurement
freshness and **current availability**. Missing/outdated readings make current
availability `UNKNOWN`; a visible notice is shown before the answer. Alert
workflow status is separate from the historical monitoring event. The model also
receives the current UTC observation time. Invalid reference formatting may be
retried once within the same deadline; unknown references are still suppressed.

The server validates page and record IDs, resolves an alert's actual system and
rejects mismatched selections. It loads account verification booleans without
sending the email address, password or verification code to the model. Management
does not receive maintenance-preview data or Operations-only runbooks. Chat itself
cannot change account details, run archive maintenance or mutate an alert.

Conversations are scoped to page/selection and kept only in browser memory
(up to 12 scopes, 40 messages each). Closing the panel preserves them; signing
out clears them. A follow-up sends at most six user/assistant messages, 800
characters each, further capped to 2,400 characters on the server. This history
is untrusted discussion, not fresh operational evidence. Changing context cancels
the old browser request and late responses cannot enter the new conversation.
The existing 55/110-second limits and cancellation apply to chat/investigation.
The launcher also mounts inside native system dialogs so it remains operable
there; Escape closes the conversation before closing the underlying dialog.

## What is implemented

- Operations can paste or import UTF-8 text/Markdown runbooks, edit and delete
  them. MySQL stores the document, version and overlapping 900-character
  excerpts. Updates require the version last read and replace the searchable
  chunks in the same transaction. Limits: 32,000 characters per document, 200
  documents in the library listing, 1,000 chunks in a retrieval scope.
- Runbooks can be global or attached to an existing system, and shared or
  Operations-only. Role and system filters run **before** retrieval. Management
  receives 404 for a private document. Current monitoring data retains the
  application's existing global Operations/Management scope; this is not a
  multi-tenant system.
- Retrieval uses multilingual BM25, including Chinese character/bigram tokens.
  With an embedding model enabled, up to 256 scoped chunks also receive cosine
  retrieval and reciprocal rank fusion (`k=60`, cosine minimum `0.5`). Larger
  scopes use BM25. This implementation scans a bounded corpus in memory; it is
  not an external vector database or a large-corpus search service.
- Redis caches embeddings for seven days, using a SHA-256 key over endpoint,
  model and content. A changed document uses a different cache entry. Deleting
  a document removes its searchable chunks immediately; old embedding cache
  entries expire and cannot produce a source on their own. Plain document text
  and generated answers are not stored in Redis.
- Ollama `/api/chat` produces source-referenced answers. Unknown references or
  malformed responses suppress the answer. The backend attaches validated
  references if the model omits their inline formatting. Sources are rechecked
  after generation; changed/deleted/inaccessible sources suppress the result.
  **Reference validation does not prove every model statement is correct.**
- The investigation agent uses native model tool calls: `get_system`,
  `query_metrics`, `list_alerts`, `search_runbooks`, `propose_alert_action`.
  It operates only on the system selected by the user. It reads at most 30
  metrics from the last seven days and 20 latest alerts. These limits are
  visible in the tool definitions; the result is a snapshot, not an exhaustive
  incident history or a proven root cause.
- At most six model-selected calls by default (configurable 1–12), plus one
  initial system observation and up to two final synthesis/formatting requests. Each model
  request has a configurable timeout, a 1 MiB response limit and an output
  token cap. The loop has a shared 90-second budget, including retrieval calls.
  Q&A shares one budget across embedding and generation, capped at 45 seconds
  (or `AI_TIMEOUT` when shorter). Cache processing also checks the deadline. Unknown
  tools and invalid arguments produce rejected-tool observations.
- An alert suggestion is only a draft. At most three drafts per run are saved
  after a source-referenced final report. Confirmation requires Operations,
  the same username, CSRF, an unexpired ten-minute proposal, unchanged source
  versions and an unchanged alert snapshot. MySQL locks the proposal, cited
  documents and alert. The alert transition and stored confirmation result
  commit atomically. Concurrent retries return that stored result. Other
  operators cannot use the proposal. Reports and tool observations are stored
  for audit; `/runs` exposes only the current user's recent run metadata.
- Middleware gives API responses an `X-Request-ID`, records method/path/status/
  duration without request bodies or query strings, and sets `private, no-store`
  on assistant/knowledge responses including errors. Login is limited per
  direct client address (10/minute); inference is limited per authenticated
  username across Q&A and investigation (20/minute). Redis Lua increments and
  expiry form one atomic operation. Fixed windows permit a burst across a
  minute boundary. Forwarded address headers are deliberately ignored; configure
  trusted proxy handling explicitly before an internet deployment.

## Running with Compose

Requires Docker, Java 21 for local development, and enough memory for the chosen
models. The existing UI Compose stack provides MySQL, SMTP and the application.
The extension adds private-network Redis and Ollama. The Compose configuration
has no GPU reservation; configure Ollama GPU access for your host if required.

1. Set the existing `UI_DB_PASSWORD`, `UI_OPERATIONS_PASSWORD`,
   `UI_MANAGEMENT_PASSWORD` and a new `REDIS_PASSWORD` in the ignored `.env`.
   See `.env.example` and `.env.advance.example`. Never commit credentials.
2. Start the stack:

   ```sh
   docker compose -f docker-compose.ui.yml -f docker-compose.advance.yml up -d --build
   ```

3. Download the selected models into Ollama's named volume:

   ```sh
   docker compose -f docker-compose.ui.yml -f docker-compose.advance.yml exec ollama ollama pull qwen3.5:9b-q4_K_M
   docker compose -f docker-compose.ui.yml -f docker-compose.advance.yml exec ollama ollama pull qwen3-embedding:0.6b
   ```

4. Set `AI_ENABLED=true`, then recreate the backend with the same Compose files.
   Open the UI at `http://127.0.0.1:5619/#assistant`, sign in with the configured
   demo account, add a runbook and investigate a system. Synthetic incident
   examples should be labelled as examples. Model calls can take tens of seconds.

For a native backend use `REDIS_ENABLED=true`, `REDIS_HOST`, `REDIS_PORT`, optional
`REDIS_PASSWORD`, `AI_ENABLED=true`, `AI_BASE_URL`, `AI_MODEL` and
`AI_EMBEDDING_MODEL`. The base URL is server configuration, never tool input.
Use a distinct `REDIS_NAMESPACE` for independent installations. Models may be
changed without altering application code; select a chat model that supports
Ollama tool calling. Only the configured endpoint receives the selected context.

Keep running native services on a copied, immutable release JAR outside Maven's
build directory. Rebuilding a JAR in place while a JVM uses it can break lazy
class loading. Frontend and backend must use matching versions. In the local
verification environment, `5176` connects to the AI backend on `8086`; the
separate `5173`/`8080` preview is the original course version.

The assistant shows elapsed waiting time and a **Cancel request** button. Q&A
stops waiting after 55 seconds and investigation after 110 seconds, including
CSRF and transport time. The question remains editable after timeout or cancel.
Cancellation closes the browser request; any server-side read/proposal analysis
already running may finish. Alert mutation still requires separate confirmation.

## Failure behavior

| Condition | Result |
| --- | --- |
| AI disabled (default) | BM25 excerpts and read-only system observations; no generated answer or proposals |
| Embedding model unavailable | BM25 fallback, explicitly labelled in `retrievalMode` |
| Chat model unavailable | `model_unavailable`, original evidence only |
| Shared model deadline reached | `model_timeout`, original evidence only; no further generation |
| No matching sources | `insufficient_evidence`; no invented answer |
| Invalid references | `unverified_answer`; generated text suppressed |
| Source changed while generating | `sources_changed`; original source text suppressed |
| Tool budget exhausted | Collected observations and a final synthesis attempt; no automatic alert mutation |
| Redis cache failure | Retrieval continues without the cache |
| Redis enabled but limiter unavailable/full | 503 and `Retry-After`; inference/login cannot bypass the distributed limit |
| Redis disabled | Bounded, process-local development rate limiter; no claim of distributed limiting |
| Limit reached | 429 and `Retry-After`; UI prevents immediate repeated inference |
| Proposal expired or evidence/alert changed | 409; run a new investigation |

`GET /api/assistant/status` reports **configuration**, not dependency readiness.
Run history, proposals and expired records currently have no automatic retention
job. Set an operational retention policy before sustained production use.

## API

All endpoints require a session and an Operations/Management role. Mutations
also require the existing CSRF token obtained from `/api/auth/csrf`.

| Method / path | Body / behavior |
| --- | --- |
| `GET /api/knowledge/documents` | Up to 200 visible document summaries |
| `GET /api/knowledge/documents/{id}` | Current visible document and full content |
| `POST /api/knowledge/documents` | Operations: `{title, content, systemId?, operationsOnly}` |
| `PUT /api/knowledge/documents/{id}` | Operations: above fields plus required `version` |
| `DELETE /api/knowledge/documents/{id}?version=0` | Operations: current version required |
| `GET /api/assistant/status` | Model/embedding/Redis configuration and tool budget |
| `POST /api/assistant/ask` | `{question, systemId?}`; answer status, retrieval mode and citations |
| `POST /api/assistant/diagnose` | `{question, systemId}`; report, trace, citations and pending proposals |
| `POST /api/assistant/chat` | `{question, context: {page, systemId?, alertId?, status?}, mode?: "CHAT" or "INVESTIGATE", history?: [{role, content}]}`; cited answer, server observations and optional Agent proposals |
| `POST /api/assistant/proposals/{id}/confirm` | Operations: empty body; explicit alert change, idempotent per proposal |
| `GET /api/assistant/runs` | Current user's last 20 investigation metadata records |

## Reproduce verification

On Windows with `JAVA_HOME` pointing to Java 21:

```powershell
./scripts/verify-advance.ps1
./scripts/verify-advance.ps1 -TestRedis -RedisPort 6386
```

The second command requires a real loopback Redis server already listening on
the chosen port. Test keys use a random namespace and are deleted individually;
the test never flushes a shared Redis database. Builds use a separate directory
so an existing running application can keep its own JAR open.

For the live model/database workflow, configure the `ADVANCE_*` environment
variables described in `docs/advance-verification.md` and run
`python scripts/smoke-advance.py` against a disposable local database. The test
creates a labelled synthetic system, runbook and alert, and checks concurrent
confirmation without logging credentials.

The CI workflow includes `advance`, runs the existing Docker/MySQL verification,
and provides Redis for the runtime counter/cache test. A configured workflow is
not proof that a remote run passed. Local verification evidence is recorded in
`docs/advance-verification.md`.

Protocol references: [Spring Data Redis scripting](https://docs.spring.io/spring-data/redis/reference/redis/scripting.html),
[Ollama chat/tools](https://docs.ollama.com/api/chat),
[Ollama embeddings](https://docs.ollama.com/api/embed).
