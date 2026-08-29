import { useCallback, useEffect, useState } from "react";
import SystemDetails from "./SystemDetails";
import { apiFetch } from "./api";

function Dashboard({ onSessionExpired }) {
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

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
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

      setSummary(summaryResult.data);
      setSystems(systemsResult.data);
      setSelectedSystem((currentSystem) => {
        if (!currentSystem) {
          return null;
        }
        return systemsResult.data.find(
          (system) => system.id === currentSystem.id
        ) ?? null;
      });
    } catch (requestError) {
      console.error("Failed to load dashboard:", requestError);
      setError("Unable to load dashboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h1>System Health Dashboard</h1>
        <button type="button" onClick={loadDashboard} disabled={isLoading}>
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
              <div className="overview-card">
                <h3>Total Systems</h3>
                <p>{summary.total}</p>
              </div>

              <div className="overview-card">
                <h3>Healthy</h3>
                <p>{summary.healthy}</p>
              </div>

              <div className="overview-card">
                <h3>Warning</h3>
                <p>{summary.warning}</p>
              </div>

              <div className="overview-card">
                <h3>Critical</h3>
                <p>{summary.critical}</p>
              </div>

              <div className="overview-card">
                <h3>Offline</h3>
                <p>{summary.offline}</p>
              </div>
            </div>
          </section>

          <section>
            <h2>Systems</h2>
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
                    </tr>
                  </thead>
                  <tbody>
                    {systems.map((system) => (
                      <tr
                        key={system.id}
                        onClick={() => setSelectedSystem(system)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedSystem(system);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        style={{ cursor: "pointer" }}
                      >
                        <td>{system.name}</td>
                        <td>{system.type}</td>
                        <td>{system.host}</td>
                        <td>{system.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <SystemDetails
            system={selectedSystem}
            onSessionExpired={onSessionExpired}
          />
        </>
      )}
    </section>
  );
}

export default Dashboard;
