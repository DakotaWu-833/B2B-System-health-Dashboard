import { useEffect, useRef, useState } from "react";
import { apiJson, apiMutation } from "./api";
import Icon from "./Icons";
import RunbookLibrary from "./RunbookLibrary";

const statusText = {
  insufficient_evidence: "There is not enough relevant evidence to answer. Add a runbook or try a more specific question.",
  retrieval_only: "Relevant source excerpts are ready. Model responses are currently turned off.",
  model_disabled: "The current observations are ready. Model analysis is currently turned off.",
  model_unavailable: "The model could not finish. You can still review the evidence below.",
  unverified_answer: "The response did not include valid evidence references. Review the original observations below.",
  sources_changed: "A source changed during this request. Run the request again for current evidence.",
  budget_exhausted: "The investigation reached its limit. Review the observations or ask a more focused question.",
  proposal_conflict: "An alert changed during the investigation. Run it again before taking action.",
};
const toolNames = { get_system: "Current system state", query_metrics: "Recent metric history", list_alerts: "Recent alerts", search_runbooks: "Runbook search", propose_alert_action: "Suggested alert action" };

export default function AssistantPage({ currentUser, onSessionExpired, onAlertsChanged }) {
  const [tab, setTab] = useState("ask");
  const [question, setQuestion] = useState("");
  const [systemId, setSystemId] = useState("");
  const [systems, setSystems] = useState([]);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [review, setReview] = useState(null);
  const [confirmed, setConfirmed] = useState({});
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const mounted = useRef(false);
  const version = useRef(0);
  const operations = currentUser?.role === "OPERATIONS";

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++version.current; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    apiJson(`/api/systems/page?page=${page}&size=100`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setSystems(data.items); setLastPage(data.last);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure.status === 401) onSessionExpired?.(); else setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, onSessionExpired]);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  function reset(next) { if (pending.current) return; ++version.current; setTab(next); setResult(null); setReview(null); setError(""); }
  async function submit(event) {
    event.preventDefault();
    if (pending.current || !question.trim() || (tab === "diagnose" && !systemId)) return;
    pending.current = true; setBusy(true); setError(""); setResult(null); setReview(null); setConfirmed({});
    const request = ++version.current;
    try {
      const data = await apiMutation(`/api/assistant/${tab}`, "POST", { question: question.trim(), systemId: systemId ? Number(systemId) : null });
      if (mounted.current && request === version.current) setResult(data);
    } catch (failure) {
      if (!mounted.current || request !== version.current) return;
      if (failure.status === 401) onSessionExpired?.(); else {
        setError(failure.message);
        if (failure.retryAfter) { setRetryAt(Date.now() + failure.retryAfter * 1000); setNow(Date.now()); }
      }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function confirm() {
    if (!review || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const data = await apiMutation(`/api/assistant/proposals/${review.id}/confirm`, "POST");
      if (!mounted.current) return;
      setConfirmed(previous => ({ ...previous, [review.id]: data.status })); setReview(null); onAlertsChanged?.();
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.status === 401) onSessionExpired?.();
      else { setError(failure.message); if ([403, 404, 409].includes(failure.status)) setReview(null); }
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return <section className="assistant-page" aria-labelledby="assistant-title">
    <div className="page-heading"><div><p className="section-kicker">INVESTIGATE WITH CONTEXT</p><h2 id="assistant-title">Operations assistant</h2><p className="section-description">Bring your system observations and runbooks into one investigation.</p></div><span className="assistant-emblem"><Icon name="assistant" /></span></div>
    <div className="assistant-tabs" role="group" aria-label="Assistant workspace">
      {[["ask", "Runbook Q&A"], ["diagnose", "Investigate a system"], ["library", "Runbook library"]].map(([id, label]) => <button key={id} type="button" className={tab === id ? "" : "button-secondary"} aria-pressed={tab === id} disabled={busy} onClick={() => reset(id)}>{label}</button>)}
    </div>
    {tab === "library" ? <RunbookLibrary currentUser={currentUser} onSessionExpired={onSessionExpired} /> : <>
      <div className="assistant-layout"><div className="assistant-compose">
        <div className="assistant-card"><p className="section-kicker">{tab === "ask" ? "SEARCH YOUR KNOWLEDGE" : "START AN INVESTIGATION"}</p><h3>{tab === "ask" ? "What would you like to understand?" : "Which system needs a closer look?"}</h3>
          <form className="editor-form" onSubmit={submit} aria-busy={busy}>
            <label>System scope<select value={systemId} disabled={busy || loading} onChange={event => { setSystemId(event.target.value); setResult(null); setReview(null); }}>
              <option value="">{tab === "ask" ? "All accessible runbooks" : "Choose a system"}</option>
              {systemId && !systems.some(s => String(s.id) === systemId) && <option value={systemId}>Selected system #{systemId}</option>}
              {systems.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select></label>
            {(page > 0 || !lastPage) && <div className="assistant-pagination"><button type="button" className="button-secondary button-small" disabled={busy || loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous systems</button><span>Page {page + 1}</span><button type="button" className="button-secondary button-small" disabled={busy || loading || lastPage} onClick={() => setPage(p => p + 1)}>More systems</button></div>}
            <label>Your question<textarea rows={5} maxLength={2000} required value={question} disabled={busy} onChange={event => { setQuestion(event.target.value); setResult(null); setReview(null); }} placeholder={tab === "ask" ? "How should we investigate a high memory alert?" : "What do the latest metrics and alerts tell us?"} /></label>
            <p className="section-copy">{tab === "ask" ? "Answers use the runbooks available to your role, with source excerpts you can review." : "The assistant reads current observations and suggests next steps. Alert changes require your confirmation."}</p>
            <button disabled={busy || loading || wait > 0 || !question.trim() || (tab === "diagnose" && !systemId)}>{busy ? "Gathering evidence…" : wait > 0 ? `Try again in ${wait}s` : tab === "ask" ? "Search runbooks" : "Investigate system"}<Icon name="arrow" /></button>
          </form>
        </div>
        <aside className="assistant-note"><Icon name="shield" /><div><strong>Evidence comes first</strong><p>Check data freshness and cited sources before acting. A suggested cause still needs verification.</p></div></aside>
      </div><div className="assistant-results" aria-live="polite">
        {error && <p className="error-message" role="alert">{error}</p>}
        {!result && <div className="assistant-empty"><Icon name="assistant" /><h3>{busy ? "Connecting the observations" : "A clearer picture starts here"}</h3><p>{busy ? "Reading evidence and preparing a response. This may take a moment." : "Ask a question to see relevant sources and the observations behind each suggestion."}</p></div>}
        {result && <>
          <article className="assistant-card"><p className="section-kicker">{tab === "ask" ? "KNOWLEDGE RESPONSE" : "INVESTIGATION"}</p><h3>{result.answer || result.summary ? "What the evidence suggests" : "Evidence collected"}</h3>
            {statusText[result.status] && <p className="assistant-status" role="status">{statusText[result.status]}</p>}
            {(result.answer || result.summary) && <p className="assistant-answer">{result.answer || result.summary}</p>}
            {result.id && <small className="section-copy">Saved investigation · {new Date(result.createdAt).toLocaleString()}</small>}
          </article>
          {result.citations?.length > 0 && <section className="assistant-card" aria-label="Cited sources"><h3>Source excerpts</h3><div className="assistant-sources">{result.citations.map(source => <details key={source.id} open><summary><strong>{source.title}</strong><span>Version {source.version} · excerpt {source.chunk + 1}</span></summary><blockquote>{source.excerpt}</blockquote><small>Reference: {source.id}</small></details>)}</div></section>}
          {result.trace?.length > 0 && <section className="assistant-card" aria-label="Investigation evidence"><h3>Observations behind the response</h3><div className="assistant-trace">{result.trace.map(step => <details key={step.id}><summary><span className="assistant-step">{step.id}</span><strong>{toolNames[step.tool] || "Observation rejected"}</strong></summary><pre>{JSON.stringify(step.output, null, 2)}</pre></details>)}</div></section>}
          {operations && result.proposals?.length > 0 && <section className="assistant-card" aria-label="Suggested alert actions"><h3>Actions for your review</h3>{result.proposals.map(proposal => <div className="assistant-proposal" key={proposal.id}><strong>{proposal.action === "ACKNOWLEDGE" ? "Acknowledge" : "Resolve"} alert #{proposal.alertId}</strong><p>{proposal.reason}</p>{confirmed[proposal.id] ? <p role="status" className="success-message">Confirmed: {confirmed[proposal.id]}</p> : <><small>Valid until {new Date(proposal.expiresAt).toLocaleTimeString()}</small><button type="button" className="button-secondary" disabled={busy} onClick={() => setReview(proposal)}>Review action</button></>}</div>)}</section>}
          {review && <section className="assistant-card assistant-confirm" aria-label="Confirm alert action"><h3>Confirm this change?</h3><p>This will {review.action === "ACKNOWLEDGE" ? "acknowledge" : "resolve"} alert #{review.alertId}. Confirm only after reviewing the observations.</p><p>{review.reason}</p><div className="assistant-tabs"><button disabled={busy} onClick={confirm}>{busy ? "Saving…" : "Confirm alert change"}</button><button className="button-secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button></div></section>}
        </>}
      </div></div>
    </>}
  </section>;
}
