import { useCallback, useEffect, useState } from "react";
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

function AlertCenter({ currentUser, onSessionExpired }) {
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [alertPage, setAlertPage] = useState(emptyPage);
  const [isLoading, setIsLoading] = useState(true);
  const [actionAlertId, setActionAlertId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const canManageAlerts = currentUser?.role === "OPERATIONS";

  const loadAlerts = useCallback(
    async (requestedPage = 0, signal) => {
      setIsLoading(true);
      setError("");

      const query = new URLSearchParams({
        page: String(requestedPage),
        size: String(PAGE_SIZE),
      });

      if (statusFilter !== "ALL") {
        query.set("status", statusFilter);
      }

      try {
        const response = await apiFetch(`/api/alerts?${query}`, { signal });

        if (response.status === 401) {
          onSessionExpired?.();
          return;
        }

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load alerts.");
        }

        setAlertPage(result.data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          console.error("Failed to load alerts:", requestError);
          setError("Unable to load alerts. Please try again.");
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [onSessionExpired, statusFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    setFeedback("");
    loadAlerts(0, controller.signal);
    return () => controller.abort();
  }, [loadAlerts]);

  async function updateAlert(alert, action) {
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
    } catch (requestError) {
      console.error(`Failed to ${action} alert:`, requestError);
      setError(requestError.message || `Unable to ${action} alert.`);
    } finally {
      setActionAlertId(null);
    }
  }

  return (
    <section className="alert-center" aria-labelledby="alert-center-title">
      <div className="section-header">
        <div>
          <p className="card-label">Sprint 2 feature</p>
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
            disabled={isLoading}
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
                  const actionInProgress = actionAlertId === alert.alertId;
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
