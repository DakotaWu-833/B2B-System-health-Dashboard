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
  const noData = summary?.noData || 0;
  const staleReadings = summary?.staleReadingCount || 0;
  const allHealthy = summary?.total > 0 && summary.healthy === summary.total && summary.freshReadingCount === summary.total;
  const headline = attention ? `${attention} ${attention === 1 ? "system needs" : "systems need"} attention`
    : noData ? `${noData} ${noData === 1 ? "system has" : "systems have"} no readings`
    : staleReadings ? `${staleReadings} ${staleReadings === 1 ? "system has" : "systems have"} outdated readings`
    : allHealthy ? "All systems are healthy" : summary?.total ? "Your monitoring overview is ready" : "Ready for your first system";
  return <section className="dashboard overview-page" aria-labelledby="overview-title" aria-busy={loading}>
    <div className="page-heading"><div><p className="section-kicker">YOUR WORKSPACE AT A GLANCE</p><h2 id="overview-title">Overview</h2><p className="section-description">A clear view of your systems and what needs attention.</p></div>
      <button className="button-secondary" disabled={loading} onClick={() => setVersion(value => value + 1)}><Icon name="refresh" />Refresh dashboard</button></div>
    {loading && <div className="state-message" role="status"><span className="spinner" aria-hidden="true" />Loading dashboard data...</div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {summary && !loading && !error && <>
      <div className={`overview-status${attention ? " has-attention" : ""}`}><span className="overview-status-icon" aria-hidden="true"><Icon name={attention ? "warning" : allHealthy ? "check" : "system"} /></span><div><strong>{headline}</strong><p>{attention ? "Review the last reported status and reading freshness of your systems." : noData || staleReadings ? "Missing or outdated readings do not confirm current system health." : allHealthy ? "Check your latest readings and keep an eye on any active alerts." : "Keep your systems and their latest health readings in one place."}</p></div><a href="#system">View systems<Icon name="arrow" /></a></div>
      <div className="overview-grid overview-health-counts">{[["Total Systems", "total", "system"], ["Healthy", "healthy", "check"], ["Warning", "warning", "warning"], ["Critical", "critical", "alerts"], ["Offline", "offline", "offline"], ["No data", "noData", "system"]].map(([label, key, icon]) =>
        <article key={key} className={`overview-card overview-${key}`}><div className="overview-card-heading"><h3>{label}</h3><span className={`kpi-icon${key === "noData" ? " status-no-data" : ""}`}><Icon name={icon} /></span></div><p>{summary[key] ?? 0}</p><span className="card-subtitle">{key === "total" ? "Systems in your workspace" : key === "noData" ? "Systems without readings" : "Last reported health"}</span></article>)}</div>
      <div className="overview-grid metric-kpis" aria-label="Alert and metric overview">{[["Active alerts", "activeAlertCount", "", "alerts"], ["Average CPU", "averageCpuUsage", "%", "cpu"], ["Average memory", "averageMemoryUsage", "%", "memory"], ["Average response time", "averageResponseTime", " ms", "response"]].map(([label, key, unit, style]) =>
        <article key={key} className={`overview-card overview-${style}`}><div className="overview-card-heading"><h3>{label}</h3><span className="kpi-icon"><Icon name={style} /></span></div><p>{formatMetric(summary[key], unit)}</p><span className="card-subtitle">{key === "activeAlertCount" ? "Awaiting acknowledgement" : "Recent, available latest readings"}</span></article>)}</div>
      <HealthDistribution summary={summary} />
      <div className="overview-footnote"><div><p>The No data health count means no readings exist. Averages use recent, available readings; missing averages display No data and measured zero remains zero.</p>
        {Number.isFinite(summary.freshReadingCount) && Number.isFinite(summary.staleReadingCount) && <p aria-label="Latest reading freshness">Latest readings: {summary.freshReadingCount} recent · {summary.staleReadingCount} outdated · {noData} missing.</p>}</div>
        {summary.evaluatedAt && <p>Last evaluated <time dateTime={summary.evaluatedAt}>{formatTime(summary.evaluatedAt)}</time></p>}</div>
    </>}
  </section>;
}
