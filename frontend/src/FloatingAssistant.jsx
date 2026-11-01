import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiMutation } from "./api";
import { assistantRequest } from "./assistantRequest";
import Icon from "./Icons";
import useAssistantPosition from "./useAssistantPosition";

const pages = { dashboard: "Dashboard", system: "Systems", alerts: "Alert Center", profile: "My profile", retention: "Metric retention", assistant: "Runbook library" };
const notices = {
  insufficient_evidence: "I don't have enough relevant evidence yet. Try a more specific question or add a related runbook.",
  retrieval_only: "Model responses are off. You can still review the current observations and matching runbooks below.",
  model_disabled: "Model analysis is off. Here are the available observations.",
  model_unavailable: "I couldn't reach the model. The collected evidence is still available below.",
  model_timeout: "The analysis reached its time limit. Review the evidence or try a more focused question.",
  unverified_answer: "I couldn't verify the response references. Review the original evidence below.",
  sources_changed: "A source changed while I was answering. Please ask again for current evidence.",
  budget_exhausted: "The investigation reached its limit. Here are the observations collected so far.",
  proposal_conflict: "An alert changed during the investigation. Run it again before confirming an action.",
};
const questions = {
  dashboard: ["What needs attention right now?", "Explain the dashboard numbers.", "Find a relevant operating procedure."],
  system: ["Summarise system health.", "What should I check next?", "Find a related runbook."],
  alerts: ["Summarise the alerts in this view.", "How should I investigate these alerts?", "What does acknowledged mean?"],
  profile: ["How do I verify my email?", "Is my email verified?", "What can my role do?"],
  retention: ["Explain the archive preview.", "What happens when I run an archive batch?", "Does preview change any data?"],
  assistant: ["How do I add a runbook?", "How are sources selected?", "How do investigations work?"],
};
const readable = key => key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
function EvidenceData({ value, depth = 0 }) {
  if (value == null) return <span>Not available</span>;
  if (typeof value !== "object") return <span>{typeof value === "boolean" ? value ? "Yes" : "No" : String(value)}</span>;
  if (depth > 3) return <span>Additional detail available in the workspace.</span>;
  if (Array.isArray(value)) return value.length ? <ol className="chat-evidence-list">{value.slice(0, 10).map((item, index) => <li key={index}><EvidenceData value={item} depth={depth + 1} /></li>)}</ol> : <span>No matching records</span>;
  return <dl className="chat-evidence-data">{Object.entries(value).filter(([key]) => key !== "nextCursor").map(([key, item]) => <div key={key}><dt>{readable(key)}</dt><dd><EvidenceData value={item} depth={depth + 1} /></dd></div>)}</dl>;
}
function AnswerText({ text }) {
  return text.split(/\n\s*\n/).map((paragraph, index) => <p className="chat-answer" key={index}>{paragraph.split(/(\*\*[^*]+\*\*)/).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</p>);
}

export default function FloatingAssistant({ scope, launch, host, currentUser, onSessionExpired, onAlertsChanged, selectionActive, onClearSelection }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState({});
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [review, setReview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState({});
  const [actionError, setActionError] = useState("");
  const mounted = useRef(false);
  const active = useRef(null);
  const actionPending = useRef(false);
  const id = useRef(0);
  const composer = useRef(null);
  const launcher = useRef(null);
  const panel = useRef(null);
  const position = useAssistantPosition(scope.page, open, host, launcher, panel);
  const previousFocus = useRef(null);
  const messagesEnd = useRef(null);
  const previousThread = useRef(null);
  const threadKey = JSON.stringify([scope.page, scope.systemId || null, scope.alertId || null, scope.status || "ALL", ...(scope.page === "alerts" ? [Boolean(scope.archived)] : [])]);
  const messages = threads[threadKey] || [];
  const label = `${pages[scope.page] || "Workspace"}${scope.page === "alerts" && scope.archived ? " · Archived" : ""}${scope.systemName ? ` · ${scope.systemName}` : ""}${scope.alertId ? ` · Alert #${scope.alertId}` : ""}`;
  const suggestions = scope.alertId ? ["Explain this alert.", "What should I check next?", "Find a related runbook."] : questions[scope.page] || questions.dashboard;
  const operations = currentUser?.role === "OPERATIONS";
  const wait = Math.max(0, Math.ceil((retryUntil - now) / 1000));

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.job.cancel(); }; }, []);
  useEffect(() => {
    if (previousThread.current !== threadKey) {
      previousThread.current = threadKey;
      active.current?.job.cancel(); setDraft(""); setReview(null); setActionError("");
    }
  }, [threadKey]);
  useEffect(() => {
    if (!launch || launch.page !== scope.page) return;
    setOpen(true); setDraft(launch.question); composer.current?.focus();
  }, [launch]);
  useEffect(() => {
    if (open) { previousFocus.current = document.activeElement; composer.current?.focus(); }
    else if (previousFocus.current?.isConnected) previousFocus.current.focus();
  }, [open, host]);
  useEffect(() => { if (open) messagesEnd.current?.scrollIntoView?.({ block: "nearest" }); }, [messages, busy, open]);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now(); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (retryUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, [retryUntil]);

  function append(key, message) {
    if (!mounted.current) return;
    setThreads(previous => {
      const next = { ...previous, [key]: [...(previous[key] || []), message].slice(-40) };
      const keys = Object.keys(next); if (keys.length > 12) delete next[keys.find(k => k !== key)];
      return next;
    });
  }
  async function send(question = draft, mode = "CHAT") {
    const text = question.trim();
    if (!text || active.current || actionPending.current || wait > 0) return;
    const key = threadKey;
    const context = { page: scope.page, systemId: scope.systemId || null, alertId: scope.alertId || null, status: scope.status || null, ...(scope.page === "alerts" ? { archived: Boolean(scope.archived) } : {}) };
    const history = messages.filter(message => message.role === "user" || message.reply?.answer)
      .slice(-6).map(message => ({ role: message.role, content: (message.text || message.reply.answer).slice(0, 800) }));
    append(key, { id: ++id.current, role: "user", text, contextLabel: label });
    setDraft(""); setBusy(true); setElapsed(0); setReview(null); setActionError("");
    const job = assistantRequest(signal => apiMutation("/api/assistant/chat", "POST", { question: text, mode, context, history }, { signal }), mode === "INVESTIGATE" ? 110000 : 55000);
    active.current = { job, key };
    try {
      const reply = await job.promise;
      append(key, { id: ++id.current, role: "assistant", reply });
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.status === 401) onSessionExpired?.();
      else {
        const text = failure.name === "AbortError" ? "Request cancelled. Your conversation is saved."
          : failure.name === "TimeoutError" ? "The request timed out. Please try a more focused question."
          : failure.message || "I couldn't complete the request. Please try again.";
        append(key, { id: ++id.current, role: "assistant", text, error: true });
        if (failure.retryAfter) { setRetryUntil(Date.now() + failure.retryAfter * 1000); setNow(Date.now()); }
      }
    } finally {
      if (active.current?.job === job) { active.current = null; if (mounted.current) setBusy(false); }
      if (mounted.current) composer.current?.focus();
    }
  }
  async function confirm() {
    if (!review || actionPending.current || active.current) return;
    actionPending.current = true; setConfirming(true); setActionError("");
    const selected = review;
    const job = assistantRequest(signal => apiMutation(`/api/assistant/proposals/${selected.id}/confirm`, "POST", undefined, { signal }), 20000);
    try {
      const result = await job.promise;
      if (mounted.current) { setConfirmed(previous => ({ ...previous, [selected.id]: result.status })); setReview(null); onAlertsChanged?.(); }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure.status === 401) onSessionExpired?.();
      else setActionError(failure.name === "TimeoutError" ? "The change was not confirmed. Review the alert before retrying; retrying this proposal returns the same committed result." : failure.message);
    } finally { actionPending.current = false; if (mounted.current) setConfirming(false); }
  }
  function close() { setOpen(false); launcher.current?.focus(); }
  const content = <div className={`context-assistant${scope.page === "alerts" ? " context-assistant--alerts" : ""}${host ? " context-assistant--in-modal" : ""}`} data-dragging={position.moving || undefined}>
    <p id="ai-position-help" className="visually-hidden">Drag to move, or use arrow keys when the move handle or AI button is focused. Press Home to reset the position.</p>
    {open && <section ref={panel} style={position.panelStyle} className="context-chat" id="context-ai-chat" role="dialog" aria-label="AI conversation" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <header className="context-chat-header" {...position.panelEvents}><button type="button" className="chat-move-handle" data-ai-drag-handle aria-label="Move AI conversation" aria-describedby="ai-position-help" onKeyDown={position.panelKeyDown} title="Drag to move · Arrow keys to move · Home to reset"><span aria-hidden="true">⠿</span></button><span className="context-chat-avatar"><Icon name="assistant" /></span><div><h2>Operations assistant</h2><p><span className="chat-presence" />Here to help with this page</p></div>
        <button type="button" className="chat-icon-button chat-reset-position" aria-label="Reset AI position" title="Reset position" onClick={position.reset}><Icon name="refresh" /></button>
        <button type="button" className="chat-icon-button" aria-label="Close AI conversation" onClick={close}><Icon name="close" /></button>
      </header>
      <div className="context-chat-scope"><Icon name={scope.page === "assistant" ? "runbooks" : scope.page} /><span title={label}>{label}</span>{selectionActive ? <button type="button" className="chat-scope-tag" aria-label="Use page context" title="Ask about the whole page" disabled={confirming} onClick={onClearSelection}>Clear selection</button> : <span className="chat-scope-tag">Page context</span>}</div>
      <div className="context-chat-messages" role="log" aria-label="AI conversation messages" aria-live="polite" aria-relevant="additions">
        <div className="chat-welcome"><span className="chat-welcome-icon"><Icon name="assistant" /></span><h3>A little help, right where you are.</h3><p>{scope.alertId ? "Ask about this alert, its measurements, or the next checks to make." : `Ask about ${pages[scope.page]?.toLowerCase() || "this page"}, or find a relevant operating procedure.`}</p></div>
        {messages.map(message => <article key={message.id} className={`chat-message chat-message--${message.role}${message.error ? " chat-message--error" : ""}`}>
          <span className="chat-message-author">{message.role === "user" ? "You" : "Assistant"}</span>
          {message.text && <AnswerText text={message.text} />}
          {message.reply && <>
            {message.reply.freshnessNotice && <p className="chat-freshness-note"><Icon name="response" />{message.reply.freshnessNotice}</p>}
            {message.reply.answer ? <AnswerText text={message.reply.answer} /> : <p className="chat-answer">{notices[message.reply.status] || "Here are the observations available for this request."}</p>}
            <p className="chat-response-context">{message.reply.contextLabel} · {new Date(message.reply.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            {(message.reply.citations?.length > 0 || message.reply.observations?.length > 0) && <details className="chat-sources"><summary>Sources & observations <span>{(message.reply.citations?.length || 0) + (message.reply.observations?.length || 0)}</span></summary>
              {message.reply.citations?.map(source => <details key={source.id}><summary>{source.title} · v{source.version}</summary><blockquote>{source.excerpt}</blockquote><small>{source.id}</small></details>)}
              {message.reply.observations?.map(observation => <details key={observation.id}><summary>{observation.id} · {readable(observation.title)}</summary><EvidenceData value={observation.data} /></details>)}
            </details>}
            {operations && message.reply.proposals?.map(proposal => <div className="chat-proposal" key={proposal.id}><strong>{proposal.action === "ACKNOWLEDGE" ? "Acknowledge" : "Resolve"} alert #{proposal.alertId}</strong><p>{proposal.reason}</p>
              {confirmed[proposal.id] ? <p role="status">Confirmed: {confirmed[proposal.id]}</p> : <button type="button" className="button-secondary button-small" disabled={busy || confirming} onClick={() => { setReview(proposal); setActionError(""); }}>Review action</button>}
            </div>)}
          </>}
        </article>)}
        {busy && <div className="chat-thinking" role="status"><span className="chat-thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Reading the evidence · {elapsed}s</span><button type="button" onClick={() => active.current?.job.cancel()}>Cancel</button></div>}
        <div ref={messagesEnd} />
      </div>
      {review && <div className="chat-action-review" role="group" aria-label="Confirm AI suggested action"><strong>Confirm this alert change?</strong><p>{review.action === "ACKNOWLEDGE" ? "Acknowledge" : "Resolve"} alert #{review.alertId}. Review the evidence before continuing.</p><div className="row-actions"><button type="button" className="button-small" disabled={confirming || busy} onClick={confirm}>{confirming ? "Saving…" : "Confirm change"}</button><button type="button" className="button-secondary button-small" disabled={confirming} onClick={() => setReview(null)}>Cancel review</button></div></div>}
      {actionError && <p className="chat-action-error" role="alert">{actionError}</p>}
      <footer className="context-chat-footer">
        {scope.systemId && <button type="button" className="chat-investigate" disabled={busy || confirming || wait > 0} onClick={() => send(scope.alertId ? `Investigate alert #${scope.alertId} using its system measurements, alerts and runbooks.` : "Investigate this system using its measurements, alerts and runbooks.", "INVESTIGATE")}><Icon name="activity" />Investigate {scope.alertId ? "this alert" : "this system"}</button>}
        <p className="chat-suggestions-label">Try asking</p>
        <div className="chat-suggestions" aria-label="Suggested questions">{suggestions.map(question => <button type="button" key={question} disabled={busy || confirming || wait > 0} onClick={() => send(question)}>{question}<Icon name="arrow" /></button>)}</div>
        <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}><label className="visually-hidden" htmlFor="context-ai-question">Message the AI assistant</label><textarea id="context-ai-question" ref={composer} rows={2} maxLength={2000} value={draft} disabled={busy || confirming} onChange={event => setDraft(event.target.value)} placeholder="Ask about this page…" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><button type="submit" aria-label="Send AI message" disabled={busy || confirming || !draft.trim() || wait > 0}><Icon name="arrow" /></button></form>
        <div className="chat-footer-note"><span>{wait > 0 ? `Try again in ${wait}s` : "Check the evidence before acting."}</span><button type="button" className="chat-clear" disabled={busy || confirming || !messages.length} onClick={() => { setThreads(previous => ({ ...previous, [threadKey]: [] })); setReview(null); setActionError(""); }}>New chat</button></div>
      </footer>
    </section>}
    <button ref={launcher} style={position.launcherStyle} {...position.launcherEvents} onKeyDown={position.launcherKeyDown} type="button" className={`context-ai-launcher${open ? " is-open" : ""}`} aria-label={open ? "Minimise AI assistant" : "Open AI assistant"} aria-describedby="ai-position-help" title="Click to chat · Drag to move" aria-expanded={open} aria-controls="context-ai-chat" onClick={event => { if (!position.consumeDragClick(event)) setOpen(value => !value); }}><Icon name={open ? "close" : "assistant"} /><span>{open ? "Minimise" : "Ask AI"}</span>{!open && <span className="chat-launcher-dot" />}</button>
  </div>;
  return createPortal(content, host || document.body);
}
