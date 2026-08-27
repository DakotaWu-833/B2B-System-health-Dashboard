import { useEffect, useState } from "react";
import SystemDetails from "./SystemDetails";



function Dashboard() {
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

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const [summaryResponse, systemsResponse] = await Promise.all([
          fetch("/api/dashboard/summary", {
            credentials: "include",
          }),
          fetch("/api/systems", {
            credentials: "include",
          }),
        ]);

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
      } catch (requestError) {
        console.error("Failed to load dashboard:", requestError);
        setError("Unable to load dashboard data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);


  return (
    <section>
      <h1>System Health Dashboard</h1>
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

          <div>
            <div>
              <h3>Total Systems</h3>
              <p>{summary.total}</p>
            </div>

            <div>
              <h3>Healthy</h3>
              <p>{summary.healthy}</p>
            </div>

            <div>
              <h3>Warning</h3>
              <p>{summary.warning}</p>
            </div>

            <div>
              <h3>Critical</h3>
              <p>{summary.critical}</p>
            </div>
            <div>
              <h3>Offline</h3>
              <p>{summary.offline}</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Systems</h2>

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
        </section>

        <SystemDetails system={selectedSystem} />
        </>
      )}
    </section>
  );
}

export default Dashboard;