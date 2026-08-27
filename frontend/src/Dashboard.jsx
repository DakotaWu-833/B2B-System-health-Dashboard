import { useEffect, useState } from "react";
import SystemDetails from "./SystemDetails";

const mockSystems = [
  {
    id: 1,
    name: "Payment API",
    status: "HEALTHY",
    keyMetric: "CPU 42%",
    lastUpdated: "2026-08-27 13:05",
  },
  {
   id: 2,
   name: "Order Service",
   status: "WARNING",
   keyMetric: "CPU 83%",
   lastUpdated: "2026-08-27 13:04",
   reason: "CPU usage 83% exceeds warning threshold 80%",
   metrics: [
     { time: "13:00", name: "CPU", value: "72%" },
     { time: "13:01", name: "CPU", value: "75%" },
     { time: "13:02", name: "CPU", value: "79%" },
     { time: "13:03", name: "CPU", value: "81%" },
     { time: "13:04", name: "CPU", value: "83%" },
    ],
  },
  {
    id: 3,
    name: "Database Server",
    status: "CRITICAL",
    keyMetric: "Memory 96%",
    lastUpdated: "2026-08-27 13:03",
    reason: "Memory usage 96% exceeds critical threshold 90%",
    metrics: [
      { time: "12:59", name: "Memory", value: "82%" },
      { time: "13:00", name: "Memory", value: "85%" },
      { time: "13:01", name: "Memory", value: "89%" },
      { time: "13:02", name: "Memory", value: "93%" },
      { time: "13:03", name: "Memory", value: "96%" }
    ]
  },
];

function Dashboard() {
  const [selectedSystem, setSelectedSystem] = useState(null);
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
              <th>Status</th>
              <th>Key Metric</th>
              <th>Last Updated</th>
            </tr>
          </thead>

          <tbody>
            {mockSystems.map((system) => (
              <tr
                key={system.id}
                onClick={() => setSelectedSystem(system)}
                style={{ cursor: "pointer" }}
              >
                <td>{system.name}</td>
                <td>{system.status}</td>
                <td>{system.keyMetric}</td>
                <td>{system.lastUpdated}</td>
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