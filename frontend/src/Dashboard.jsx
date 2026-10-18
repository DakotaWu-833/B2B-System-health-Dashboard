import { useCallback, useEffect, useRef, useState } from "react";
import AlertCenter from "./AlertCenter";
import { HealthDistribution } from "./Charts";
import SystemDetails from "./SystemDetails";
import SystemForm from "./SystemForm";
import { apiFetch } from "./api";

const PAGE_SIZE = 10;
const value = (number, unit = "") => number == null ? "No fresh data" : `${Number(number).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;
function Dashboard({ currentUser, onSessionExpired }) {
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [systems, setSystems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, healthy: 0, warning: 0, critical: 0, offline: 0 });
  const [pagination, setPagination] = useState({ page: 0, totalPages: 0, totalElements: 0, first: true, last: true });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [editor, setEditor] = useState(null);
  const [feedback, setFeedback] = useState("");
  const sequence = useRef(0);
  const summarySequence = useRef(0);
  const controller = useRef(null);
  const canManage = currentUser?.role === "OPERATIONS";
  const loadDashboard = useCallback(async (requestedPage = 0) => {
    const requestId = ++sequence.current;
    const summaryRequestId = ++summarySequence.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setIsLoading(true); setError(""); setSummaryError("");
    try {
      const [summaryResponse, systemsResponse] = await Promise.all([
        apiFetch("/api/dashboard/summary", { signal: abort.signal }),
        apiFetch(`/api/systems/page?page=${requestedPage}&size=${PAGE_SIZE}`, { signal: abort.signal }),
      ]);
      if (abort.signal.aborted || requestId !== sequence.current) return;
      if (summaryResponse.status === 401 || systemsResponse.status === 401) { onSessionExpired?.(); return; }
      if (!summaryResponse.ok || !systemsResponse.ok) throw new Error("Failed to load dashboard data.");
      const [summaryResult, systemsResult] = await Promise.all([summaryResponse.json(), systemsResponse.json()]);
      if (abort.signal.aborted || requestId !== sequence.current) return;
      if (!summaryResult.success || !systemsResult.success) throw new Error("Backend returned an unsuccessful response.");
      // Accept the legacy array shape during the API transition.
      const page = Array.isArray(systemsResult.data) ? { items: systemsResult.data, page: 0, totalPages: systemsResult.data.length ? 1 : 0,
        totalElements: systemsResult.data.length, first: true, last: true } : systemsResult.data;
      if (page.page > 0 && page.page >= page.totalPages) { await loadDashboard(Math.max(0, page.totalPages - 1)); return; }
      if (summaryRequestId === summarySequence.current) setSummary(summaryResult.data);
      setSystems(page.items); setPagination(page); setHasLoaded(true);
      setSelectedSystem(previous => previous ? page.items.find(system => system.id === previous.id) || null : null);
    } catch (failure) {
      if (!abort.signal.aborted && requestId === sequence.current) setError("Unable to load dashboard data. Please try again.");
    } finally { if (!abort.signal.aborted && requestId === sequence.current) setIsLoading(false); }
  }, [onSessionExpired]);
  useEffect(() => { loadDashboard(); return () => { sequence.current++; summarySequence.current++; controller.current?.abort(); }; }, [loadDashboard]);
  const refreshSummary = useCallback(async () => {
    const requestId = ++summarySequence.current;
    try {
      const response = await apiFetch("/api/dashboard/summary");
      if (response.status === 401) { onSessionExpired?.(); return; }
      const result = await response.json();
      if (requestId !== summarySequence.current) return;
      if (!response.ok || !result.success) throw new Error();
      setSummary(result.data); setSummaryError("");
    } catch { if (requestId === summarySequence.current) setSummaryError("Alerts updated, but the summary could not refresh. Refresh the dashboard to retry."); }
  }, [onSessionExpired]);
  async function saved(system) {
    setEditor(null); setFeedback(`${system.name} saved successfully.`);
    await loadDashboard(pagination.page);
  }
  return <section className="dashboard" id="dashboard">
    <div className="dashboard-header"><div><p className="section-kicker">Live overview</p><h2>System Health Dashboard</h2>
      <p className="section-description">Current status across all monitored services and servers.</p></div>
      <button type="button" onClick={() => loadDashboard(pagination.page)} disabled={isLoading}>{isLoading ? "Refreshing dashboard…" : "Refresh dashboard"}</button></div>
    {feedback && <p role="status" className="success-message">{feedback}</p>}
    {summaryError && <p role="alert" className="error-message">{summaryError}</p>}
    {canManage && editor && <SystemForm key={editor.id || "new"} system={editor.id ? editor : null} onSaved={saved} onCancel={() => setEditor(null)} onSessionExpired={onSessionExpired} />}
    {isLoading && <p>Loading dashboard data...</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {!isLoading && !error && <>
      <section><h2>Overview</h2><div className="overview-grid">
        {[["total", "Total Systems"], ["healthy", "Healthy"], ["warning", "Warning"], ["critical", "Critical"], ["offline", "Offline"]].map(([key, title]) =>
          <div key={key} className={`overview-card overview-${key}`}><h3>{title}</h3><p>{summary[key]}</p></div>)}
      </div><div className="overview-grid kpi-grid">
        {[["activeAlertCount", "Active alerts", ""], ["averageCpuUsage", "Average CPU", "%"], ["averageMemoryUsage", "Average memory", "%"], ["averageResponseTime", "Average response time", " ms"]].map(([key, title, unit]) =>
          <div key={key} className="overview-card"><h3>{title}</h3><p>{value(summary[key], unit)}</p></div>)}
      </div>{summary.evaluatedAt && <p className="section-description">Summary updated {new Date(summary.evaluatedAt).toLocaleString()}</p>}
        <p className="section-description">Averages use fresh, available readings. Health status and data freshness are shown separately.</p>
      </section>
      <div className="dashboard-main-grid"><HealthDistribution summary={summary} /><section className="systems-panel"><div className="section-header"><h2>Systems</h2>
        {canManage && <button type="button" onClick={() => setEditor({})}>Add system</button>}</div>
        {systems.length === 0 ? <p className="empty-state" role="status">No monitored systems are available yet.</p> : <>
          <div className="table-wrapper"><table><thead><tr>{["Name", "Type", "Host", "Status", "Latest metrics", "Last measurement", "Data freshness", ...(canManage ? ["Actions"] : [])].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead>
            <tbody>{systems.map(system => <tr key={system.id} className={selectedSystem?.id === system.id ? "is-selected" : ""}
              onClick={() => setSelectedSystem(system)} onKeyDown={event => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); setSelectedSystem(system); } }} tabIndex={0} role="button">
              <td>{system.name}</td><td>{system.type}</td><td>{system.host}</td><td><span className={`system-status status-${system.status.toLowerCase()}`}>{system.status}</span></td>
              <td>{system.latestMetric ? <><span className="cell-detail">CPU {value(system.latestMetric.cpuUsage, "%")}</span><span className="cell-detail">Memory {value(system.latestMetric.memoryUsage, "%")}</span><span className="cell-detail">{value(system.latestMetric.responseTime, " ms")}</span></> : "No measurements"}</td>
              <td>{system.lastUpdated ? new Date(system.lastUpdated).toLocaleString() : "Not measured"}</td><td>{system.metricDataStatus || "NO_DATA"}</td>
              {canManage && <td><button className="button-secondary button-small" type="button" onClick={event => { event.stopPropagation(); setEditor(system); }}>Edit {system.name}</button></td>}
            </tr>)}</tbody></table></div>
          <nav className="pagination" aria-label="System pages"><button className="button-secondary" disabled={pagination.first} onClick={() => loadDashboard(pagination.page - 1)}>Previous systems</button>
            <span>Systems page {pagination.page + 1} of {pagination.totalPages} · {pagination.totalElements} systems</span>
            <button className="button-secondary" disabled={pagination.last} onClick={() => loadDashboard(pagination.page + 1)}>Next systems</button></nav>
        </>}
      </section></div>
      <SystemDetails system={selectedSystem} onSessionExpired={onSessionExpired} />
    </>}
    {currentUser && hasLoaded && <AlertCenter currentUser={currentUser} onSessionExpired={onSessionExpired} onChanged={refreshSummary} />}
  </section>;
}
export default Dashboard;
