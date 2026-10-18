import { useEffect, useRef, useState } from "react";
import { apiFetch, apiJson } from "./api";
import { MetricTrend } from "./Charts";

function SystemDetails({ system, onSessionExpired }) {
  const [details, setDetails] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState("");
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const historyAbort = useRef(null);


  useEffect(() => {
    if (!system) {
      setDetails(null);
      setMetrics([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    historyAbort.current?.abort();
    setHistoryCursor(null); setRange({ from: "", to: "" }); setHistoryError(""); setHistoryBusy(false);

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
        if (!result || controller.signal.aborted) {
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

    apiFetch(`/api/systems/${system.id}/metrics/history?size=20`, {
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
        if (!result || controller.signal.aborted) {
          return;
        }
        if (result.success) {
          setMetrics(Array.isArray(result.data) ? result.data : result.data.items);
          setHistoryCursor(result.data.nextCursor || null);
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
      historyAbort.current?.abort();
    };
  }, [system, onSessionExpired]);

  async function loadHistory(append = false) {
    historyAbort.current?.abort();
    const controller = new AbortController(); historyAbort.current = controller;
    setHistoryBusy(true); setHistoryError("");
    try {
      const query = new URLSearchParams({ size: "20" });
      if (append && historyCursor) query.set("cursor", historyCursor);
      else {
        if (range.from) query.set("from", new Date(range.from).toISOString());
        if (range.to) query.set("to", new Date(range.to).toISOString());
      }
      const data = await apiJson(`/api/systems/${system.id}/metrics/history?${query}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setMetrics(previous => append ? [...previous, ...data.items] : data.items);
      setHistoryCursor(data.nextCursor);
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure.status === 401) onSessionExpired?.(); else setHistoryError(failure.message);
    } finally { if (!controller.signal.aborted) setHistoryBusy(false); }
  }

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
        <div className="detail-card-header">
          <div>
            <p className="section-kicker">Selected system</p>
            <h3>{details.name}</h3>
          </div>
          <span className={`system-status status-${details.status.toLowerCase()}`}>
            {details.status}
          </span>
        </div>

        <div className="detail-grid">
          <p>
            <strong>Type</strong>
            <span>{details.type}</span>
          </p>

          <p>
            <strong>Host</strong>
            <span>{details.host}</span>
          </p>

          <p>
            <strong>Metric data</strong>
            <span>{details.metricDataStatus}</span>
          </p>

          <p className="detail-description">
            <strong>Description</strong>
            <span>{details.description || "No description available."}</span>
          </p>
        </div>
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
      {details.evaluatedThresholds && <section aria-labelledby="threshold-title">
        <h3 id="threshold-title">Current health thresholds</h3>
        <p className="section-description">Current configuration; stored health status is not recalculated when these values change.</p>
        <div className="threshold-grid">{[
          ["CPU", details.evaluatedThresholds.cpuWarning, details.evaluatedThresholds.cpuCritical, "%"],
          ["Memory", details.evaluatedThresholds.memoryWarning, details.evaluatedThresholds.memoryCritical, "%"],
          ["Response time", details.evaluatedThresholds.responseTimeWarning, details.evaluatedThresholds.responseTimeCritical, " ms"],
        ].map(([name, warning, critical, unit]) => <div key={name}><strong>{name}</strong><p>Warning ≥ {warning}{unit}</p><p>Critical ≥ {critical}{unit}</p></div>)}</div>
      </section>}
      <form className="history-controls" onSubmit={event => { event.preventDefault(); loadHistory(); }}>
        <label>History from<input type="datetime-local" value={range.from} disabled={historyBusy} onChange={event => setRange({ ...range, from: event.target.value })} /></label>
        <label>History to<input type="datetime-local" value={range.to} disabled={historyBusy} onChange={event => setRange({ ...range, to: event.target.value })} /></label>
        <button disabled={historyBusy}>Apply history range</button>
      </form>
      <p className="section-description">Default range: last 7 days. Select up to 31 days. All readings show measurement times.</p>
      {historyError && <p role="alert" className="error-message">{historyError}</p>}
      <div className="metric-chart-grid">
        <MetricTrend title="Resource usage" metrics={metrics} unit="%" maximum={100}
          series={[
            { key: "cpuUsage", label: "CPU", color: "#3866cd" },
            { key: "memoryUsage", label: "Memory", color: "#138b82" },
          ]} />
        <MetricTrend title="Response time" metrics={metrics} unit="ms"
          series={[{ key: "responseTime", label: "Response time", color: "#8756b7" }]} />
      </div>
      <h3>Recent Metrics</h3>
      {historyCursor && <button type="button" className="button-secondary" disabled={historyBusy} onClick={() => loadHistory(true)}>{historyBusy ? "Loading history…" : "Load older readings"}</button>}

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
