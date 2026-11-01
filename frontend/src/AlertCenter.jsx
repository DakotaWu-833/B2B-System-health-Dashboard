import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { collectionPage, nameIncludes, orderAlerts, readCollection } from "./collectionQuery";
import HeaderTools from "./HeaderTools";
import { useAssistant } from "./AssistantContext";

const PAGE_SIZE = 5;
const STATUS_OPTIONS = ["ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"];

function formatLabel(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function emptyPage() {
  return {
    items: [],
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  };
}

function AlertCenter({ currentUser, onSessionExpired, onAlertsChanged, systems = [], refreshVersion = 0,
  onLoadMoreSystems, hasMoreSystems = false, systemsLoading = false, systemsError = "", onResolveRequested, pendingResolution }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [systemFilter, setSystemFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState({ field: null, direction: null, custom: false });
  const collection = useRef(null);
  const lastRefreshVersion = useRef(refreshVersion);
  const [alertPage, setAlertPage] = useState(emptyPage);
  const [isLoading, setIsLoading] = useState(true);
  const [actionAlertId, setActionAlertId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const latestRequest = useRef(0);
  const requestController = useRef(null);
  const updateInProgress = useRef(false);

  const canManageAlerts = currentUser?.role === "OPERATIONS";
  const assistant = useAssistant();
  const setAssistantScope = assistant?.setScope;
  const selectedSystemName = systems.find(system => String(system.id) === systemFilter)?.name;
  useEffect(() => { setAssistantScope?.({ systemId: systemFilter ? Number(systemFilter) : null, systemName: selectedSystemName, status: statusFilter }); }, [setAssistantScope, systemFilter, selectedSystemName, statusFilter]);

  const loadAlerts = useCallback(
    async (requestedPage = 0) => {
      const requestId = ++latestRequest.current;
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const isCurrent = () => requestId === latestRequest.current && !controller.signal.aborted;
      setIsLoading(true);
      setError("");

      try {
        if (keyword || sort.custom) {
          const key = JSON.stringify([statusFilter, systemFilter]);
          const parameters = {};
          if (statusFilter !== "ALL") parameters.status = statusFilter;
          if (systemFilter) parameters.systemId = systemFilter;
          const items = collection.current?.key === key ? collection.current.items : await readCollection("/api/alerts", { signal: controller.signal, parameters, idKey: "alertId" });
          if (!isCurrent()) return;
          collection.current = { key, items };
          const matches = items.filter(alert => nameIncludes(alert.systemName, keyword));
          setAlertPage(collectionPage(sort.custom ? orderAlerts(matches, sort.field, sort.direction) : matches, requestedPage, PAGE_SIZE));
          return;
        }
        let pageToLoad = Math.max(0, requestedPage);
        while (isCurrent()) {
          const query = new URLSearchParams({ page: String(pageToLoad), size: String(PAGE_SIZE) });
          if (statusFilter !== "ALL") query.set("status", statusFilter);
          if (systemFilter) query.set("systemId", systemFilter);
          const response = await apiFetch(`/api/alerts?${query}`, { signal: controller.signal });
          if (!isCurrent()) return;
          if (response.status === 401) {
            onSessionExpired?.();
            return;
          }
          const result = await response.json();
          if (!isCurrent()) return;
          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load alerts.");
          }
          const lastPage = Math.max(0, result.data.totalPages - 1);
          if (pageToLoad > lastPage) {
            pageToLoad = lastPage;
            continue;
          }
          setAlertPage(result.data);
          return;
        }
      } catch (requestError) {
        if (isCurrent() && requestError.name !== "AbortError") {
          console.error("Failed to load alerts:", requestError);
          setError("Unable to load alerts. Please try again.");
        }
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
        }
      }
    },
    [onSessionExpired, statusFilter, systemFilter, keyword, sort]
  );

  useEffect(() => {
    if (lastRefreshVersion.current !== refreshVersion) {
      collection.current = null;
      lastRefreshVersion.current = refreshVersion;
    }
    loadAlerts(0);
    return () => {
      latestRequest.current += 1;
      requestController.current?.abort();
    };
  }, [loadAlerts, refreshVersion]);

  useEffect(() => { setFeedback(""); }, [statusFilter, systemFilter, keyword]);

  function toggleSort(field) {
    setSort(current => current.field === field && current.direction === "desc"
      ? { field: null, direction: null, custom: false }
      : { field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc", custom: true });
  }

  async function updateAlert(alert, action) {
    if (updateInProgress.current) return;
    updateInProgress.current = true;
    setActionAlertId(alert.alertId);
    setError("");
    setFeedback("");

    try {
      const csrfResponse = await apiFetch("/api/auth/csrf");
      if (csrfResponse.status === 401) {
        onSessionExpired?.();
        return;
      }

      const csrfResult = await csrfResponse.json();
      if (!csrfResponse.ok || !csrfResult.success) {
        throw new Error(csrfResult.message || "Failed to obtain a CSRF token.");
      }

      const response = await apiFetch(
        `/api/alerts/${alert.alertId}/${action}`,
        {
          method: "PATCH",
          headers: {
            [csrfResult.data.headerName || "X-CSRF-TOKEN"]:
              csrfResult.data.token,
          },
        }
      );

      if (response.status === 401) {
        onSessionExpired?.();
        return;
      }

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || `Failed to ${action} alert.`);
      }

      setFeedback(
        `${alert.systemName} alert ${
          action === "acknowledge" ? "acknowledged" : "resolved"
        } successfully.`
      );
      collection.current = null;
      await loadAlerts(alertPage.page);
      await onAlertsChanged?.();
    } catch (requestError) {
      console.error(`Failed to ${action} alert:`, requestError);
      setError(requestError.message || `Unable to ${action} alert.`);
    } finally {
      updateInProgress.current = false;
      setActionAlertId(null);
    }
  }

  return (
    <section className="alert-center" aria-labelledby="alert-center-title">
      <div className="section-header">
        <div>
          <h2 id="alert-center-title">Alert Center</h2>
          <p className="section-copy">
            Review operational incidents and move them through a controlled
            response workflow.
          </p>
        </div>

        <div className="alert-controls">
          <label htmlFor="alert-system">System</label>
          <select id="alert-system" value={systemFilter} disabled={actionAlertId !== null}
            onChange={(event) => setSystemFilter(event.target.value)}>
            <option value="">All systems</option>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select>
          {hasMoreSystems && <button type="button" className="button-secondary button-small"
            disabled={systemsLoading || actionAlertId !== null} onClick={onLoadMoreSystems}>
            {systemsLoading ? "Loading systems…" : "Load more filter systems"}
          </button>}
          <label htmlFor="alert-status">Status</label>
          <select
            id="alert-status"
            value={statusFilter}
            disabled={actionAlertId !== null}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
          <button
            className="button-secondary"
            type="button"
            onClick={() => { collection.current = null; loadAlerts(alertPage.page); }}
            disabled={isLoading || actionAlertId !== null}
          >
            {isLoading ? "Refreshing…" : "Refresh alerts"}
          </button>
        </div>
      </div>

      <HeaderTools><form className="collection-search" role="search" aria-label="Alert search" onSubmit={event => { event.preventDefault(); const next = searchInput.trim(); if (next === keyword) loadAlerts(0); else setKeyword(next); }}>
        <label htmlFor="alert-name-search">Search alerts by system name</label>
        <div><input id="alert-name-search" type="search" placeholder="Enter part of a system name" value={searchInput} disabled={actionAlertId !== null} onChange={event => setSearchInput(event.target.value)} />
          <button type="submit" className="button-secondary" disabled={actionAlertId !== null}>Search alerts</button>
          {(keyword || searchInput) && <button type="button" className="button-secondary" disabled={actionAlertId !== null} onClick={() => { setSearchInput(""); setKeyword(""); }}>Clear search</button>}</div>
        {keyword && <p className="section-copy">Showing names containing “{keyword}” across all alerts matching the selected filters.</p>}
      </form></HeaderTools>

      {!canManageAlerts && (
        <p className="permission-note">
          Management access is read-only. Operations users can acknowledge and
          resolve alerts.
        </p>
      )}
      {systemsError && <p className="error-message" role="alert">{systemsError}</p>}

      {feedback && (
        <p className="success-message" role="status" aria-live="polite">
          {feedback}
        </p>
      )}

      {error && (
        <p className="error-message alert-message" role="alert">
          {error}
        </p>
      )}

      {isLoading && <p aria-live="polite">Loading alerts...</p>}

      {!isLoading && !error && alertPage.items.length === 0 && (
        <p className="empty-state" role="status">
          {keyword ? `No alerts match “${keyword}” with the selected filters.` : `No ${statusFilter === "ALL" ? "" : formatLabel(statusFilter).toLowerCase() + " "}alerts are available.`}
        </p>
      )}

      {!isLoading && !error && alertPage.items.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <caption className="visually-hidden">
                {formatLabel(statusFilter)} system alerts
              </caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={sort.field === "systemName" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
                    <button type="button" className="sort-column" disabled={actionAlertId !== null} onClick={() => toggleSort("systemName")} title={sort.field === "systemName" && sort.direction === "desc" ? "Clear system name sorting" : "Sort by system name"}>System <span aria-hidden="true">{sort.field === "systemName" ? sort.direction === "asc" ? "↑" : "↓" : ""}</span></button>
                  </th>
                  <th scope="col">Alert</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col" aria-sort={sort.field === "createdTime" ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
                    <button type="button" className="sort-column" disabled={actionAlertId !== null} onClick={() => toggleSort("createdTime")} title={sort.field === "createdTime" && sort.direction === "desc" ? "Clear alert time sorting" : "Sort by alert creation time"}>Alert time <span aria-hidden="true">{sort.field === "createdTime" ? sort.direction === "asc" ? "↑" : "↓" : ""}</span></button>
                  </th>
                  {canManageAlerts && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {alertPage.items.map((alert) => {
                  const actionInProgress = actionAlertId !== null || Boolean(pendingResolution);
                  return (
                    <tr key={alert.alertId}>
                      <td>{alert.systemName}</td>
                      <td>
                        <strong>{formatLabel(alert.alertType)}</strong>
                        <span className="cell-detail">{alert.message}</span>
                        {assistant && <button type="button" className="ask-ai-inline" aria-label={`Ask AI about ${alert.systemName} alert ${alert.alertId}`} onClick={() => assistant.ask({ systemId: alert.systemId, systemName: alert.systemName, alertId: alert.alertId, status: statusFilter }, "Explain this alert and suggest what to check next.")}>Ask AI <span aria-hidden="true">↗</span></button>}
                      </td>
                      <td>
                        <span
                          className={`data-badge severity-${alert.severity.toLowerCase()}`}
                        >
                          {formatLabel(alert.severity)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`data-badge alert-status-${alert.status.toLowerCase()}`}
                        >
                          {formatLabel(alert.status)}
                        </span>
                        {pendingResolution?.alert.alertId === alert.alertId && <span className="cell-detail">{pendingResolution.sending ? "Saving resolution…" : "Resolution scheduled · Undo available"}</span>}
                      </td>
                      <td>{new Date(alert.createdTime).toLocaleString()}</td>
                      {canManageAlerts && (
                        <td>
                          <div className="row-actions">
                            {alert.status === "ACTIVE" && (
                              <button
                                className="button-secondary button-small"
                                type="button"
                                onClick={() => updateAlert(alert, "acknowledge")}
                                disabled={actionInProgress}
                              >
                                Acknowledge
                              </button>
                            )}
                            {alert.status !== "RESOLVED" && (
                              <button
                                className="button-small"
                                type="button"
                                onClick={() => onResolveRequested ? onResolveRequested(alert) : updateAlert(alert, "resolve")}
                                disabled={actionInProgress}
                              >
                                Resolve
                              </button>
                            )}
                            {alert.status === "RESOLVED" && (
                              <span className="cell-detail">No action required</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Alert pages">
            <button
              className="button-secondary"
              type="button"
              onClick={() => loadAlerts(alertPage.page - 1)}
              disabled={alertPage.first || isLoading}
            >
              Previous
            </button>
            <span>
              Page {alertPage.page + 1} of {alertPage.totalPages} ·{" "}
              {alertPage.totalElements} alerts
            </span>
            <button
              className="button-secondary"
              type="button"
              onClick={() => loadAlerts(alertPage.page + 1)}
              disabled={alertPage.last || isLoading}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

export default AlertCenter;
