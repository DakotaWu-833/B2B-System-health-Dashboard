import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";

const PAGE_SIZE = 5;
const STATUS_OPTIONS = ["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "ALL"];

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

function AlertCenter({ currentUser, onSessionExpired, onChanged }) {
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [alertPage, setAlertPage] = useState(emptyPage);
  const [isLoading, setIsLoading] = useState(true);
  const [actionAlertId, setActionAlertId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const latestRequest = useRef(0);
  const requestController = useRef(null);
  const updateInProgress = useRef(false);

  const canManageAlerts = currentUser?.role === "OPERATIONS";

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
        let pageToLoad = Math.max(0, requestedPage);
        while (isCurrent()) {
          const query = new URLSearchParams({ page: String(pageToLoad), size: String(PAGE_SIZE) });
          if (statusFilter !== "ALL") query.set("status", statusFilter);
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
    [onSessionExpired, statusFilter]
  );

  useEffect(() => {
    setFeedback("");
    loadAlerts(0);
    return () => {
      latestRequest.current += 1;
      requestController.current?.abort();
    };
  }, [loadAlerts]);

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
      await loadAlerts(alertPage.page);
      await onChanged?.();
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
          <h2 id="alert-center-title">Alert Centre</h2>
          <p className="section-copy">
            Review operational incidents and move them through a controlled
            response workflow.
          </p>
        </div>

        <div className="alert-controls">
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
            onClick={() => loadAlerts(alertPage.page)}
            disabled={isLoading || actionAlertId !== null}
          >
            {isLoading ? "Refreshing…" : "Refresh alerts"}
          </button>
        </div>
      </div>

      {!canManageAlerts && (
        <p className="permission-note">
          Management access is read-only. Operations users can acknowledge and
          resolve alerts.
        </p>
      )}

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
          No {statusFilter === "ALL" ? "" : formatLabel(statusFilter).toLowerCase() + " "}
          alerts are available.
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
                  <th scope="col">System</th>
                  <th scope="col">Alert</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  {canManageAlerts && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {alertPage.items.map((alert) => {
                  const actionInProgress = actionAlertId !== null;
                  return (
                    <tr key={alert.alertId}>
                      <td>{alert.systemName}</td>
                      <td>
                        <strong>{formatLabel(alert.alertType)}</strong>
                        <span className="cell-detail">{alert.message}</span>
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
                                onClick={() => updateAlert(alert, "resolve")}
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
