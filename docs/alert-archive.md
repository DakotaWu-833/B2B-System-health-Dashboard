# Alert inspection and archiving

Click the body of any Alert Center card to open that system's existing detail
dialog on **Recent Metrics**. The charts, date range and history pagination are
shared with System details. Footer actions operate independently of this link.

Operations users can **Archive** a Resolved alert. The **Archived** view supports
the same system-name search, sorting and metric inspection. **Undo archive**
returns the alert to Resolved. Management users can inspect both views but do
not receive mutation controls.

Archiving is stored in MySQL, independently of the alert's lifecycle status.
Migration V7 gives existing alerts `archived = false` and enforces that only
Resolved alerts can be archived. Archived incidents never suppress newly
triggered alerts for the same system.

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/alerts` | Existing bounded, sorted pagination; excludes archived alerts by default. |
| `GET /api/alerts?archived=true` | Only archived alerts; may combine `status`, `systemId`, `page`, `size`. |
| `PATCH /api/alerts/{id}/archive` | Operations + CSRF; requires Resolved; persists `archived = true`. |
| `PATCH /api/alerts/{id}/unarchive` | Operations + CSRF; requires Resolved; persists `archived = false`. |

Both mutation endpoints lock the alert row, preserve its resolution and are
idempotent. Invalid lifecycle states return 409, unknown alerts return 404.
The `AlertResponse` includes `archived` in both list and mutation responses.

Ask AI uses the current board or Archived view, including when that view is
empty. Its conversations are separate for these views. Clearing a selected
alert restores the current view's scope. A selected alert must still belong to
the supplied view when the server loads it; a moved alert returns 400 instead
of silently mixing archived and ordinary records.
