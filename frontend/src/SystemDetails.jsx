import { useEffect, useState } from "react";

function SystemDetails({ system }) {
  const [details, setDetails] = useState(null);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    if (!system) {
      setDetails(null);
      setMetrics([]);
      return;
    }

    fetch(`/api/systems/${system.id}`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setDetails(result.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load system details:", error);
      });

    fetch(`/api/systems/${system.id}/metrics`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setMetrics(result.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load system metrics:", error);
      });
  }, [system]);

  if (!system) {
    return null;
  }

  if (!details) {
    return (
      <section className="system-details">
        <h2>System Details</h2>
        <p>Loading system details...</p>
      </section>
    );
  }

  return (
    <section className="system-details">
      <h2>System Details</h2>

      <div className="system-details-card">
        <h3>{details.name}</h3>

        <p>
          <strong>Status:</strong> {details.status}
        </p>

        <p>
          <strong>Type:</strong> {details.type}
        </p>

        <p>
          <strong>Host:</strong> {details.host}
        </p>

        <p>
          <strong>Description:</strong>{" "}
          {details.description || "No description available."}
        </p>

        <p>
          <strong>Metric Data Status:</strong> {details.metricDataStatus}
        </p>
      </div>

      <div className="status-reasons">
        <strong>Reasons:</strong>

        {details.statusReasons?.length > 0 ? (
          <ul>
            {details.statusReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>No threshold issue detected.</p>
        )}
      </div>
      <h3>Recent Metrics</h3>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Response Time</th>
              <th>Available</th>
            </tr>
          </thead>

          <tbody>
            {metrics.length > 0 ? (
              metrics.map((metric) => (
                <tr key={metric.metricId}>
                  <td>{new Date(metric.timestamp).toLocaleString()}</td>
                  <td>{metric.cpuUsage}%</td>
                  <td>{metric.memoryUsage}%</td>
                  <td>{metric.responseTime} ms</td>
                  <td>{metric.availability ? "Yes" : "No"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">No recent metrics available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SystemDetails;