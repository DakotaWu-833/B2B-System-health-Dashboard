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

  useEffect(() => {
    fetch("http://localhost:8080/api/dashboard/summary", {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setSummary(result.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load dashboard summary:", error);
      });

    fetch("http://localhost:8080/api/systems", {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setSystems(result.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load systems:", error);
      });
  }, []);


  return (
    <section>
      <h1>System Health Dashboard</h1>

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
    </section>
  );
}

export default Dashboard;