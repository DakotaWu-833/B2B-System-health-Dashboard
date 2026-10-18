import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import { MetricTrend } from "./Charts";
import { formatMetric, formatTime } from "./metricDisplay";
import MetricForm from "./MetricForm";

function SystemDetails({ system, currentUser, onSessionExpired, onMetricSubmitted }) {
  const [details, setDetails] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [metricFeedback, setMetricFeedback] = useState(null);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const historyController = useRef(null);

  const requestHistory = useCallback(async (systemId, query, { append = false, initial = false } = {}) => {
    // Initial history, range changes and pagination share one cancellation boundary.
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    if (!initial) setHistoryBusy(true);
    setHistoryError("");
    try {
      const response = await apiFetch(`/api/systems/${systemId}/metrics/history?${query}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status === 401) { onSessionExpired?.(); return; }
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to load system metrics.");
      const readings = Array.isArray(result.data) ? result.data : result.data.items;
      setMetrics(previous => append ? [...previous, ...readings] : readings);
      setHistoryCursor(result.data.nextCursor || null);
    } catch (failure) {
      if (controller.signal.aborted) return;
      const message = failure.message || "Failed to load system metrics.";
      if (initial) setError(message); else setHistoryError(message);
    } finally {
      if (!controller.signal.aborted) setHistoryBusy(false);
    }
  }, [onSessionExpired]);

  function loadHistory(append = false) {
    const query = new URLSearchParams({ size: "20" });
    if (append && historyCursor) query.set("cursor", historyCursor);
    else {
      if (range.from) query.set("from", new Date(range.from).toISOString());
      if (range.to) query.set("to", new Date(range.to).toISOString());
    }
    return requestHistory(system.id, query, { append });
  }

  async function handleMetricSubmitted(reading) {
    setMetricFeedback({ systemId: system.id, message: `Metric reading ${reading.metricId} submitted successfully.` });
    setReloadVersion((version) => version + 1);
    await onMetricSubmitted?.();
  }

  useEffect(() => {
    if (!system) {
      setDetails(null);
      setMetrics([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    setHistoryCursor(null);
    setHistoryBusy(false);
    setHistoryError("");
    setRange({ from: "", to: "" });

    setDetails(null);
    setMetrics([]);
    setError("");

    apiFetch(`/api/systems/${system.id}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return null;
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
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Failed to load system details:", error);
          setDetails(null);
          setError("Failed to load system details.");
        }
      });

    requestHistory(system.id, new URLSearchParams({ size: "20" }), { initial: true });
    return () => {
      controller.abort();
      historyController.current?.abort();
    };
  }, [system, onSessionExpired, reloadVersion, requestHistory]);

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
        <button type="button" onClick={() => setReloadVersion((version) => version + 1)}>Retry system details</button>
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
      {metricFeedback?.systemId === system.id && <p className="success-message" role="status">{metricFeedback.message}</p>}

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
          <p><strong>Last measured</strong><span>{formatTime(details.latestMetric?.timestamp)}</span></p>
        </div>
        {details.metricDataStatus === "NO_DATA" && <p className="permission-note">No measurements are available. The stored health status does not confirm measured health.</p>}
        {details.metricDataStatus === "STALE" && <p className="permission-note">Latest measurements are stale and may not reflect current health.</p>}
      </div>

      {currentUser?.role === "OPERATIONS" && <MetricForm key={system.id} system={system}
        onSubmitted={handleMetricSubmitted} onSessionExpired={onSessionExpired} />}

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
      <section className="threshold-panel" aria-labelledby="threshold-title">
        <h3 id="threshold-title">Current health thresholds</h3>
        <p className="section-copy">Current configured thresholds; a reading at or above a threshold triggers that level. Critical takes precedence over warning. Stored health is not recalculated when configuration changes.</p>
        {details.evaluatedThresholds ? <div className="table-wrapper"><table>
          <thead><tr><th>Metric</th><th>Warning at or above</th><th>Critical at or above</th></tr></thead>
          <tbody>{[
            ["CPU", "cpuWarning", "cpuCritical", "%"],
            ["Memory", "memoryWarning", "memoryCritical", "%"],
            ["Response time", "responseTimeWarning", "responseTimeCritical", " ms"],
          ].map(([label, warning, critical, unit]) => <tr key={label}>
            <th scope="row">{label}</th><td>{formatMetric(details.evaluatedThresholds[warning], unit)}</td>
            <td>{formatMetric(details.evaluatedThresholds[critical], unit)}</td>
          </tr>)}</tbody>
        </table></div> : <p>Threshold configuration is unavailable.</p>}
      </section>
      <form className="history-controls" onSubmit={event => { event.preventDefault(); loadHistory(); }}>
        <label>History from<input type="datetime-local" value={range.from} disabled={historyBusy}
          onChange={event => setRange({ ...range, from: event.target.value })} /></label>
        <label>History to<input type="datetime-local" value={range.to} disabled={historyBusy}
          onChange={event => setRange({ ...range, to: event.target.value })} /></label>
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
      {historyCursor && <button type="button" className="button-secondary" disabled={historyBusy}
        onClick={() => loadHistory(true)}>{historyBusy ? "Loading history…" : "Load older readings"}</button>}

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
