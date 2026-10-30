import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, apiMutation } from "./api";
import { formatTime } from "./metricDisplay";

export default function MetricRetention({ currentUser, onSessionExpired }) {
  const allowed = currentUser?.role === "OPERATIONS";
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastBatch, setLastBatch] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const request = useRef(0);
  const controller = useRef(null);
  const pending = useRef(false);
  const mounted = useRef(false);

  const loadPreview = useCallback(async () => {
    if (!allowed || pending.current) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    const id = ++request.current;
    setLoading(true); setError(""); setConfirming(false);
    try {
      const data = await apiJson("/api/admin/metrics-retention/preview", { signal: active.signal });
      if (!active.signal.aborted && id === request.current) setPreview(data);
    } catch (failure) {
      if (active.signal.aborted || id !== request.current) return;
      setPreview(null);
      if (failure.status === 401) onSessionExpired?.();
      else setError(failure.status === 403 ? "Only Operations users can manage metric retention." : failure.message);
    } finally {
      if (!active.signal.aborted && id === request.current) setLoading(false);
    }
  }, [allowed, onSessionExpired]);

  useEffect(() => {
    mounted.current = true;
    loadPreview();
    return () => { mounted.current = false; ++request.current; controller.current?.abort(); };
  }, [loadPreview]);

  async function runBatch() {
    if (!confirming || !preview?.enabled || preview.eligibleCount < 1 || pending.current) return;
    pending.current = true; setRunning(true); setError(""); setFeedback("");
    try {
      const data = await apiMutation("/api/admin/metrics-retention/run", "POST");
      if (!mounted.current) return;
      setPreview(data); setLastBatch(data.archivedCount);
      setFeedback(`${data.archivedCount} readings archived. ${data.eligibleCount} eligible readings remain.`);
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.status === 401) onSessionExpired?.();
      else if (failure.status === 409) {
        setPreview(previous => previous ? { ...previous, enabled: false } : null);
        setError("Retention is disabled on the server. Refresh the preview before trying again.");
      } else setError(failure.status === 403 ? "Only Operations users can run an archive batch." :
        failure.status === 503 ? "The archive was not confirmed. Refresh the preview before retrying; another maintenance operation may be running." :
        failure.message || "The archive was not confirmed. Refresh the preview before retrying.");
    } finally {
      pending.current = false;
      if (mounted.current) { setRunning(false); setConfirming(false); }
    }
  }

  if (!allowed) return <section className="form-panel"><h2>Metric retention</h2>
    <p className="permission-note">Only Operations users can access metric retention.</p></section>;

  return <section className="form-panel retention-panel" id="metric-retention" aria-labelledby="retention-title">
    <div className="section-header"><div><h2 id="retention-title">Metric retention</h2>
      <p className="section-copy">Preview older monitoring readings and archive one bounded batch.</p></div>
      <button className="button-secondary" type="button" disabled={loading || running} onClick={loadPreview}>Refresh preview</button></div>
    {loading && <p role="status">Loading retention preview…</p>}
    {error && <p className="error-message" role="alert">{error}</p>}
    {feedback && <p className="success-message" role="status">{feedback}</p>}
    {preview && <>
      <dl className="detail-grid retention-details">
        <div><dt>Server policy</dt><dd>{preview.enabled ? "Enabled" : "Disabled"}</dd></div>
        <div><dt>Archive cutoff</dt><dd><time dateTime={preview.cutoff}>{formatTime(preview.cutoff)}</time></dd></div>
        <div><dt>Eligible readings remaining</dt><dd>{preview.eligibleCount.toLocaleString()}</dd></div>
        <div><dt>Maximum readings per batch</dt><dd>{preview.batchSize.toLocaleString()}</dd></div>
        {lastBatch !== null && <div><dt>Last batch archived</dt><dd>{lastBatch.toLocaleString()}</dd></div>}
      </dl>
      <p className="section-copy">Only readings older than the cutoff that are not a system's latest reading qualify. Each system's latest reading and all alert history are preserved.</p>
      <p className="section-copy">Archived readings move out of normal history queries into persistent archive storage. This is not a database backup. The current API does not provide an archive browser or a restore action.</p>
      {!preview.enabled && <p className="permission-note">Archiving is disabled in the backend configuration. Preview is available; this page cannot enable the server policy.</p>}
      {preview.eligibleCount === 0 && <p className="empty-state">No readings currently qualify for archiving.</p>}
      {!confirming && <button type="button" disabled={loading || running || !preview.enabled || preview.eligibleCount < 1}
        onClick={() => { setFeedback(""); setConfirming(true); }}>Review archive batch</button>}
      {confirming && <div className="retention-confirmation" role="group" aria-labelledby="retention-confirm-title">
        <h3 id="retention-confirm-title">Confirm one archive batch</h3>
        <p>Archive up to {Math.min(preview.eligibleCount, preview.batchSize).toLocaleString()} eligible readings. They will no longer appear in normal metric history. Concurrent submissions or maintenance can change the actual count.</p>
        <div className="row-actions"><button type="button" disabled={running} onClick={runBatch}>{running ? "Archiving…" : "Confirm archive batch"}</button>
          <button type="button" className="button-secondary" disabled={running} onClick={() => setConfirming(false)}>Cancel</button></div>
      </div>}
    </>}
  </section>;
}
