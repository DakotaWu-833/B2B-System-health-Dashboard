import { useCallback, useEffect, useRef, useState } from "react";
import AlertCenter from "./AlertCenter";
import { HealthDistribution } from "./Charts";
import SystemDetails from "./SystemDetails";
import { apiFetch } from "./api";
import SystemForm from "./SystemForm";
import { formatMetric, formatTime } from "./metricDisplay";

function Dashboard({ currentUser, onSessionExpired }) {
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [systems, setSystems] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    offline: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const summaryRequest = useRef(0);
  const [alertRefreshVersion, setAlertRefreshVersion] = useState(0);
  const canManageSystems = currentUser?.role === "OPERATIONS";

  async function handleSystemSaved(savedSystem) {
    setForm(null);
    setFeedback(`${savedSystem.name} ${form.system ? "updated" : "created"} successfully.`);
    await loadDashboard();
  }

  const loadDashboard = useCallback(async ({ background = false } = {}) => {
    const requestId = ++summaryRequest.current;
    if (!background) setIsLoading(true);
    setError("");

    try {
      const [summaryResponse, systemsResponse] = await Promise.all([
        apiFetch("/api/dashboard/summary"),
        apiFetch("/api/systems"),
      ]);

      if (summaryResponse.status === 401 || systemsResponse.status === 401) {
        onSessionExpired?.();
        return;
      }

      if (!summaryResponse.ok || !systemsResponse.ok) {
        throw new Error("Failed to load dashboard data.");
      }

      const summaryResult = await summaryResponse.json();
      const systemsResult = await systemsResponse.json();

      if (!summaryResult.success || !systemsResult.success) {
        throw new Error("Backend returned an unsuccessful response.");
      }

      if (requestId === summaryRequest.current) {
        setSummary(summaryResult.data);
        setSummaryError("");
      }
      setSystems(systemsResult.data);
      if (!background) setSelectedSystem((currentSystem) => {
        if (!currentSystem) {
          return null;
        }
        return systemsResult.data.find(
          (system) => system.id === currentSystem.id
        ) ?? null;
      });
    } catch (requestError) {
      console.error("Failed to load dashboard:", requestError);
      if (background) setSummaryError("The reading was saved, but dashboard data could not be refreshed. Refresh the dashboard to retry.");
      else setError("Unable to load dashboard data. Please try again.");
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [onSessionExpired]);

  async function handleMetricSubmitted() {
    await loadDashboard({ background: true });
    setAlertRefreshVersion((version) => version + 1);
  }

  const refreshSummary = useCallback(async () => {
    const requestId = ++summaryRequest.current;
    try {
      const response = await apiFetch("/api/dashboard/summary");
      if (response.status === 401) { onSessionExpired?.(); return; }
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Summary refresh failed");
      if (requestId === summaryRequest.current) { setSummary(result.data); setSummaryError(""); }
    } catch {
      if (requestId === summaryRequest.current) setSummaryError("The alert was saved, but overview counts could not be refreshed. Refresh the dashboard to retry.");
    }
  }, [onSessionExpired]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <section className="dashboard" id="dashboard">
      <div className="dashboard-header">
        <div>
          <p className="section-kicker">Live overview</p>
          <h2>System Health Dashboard</h2>
          <p className="section-description">
            Current status across all monitored services and servers.
          </p>
        </div>
        <button type="button" onClick={() => loadDashboard()} disabled={isLoading || Boolean(form)}>
          {isLoading ? "Refreshing dashboard…" : "Refresh dashboard"}
        </button>
      </div>
      {isLoading && <p>Loading dashboard data...</p>}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!isLoading && !error && (
        <>
          <section>
            <h2>Overview</h2>

            <div className="overview-grid">
              <div className="overview-card overview-total">
                <h3>Total Systems</h3>
                <p>{summary.total}</p>
              </div>

              <div className="overview-card overview-healthy">
                <h3>Healthy</h3>
                <p>{summary.healthy}</p>
              </div>

              <div className="overview-card overview-warning">
                <h3>Warning</h3>
                <p>{summary.warning}</p>
              </div>

              <div className="overview-card overview-critical">
                <h3>Critical</h3>
                <p>{summary.critical}</p>
              </div>

              <div className="overview-card overview-offline">
                <h3>Offline</h3>
                <p>{summary.offline}</p>
              </div>
            </div>
            <div className="overview-grid metric-kpis" aria-label="Alert and metric overview">
              {[
                ["Active alerts", summary.activeAlertCount, "", "alerts"],
                ["Average CPU", summary.averageCpuUsage, "%", "cpu"],
                ["Average memory", summary.averageMemoryUsage, "%", "memory"],
                ["Average response time", summary.averageResponseTime, " ms", "response"],
              ].map(([label, value, unit, style]) => (
                <div className={`overview-card overview-${style}`} key={label}>
                  <h3>{label}</h3><p>{formatMetric(value, unit)}</p>
                </div>
              ))}
            </div>
            <p className="section-copy summary-note">
              Averages include only fresh, available latest readings. Active alerts exclude acknowledged and resolved alerts.
              {summary.evaluatedAt && <> Evaluated: <time dateTime={summary.evaluatedAt}>{formatTime(summary.evaluatedAt)}</time>.</>}
            </p>
            {summaryError && <p className="error-message" role="alert">{summaryError}</p>}
          </section>

          <div className="dashboard-main-grid">
            <HealthDistribution summary={summary} />
            <section className="systems-panel">
              <div className="section-header">
                <h2>Systems</h2>
                {canManageSystems && <button type="button" className="button-small" disabled={Boolean(form)}
                  onClick={() => { setFeedback(""); setForm({ system: null }); }}>Add system</button>}
              </div>
              {feedback && <p className="success-message" role="status">{feedback}</p>}
              {canManageSystems && form && <SystemForm key={form.system?.id ?? "new"} system={form.system}
                onSaved={handleSystemSaved} onCancel={() => setForm(null)} onSessionExpired={onSessionExpired} />}
              <p className="section-copy summary-note">Health status and measurement freshness are separate. No data means health has not yet been measured.</p>
              {systems.length === 0 ? (
                <p className="empty-state" role="status">
                  No monitored systems are available yet.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Host</th>
                        <th>Status</th>
                        <th>CPU</th><th>Memory</th><th>Response time</th><th>Metric data</th><th>Last measured</th>
                        {canManageSystems && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {systems.map((system) => (
                        <tr
                          key={system.id}
                          className={selectedSystem?.id === system.id ? "is-selected" : ""}
                          onClick={() => setSelectedSystem(system)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedSystem(system);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td>{system.name}</td>
                          <td>{system.type}</td>
                          <td>{system.host}</td>
                          <td>
                            <span className={`system-status status-${system.status.toLowerCase()}`}>
                              {system.status}
                            </span>
                          </td>
                          <td>{formatMetric(system.latestMetric?.cpuUsage, "%")}</td>
                          <td>{formatMetric(system.latestMetric?.memoryUsage, "%")}</td>
                          <td>{formatMetric(system.latestMetric?.responseTime, " ms")}</td>
                          <td><span className="data-badge">{system.metricDataStatus ?? "NO_DATA"}</span>
                            {system.latestMetric?.availability === false && <span className="cell-detail">Unavailable</span>}</td>
                          <td>{formatTime(system.lastUpdated)}</td>
                          {canManageSystems && <td><button type="button" className="button-secondary button-small"
                            aria-label={`Edit ${system.name}`} disabled={Boolean(form)} onClick={(event) => {
                              event.stopPropagation(); setFeedback(""); setForm({ system });
                            }}>Edit</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <SystemDetails
            system={selectedSystem}
            currentUser={currentUser}
            onMetricSubmitted={handleMetricSubmitted}
            onSessionExpired={onSessionExpired}
          />

          {currentUser && (
            <AlertCenter
              currentUser={currentUser}
              onSessionExpired={onSessionExpired}
              onAlertsChanged={refreshSummary}
              systems={systems}
              refreshVersion={alertRefreshVersion}
            />
          )}
        </>
      )}
    </section>
  );
}

export default Dashboard;
