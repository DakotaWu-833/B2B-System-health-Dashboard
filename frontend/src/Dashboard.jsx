import { useEffect, useState } from "react";
import { apiJson } from "./api";
import { HealthDistribution } from "./Charts";
import { formatMetric, formatTime } from "./metricDisplay";
import Icon from "./Icons";

export default function Dashboard({ onSessionExpired, refreshVersion = 0 }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    apiJson("/api/dashboard/summary", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSummary(data); })
      .catch(failure => { if (controller.signal.aborted) return; if (failure.status === 401) onSessionExpired?.(); else setError("Unable to load dashboard data. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [onSessionExpired, refreshVersion, version]);

  const attention = summary ? (summary.warning || 0) + (summary.critical || 0) + (summary.offline || 0) : 0;
  const allHealthy = summary?.total > 0 && summary.healthy === summary.total;
  return <section className="dashboard overview-page" aria-labelledby="overview-title" aria-busy={loading}>
    <div className="page-heading"><div><p className="section-kicker">YOUR WORKSPACE AT A GLANCE</p><h2 id="overview-title">Overview</h2><p className="section-description">A clear view of your systems and what needs attention.</p></div>
      <button className="button-secondary" disabled={loading} onClick={() => setVersion(value => value + 1)}><Icon name="refresh" />Refresh dashboard</button></div>
    {loading && <div className="state-message" role="status"><span className="spinner" aria-hidden="true" />Loading dashboard data...</div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {summary && !loading && !error && <>
      <div className={`overview-status${attention ? " has-attention" : ""}`}><span className="overview-status-icon" aria-hidden="true"><Icon name={attention ? "warning" : allHealthy ? "check" : "system"} /></span><div><strong>{attention ? `${attention} ${attention === 1 ? "system needs" : "systems need"} attention` : allHealthy ? "All systems are healthy" : summary.total ? "Your monitoring overview is ready" : "Ready for your first system"}</strong><p>{attention ? "Review your systems to understand their latest health status." : allHealthy ? "Check your latest readings and keep an eye on any active alerts." : "Keep your systems and their latest health readings in one place."}</p></div><a href="#system">View systems<Icon name="arrow" /></a></div>
      <div className="overview-grid">{[["Total Systems", "total", "system"], ["Healthy", "healthy", "check"], ["Warning", "warning", "warning"], ["Critical", "critical", "alerts"], ["Offline", "offline", "offline"]].map(([label, key, icon]) =>
        <article key={key} className={`overview-card overview-${key}`}><div className="overview-card-heading"><h3>{label}</h3><span className="kpi-icon"><Icon name={icon} /></span></div><p>{summary[key]}</p><span className="card-subtitle">{key === "total" ? "Systems in your workspace" : "Current health status"}</span></article>)}</div>
      <div className="overview-grid metric-kpis" aria-label="Alert and metric overview">{[["Active alerts", "activeAlertCount", "", "alerts"], ["Average CPU", "averageCpuUsage", "%", "cpu"], ["Average memory", "averageMemoryUsage", "%", "memory"], ["Average response time", "averageResponseTime", " ms", "response"]].map(([label, key, unit, style]) =>
        <article key={key} className={`overview-card overview-${style}`}><div className="overview-card-heading"><h3>{label}</h3><span className="kpi-icon"><Icon name={style} /></span></div><p>{formatMetric(summary[key], unit)}</p><span className="card-subtitle">{key === "activeAlertCount" ? "Awaiting acknowledgement" : "Recent, available latest readings"}</span></article>)}</div>
      <HealthDistribution summary={summary} />
      <div className="overview-footnote"><p>Averages use recent, available readings. “No data” means no eligible reading is available; a measured zero is displayed as zero.</p>{summary.evaluatedAt && <p>Last evaluated <time dateTime={summary.evaluatedAt}>{formatTime(summary.evaluatedAt)}</time></p>}</div>
    </>}
  </section>;
}
