# Sprint 3 demonstration sequence

Use the [isolated local setup](local-verification.md) and locally supplied passwords. Run the [verification entrypoint](verification.md) before the demo. Integration is develop-3; this script does not authorize a main merge.

1. Sign in as Operations. Show summary counts, active alerts and metric KPIs. Explain real zero, missing averages, latest measurement time and FRESH/STALE/NO_DATA separately.
2. Add a uniquely named service, inspect its NO_DATA state, edit the description and reload. Try the same name/type/host again: the conflict should keep the form input. Cancel it.
3. Select a system. As Operations, submit a manual metric reading and show the resulting health, summary and alert refresh without losing the selected alert filters. Show history/charts and the server's configured thresholds. Use a time range and load older readings when available. Empty history should be clear and recover after restoring the range; a delayed older request must not replace the latest selection. Use system-table pagination and load additional alert-filter systems when the required system is outside the visible page.
4. Use at least six ACTIVE alerts with the five-item page size. Move to the last page, resolve its only alert and show the automatic return to page one. Check the active-alert KPI updates. Acknowledge an ACTIVE alert, filter Acknowledged and resolve it. An unresolved issue may produce another alert on a later reading; status actions do not stop monitoring.
5. Open My profile. Save a local test email, send a code, show actual Mailpit receipt and enter the code. Show Verified, then sign out/in to prove persistence. Changing the address resets verification. Do not expose codes/passwords in shared recordings.
6. Sign in as Management. Show reading access to systems, metrics and alerts, with management controls absent. Show own-profile editing and verification. Optional direct mutation should return 403 with a valid CSRF token; own profile without CSRF must also return 403.
7. Sign out and confirm login reappears. Keep historical Sprint evidence distinct from the current working-tree results. Link the actual review/PR when the team creates it; do not invent URLs or claim Jira completion from this document alone.

The optional demo feeder refreshes the three known demo systems every 30 seconds so long presentations do not make all data stale. Disable it outside synthetic demonstrations. Only local SMTP delivery has been accepted here; external inbox delivery requires actual provider configuration and a separate check.
