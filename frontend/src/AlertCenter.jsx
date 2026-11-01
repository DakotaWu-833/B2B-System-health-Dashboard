import { useCallback, useEffect, useRef, useState } from "react";
import { apiMutation } from "./api";
import { nameIncludes, orderAlerts, readCollection } from "./collectionQuery";
import HeaderTools from "./HeaderTools";
import Icon from "./Icons";
import { useAssistant } from "./AssistantContext";
import Modal from "./Modal";
import SystemDetails from "./SystemDetails";

const COLUMNS = [
  { status: "ACTIVE", label: "Active", description: "Waiting for an operator to take ownership." },
  { status: "ACKNOWLEDGED", label: "Acknowledged", description: "Owned and under investigation." },
  { status: "RESOLVED", label: "Resolved", description: "Closed incidents kept for reference." },
];
const ARCHIVED_COLUMN = { status: "RESOLVED", label: "Archived", description: "Resolved incidents stored for reference. Undo archive to return one to Resolved." };
const formatLabel = value => value.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export default function AlertCenter({ currentUser, onSessionExpired, onAlertsChanged, refreshVersion = 0,
  onResolveRequested, pendingResolution }) {
  const [alerts, setAlerts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("newest");
  const [archivedView, setArchivedView] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [actionAlertId, setActionAlertId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const latestRequest = useRef(0);
  const requestController = useRef(null);
  const updateInProgress = useRef(false);
  const mounted = useRef(false);
  const canManageAlerts = currentUser?.role === "OPERATIONS";
  const assistant = useAssistant();
  const setAssistantScope = assistant?.setScope;
  useEffect(() => { setAssistantScope?.(selectedAlert ? { systemId: selectedAlert.systemId, systemName: selectedAlert.systemName, alertId: selectedAlert.alertId, status: "ALL", archived: Boolean(selectedAlert.archived) } : { status: "ALL", archived: archivedView }); }, [setAssistantScope, selectedAlert, archivedView]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadAlerts = useCallback(async () => {
    const requestId = ++latestRequest.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const isCurrent = () => requestId === latestRequest.current && !controller.signal.aborted;
    setIsLoading(true); setError("");
    try {
      // Read every bounded API page so columns and search cover the complete collection.
      const items = await readCollection("/api/alerts", { signal: controller.signal, idKey: "alertId", parameters: archivedView ? { archived: "true" } : {} });
      if (isCurrent()) { setAlerts(items); setLoaded(true); }
    } catch (failure) {
      if (!isCurrent() || failure.name === "AbortError") return;
      if (failure.status === 401) onSessionExpired?.();
      else setError("Unable to load alerts. Please try again.");
    } finally { if (isCurrent()) setIsLoading(false); }
  }, [onSessionExpired, archivedView]);

  useEffect(() => {
    loadAlerts();
    return () => { latestRequest.current += 1; requestController.current?.abort(); };
  }, [loadAlerts, refreshVersion]);

  async function updateAlert(alert, action) {
    if (updateInProgress.current || isLoading || pendingResolution) return;
    updateInProgress.current = true; setActionAlertId(alert.alertId); setError(""); setFeedback("");
    try {
      await apiMutation(`/api/alerts/${alert.alertId}/${action}`, "PATCH");
      if (!mounted.current) return;
      if (action === "archive" || action === "unarchive") {
        setSelectedAlert(null);
        setAssistantScope?.({ status: "ALL", archived: archivedView });
      }
      const outcome = { acknowledge: "acknowledged successfully", resolve: "resolved successfully", archive: "archived successfully", unarchive: "restored to Resolved" }[action];
      setFeedback(`${alert.systemName} alert ${outcome}.`);
      await loadAlerts();
      if (mounted.current) await onAlertsChanged?.();
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.status === 401) onSessionExpired?.();
      else setError(failure.message || `Unable to ${action} alert.`);
    } finally { updateInProgress.current = false; if (mounted.current) setActionAlertId(null); }
  }

  const matches = alerts.filter(alert => Boolean(alert.archived) === archivedView && nameIncludes(alert.systemName, keyword));
  const ordered = orderAlerts(matches, sort.startsWith("system") ? "systemName" : "createdTime", sort === "oldest" || sort === "system-asc" ? "asc" : "desc");
  const actionInProgress = isLoading || Boolean(error) || actionAlertId !== null || Boolean(pendingResolution);
  function changeView(archived) {
    if (archived === archivedView) return;
    setArchivedView(archived); setSelectedAlert(null); setFeedback(""); setError("");
  }

  return <section className="alert-center alert-center--board" aria-labelledby="alert-center-title">
    <div className="section-header alert-board-heading">
      <div><p className="section-kicker">INCIDENT WORKFLOW</p><h2 id="alert-center-title">Alert Center</h2>
        <p className="section-copy">Follow each incident from first report to resolution.</p></div>
      <div className="alert-controls">
        <label className="alert-sort">Sort alerts<select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          <option value="system-asc">System name A–Z</option><option value="system-desc">System name Z–A</option>
        </select></label>
        <button type="button" className="button-secondary" disabled={isLoading || actionAlertId !== null} onClick={loadAlerts}><Icon name="refresh" />{isLoading ? "Refreshing…" : "Refresh alerts"}</button>
      </div>
    </div>

    <HeaderTools><form className="collection-search" role="search" aria-label="Alert search" onSubmit={event => { event.preventDefault(); setKeyword(searchInput.trim()); setFeedback(""); }}>
      <label htmlFor="alert-name-search">Search alerts by system name</label>
      <div><input id="alert-name-search" type="search" placeholder="Enter part of a system name" value={searchInput} onChange={event => setSearchInput(event.target.value)} />
        <button type="submit" className="button-secondary">Search alerts</button>
        {(keyword || searchInput) && <button type="button" className="button-secondary" onClick={() => { setSearchInput(""); setKeyword(""); setFeedback(""); }}>Clear search</button>}</div>
    </form></HeaderTools>

    <div className="alert-view-tabs" role="group" aria-label="Alert views">
      <button type="button" className="button-secondary" aria-pressed={!archivedView} disabled={actionAlertId !== null} onClick={() => changeView(false)}>Alert board</button>
      <button type="button" className="button-secondary" aria-pressed={archivedView} disabled={actionAlertId !== null} onClick={() => changeView(true)}><Icon name="retention" />Archived</button>
    </div>
    {!canManageAlerts && <p className="permission-note">Management access is read-only. Operations users can acknowledge, resolve, archive and restore alerts.</p>}
    {feedback && <p className="success-message" role="status">{feedback}</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="alert-board-summary"><p role="status" aria-live="polite">{isLoading ? loaded ? "Updating alerts…" : "Loading alerts…" : error ? "Refresh to get the latest alerts." : `${matches.length} ${matches.length === 1 ? "alert" : "alerts"}${keyword ? ` matching “${keyword}”` : " across all systems"}`}</p>
      <span><Icon name="activity" />Click an alert to view recent system metrics</span></div>

    <div className={`alert-board${archivedView ? " alert-board--archived" : ""}`} aria-label={archivedView ? "Archived alerts" : "Alerts by status"} aria-busy={isLoading}>
      {(archivedView ? [ARCHIVED_COLUMN] : COLUMNS).map(column => {
        const items = ordered.filter(alert => alert.status === column.status);
        return <section key={column.status} className={`alert-column alert-column--${column.status.toLowerCase()}`} aria-labelledby={`alert-column-${column.status}`}>
          <header className="alert-column-heading"><div><span className="alert-column-dot" aria-hidden="true" /><h3 id={`alert-column-${column.status}`}>{column.label}</h3></div><span className="alert-column-count" aria-label={`${items.length} ${column.label.toLowerCase()} alerts`}>{isLoading && !loaded ? "—" : items.length}</span></header>
          <p className="alert-column-description">{column.description}</p>
          <div className="alert-column-items" role="region" aria-label={`${column.label} alerts`} tabIndex={0}>
            {items.map(alert => <article key={alert.alertId} className="alert-card" aria-label={`${alert.systemName} ${formatLabel(alert.alertType)} alert #${alert.alertId}`}>
              <button type="button" className="alert-card-open" aria-label={`View recent metrics for ${alert.systemName} alert ${alert.alertId}`} disabled={!alert.systemId} onClick={() => setSelectedAlert(alert)}>
              <div className="alert-card-meta"><span className={`data-badge severity-${alert.severity.toLowerCase()}`}>{formatLabel(alert.severity)}</span><span>#{alert.alertId}</span></div>
              <h4>{formatLabel(alert.alertType)}</h4><p className="alert-card-system"><Icon name="system" />{alert.systemName}</p>
              <p className="alert-card-message">{alert.message}</p>
              <time className="alert-card-time" dateTime={alert.createdTime}><Icon name="response" />{new Date(alert.createdTime).toLocaleString()}</time>
              <span className="alert-card-details">View recent metrics <span aria-hidden="true">↗</span></span>
              </button>
              {pendingResolution?.alert.alertId === alert.alertId && <p className="alert-card-pending" role="status">{pendingResolution.sending ? "Saving resolution…" : "Resolution scheduled · Undo available"}</p>}
              <footer className="alert-card-footer">
                {assistant && <button type="button" className="ask-ai-inline" aria-label={`Ask AI about ${alert.systemName} alert ${alert.alertId}`} onClick={() => assistant.ask({ systemId: alert.systemId, systemName: alert.systemName, alertId: alert.alertId, status: "ALL", archived: Boolean(alert.archived) }, "Explain this alert and suggest what to check next.")}>Ask AI <span aria-hidden="true">↗</span></button>}
                {canManageAlerts && <div className="row-actions">
                  {alert.status === "ACTIVE" && <button type="button" className="button-secondary button-small" disabled={actionInProgress} onClick={() => updateAlert(alert, "acknowledge")}>{actionAlertId === alert.alertId ? "Saving…" : "Acknowledge"}</button>}
                  {alert.status !== "RESOLVED" && <button type="button" className="button-small" disabled={actionInProgress} onClick={() => onResolveRequested ? onResolveRequested(alert) : updateAlert(alert, "resolve")}>Resolve</button>}
                  {alert.status === "RESOLVED" && <button type="button" className="button-secondary button-small" disabled={actionInProgress} onClick={() => updateAlert(alert, alert.archived ? "unarchive" : "archive")}>{actionAlertId === alert.alertId ? "Saving…" : alert.archived ? "Undo archive" : "Archive"}</button>}
                </div>}
              </footer>
            </article>)}
            {!items.length && <p className="alert-column-empty">{isLoading && !loaded ? "Loading alerts…" : !loaded && error ? "Alerts could not be loaded." : keyword ? "No matching alerts in this column." : `No ${column.label.toLowerCase()} alerts.`}</p>}
          </div>
        </section>;
      })}
    </div>
    {selectedAlert && <Modal title={selectedAlert.systemName} onClose={() => setSelectedAlert(null)}>
      <p className="alert-detail-context">Alert #{selectedAlert.alertId} · {formatLabel(selectedAlert.alertType)} · {selectedAlert.message}</p>
      <SystemDetails system={{ id: selectedAlert.systemId, name: selectedAlert.systemName }} initialTab="history" currentUser={currentUser} onSessionExpired={onSessionExpired}
        onMetricSubmitted={async () => { await loadAlerts(); await onAlertsChanged?.(); }} />
    </Modal>}
  </section>;
}
