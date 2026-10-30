# Frontend local backend connection

For the complete backend-to-frontend feature audit and Chinese explanation of
each page, data field, operation and database relationship, see
[项目功能、接口与前端数据说明](PROJECT_GUIDE.zh-CN.md).

The frontend sends all API requests through `src/api.js`, including the session
cookie. Login and mutations obtain a CSRF token from the same backend.

For the local MySQL 8.4 demonstration, the backend runs on **8081**. Create
`frontend/.env.local` from `.env.example`:

```dotenv
VITE_API_BASE_URL=
BACKEND_PROXY_TARGET=http://127.0.0.1:8081
```

Restart `pnpm dev` after editing these values. Development and `pnpm preview`
both load the proxy target from the frontend's environment files. An explicit
process `BACKEND_PROXY_TARGET` takes precedence. Without an override, the original
backend default remains `http://localhost:8080`.

When changing backends, sign in to the selected backend again: sessions and user
accounts belong to that backend. The local demo uses `demo.operations` and
`demo.management`; their generated passwords are in the ignored local file
`tmp/backend-demo/demo-local.env` at the repository root.

`CONNECTED` confirms that the selected backend's public health endpoint is UP.
It does not prove that it contains monitored systems. If the system count is
zero, check that the proxy targets the intended backend.

Metric averages can correctly show `No data` even when systems and alerts exist.
The backend excludes unavailable readings and readings older than its freshness
window. Historical values remain visible in the system list and details with
their STALE label. The frontend preserves that distinction and never supplies
synthetic KPI values.

Validation: `pnpm test` and `pnpm build`. Proxy regression tests cover local
environment files, production preview, mode overrides, explicit process settings
and the original default.

## Verified local repair (28 October 2026)

The frontend previously used port 8080 while the populated local demo backend
used port 8081. Both health endpoints returned UP, so the connection badge alone
did not identify the wrong backend. The Vite configuration also read only
`process.env.BACKEND_PROXY_TARGET`, which ignored values supplied in `.env.local`.
The repair loads the frontend environment files and configures the current local
proxy for port 8081 without changing backend or database configuration.

- 68 frontend tests passed; the production build succeeded.
- 28 authenticated read-only API calls passed through development (5173) and
  production preview (4173), covering both Operations and Management: current
  user, summary, system pagination, detail, history, alerts and profile.
- Browser checks showed 12 systems, four active alerts, the second system page,
  detail thresholds, historical charts and history pagination from 20 to 40 rows.
- Average metric KPIs correctly remain `No data`: the actual backend response
  contains null averages because its latest readings are stale. Historical
  measurements still display their real values and timestamps.

No system, metric, alert or profile mutation was sent during live verification.
Only authentication sessions and read endpoints were used. Existing backend,
database and other non-frontend source files were preserved.

## Workspace redesign (29 October 2026)

The left navigation opens separate Dashboard, System, Alert Center, My profile,
and Metric retention views. It expands on mouse hover on desktop and toggles on
tapping the current account on mobile. Clicking that account reveals Logout;
leaving the sidebar on desktop collapses it. The top-right Logout was removed.
Metric retention remains Operations-only.

The inventory requests twelve systems per page with Previous page / Next page
controls. Cards open a native modal with Basic information (including Reasons
and a compact summary of current thresholds), Recent Metrics, and Submit a
metric reading tabs, in that order. History and submission omit repeated titles.
History uses server cursors and displays at most ten readings per page, with
cached previous pages. Charts represent the current page. Management remains
read-only.

Alerts initially show All. Resolve starts a ten-second Undo window; no write is
sent before it expires. Undo preserves the original ACTIVE or ACKNOWLEDGED state,
including after navigating to another view. Once sending begins it cannot be
cancelled. Logout, refresh, or closing the page cancels queued unsent actions.
The backend has no endpoint for reopening an already persisted RESOLVED alert.

The backend connection popover closes on outside click or Escape.

Validation: 94 frontend tests and a production build. Live browser verification
covered cards, native modal/Esc, two ten-reading history pages, All alerts, and
cancelling Resolve followed by a fresh server read of the unchanged state.

## System-name search and alert sorting

Search controls sit beside the page’s main title in a sticky top header,
remaining visible as the content scrolls. System and Alert Center searches
match any part of a system name, ignoring
case and surrounding spaces. Submit with Search or Enter; Clear search restores
the list. Results retain twelve system cards or five alerts per page.

Created is now Alert time (the creation time of the alert). Both column headers cycle ascending → descending → no custom sorting.
Clearing sorting removes both arrows and restores the backend default order
(newest first); reloading the page also clears custom sorting.
Arrows appear only for an active sort. Alert search combines with Status and System
filters. Refresh reloads data from the backend.

The current backend has no name-search or custom-sort parameters. These
operations therefore read all matching backend pages in bounded batches of 100
and filter/sort before applying display pagination. Default unsearched lists
continue to use backend pagination. A failed batch shows an error rather than
partial results. No backend or database changes are required.
