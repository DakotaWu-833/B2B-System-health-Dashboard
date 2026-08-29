import { useEffect, useState } from "react";
import { apiFetch } from "./api";

function SystemDetails({ system, onSessionExpired }) {
  const [details, setDetails] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!system) {
      setDetails(null);
      setMetrics([]);
      setError("");
      return;
    }

    const controller = new AbortController();

    setDetails(null);
    setMetrics([]);
    setError("");

    apiFetch(`/api/systems/${system.id}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 401) {
          onSessionExpired?.();
          return null;
        }
        return response.json();
      })
      .then((result) => {
        if (!result) {
          return;
        }
        if (result.success) {
          setDetails(result.data);
        } else {
          setDetails(null);
          setError(result.message || "Failed to load system details.");
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to load system details:", error);
          setDetails(null);
          setError("Failed to load system details.");
        }
      });

    apiFetch(`/api/systems/${system.id}/metrics`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 401) {
          onSessionExpired?.();
          return null;
        }
        return response.json();
      })
      .then((result) => {
        if (!result) {
          return;
        }
        if (result.success) {
          setMetrics(result.data);
        } else {
          setMetrics([]);
          setError(result.message || "Failed to load system metrics.");
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to load system metrics:", error);
          setMetrics([]);
          setError("Failed to load system metrics.");
        }
      });
    return () => {
      controller.abort();
    };
  }, [system, onSessionExpired]);

  if (!system) {
    return null;
  }

  if (error) {
    return (
      <section className="system-details">
        <h2>System Details</h2>
        <p className="error-message" role="alert">
          {error}
        </p>
      </section>
    );
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
