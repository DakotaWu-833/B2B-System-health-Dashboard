import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, apiMutation } from "./api";

const empty = { title: "", content: "", systemId: "", operationsOnly: true };
export default function RunbookLibrary({ currentUser, onSessionExpired }) {
  const operations = currentUser?.role === "OPERATIONS";
  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState(empty);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleting, setDeleting] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const sequence = useRef(0);
  const failed = useCallback(failure => { if (failure.status === 401) onSessionExpired?.(); else setError(failure.message); }, [onSessionExpired]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await apiJson("/api/knowledge/documents"); if (mounted.current) setDocuments(data); }
    catch (failure) { if (mounted.current) failed(failure); }
    finally { if (mounted.current) setLoading(false); }
  }, [failed]);
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; ++sequence.current; }; }, [load]);
  async function open(document) {
    if (pending.current) return;
    const id = ++sequence.current; setError(""); setFeedback(""); setDeleting(false);
    try {
      const data = await apiJson(`/api/knowledge/documents/${document.id}`);
      if (mounted.current && id === sequence.current) { setSelected(data); setDraft({ ...data, systemId: data.systemId ?? "" }); }
    } catch (failure) { if (mounted.current && id === sequence.current) failed(failure); }
  }
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; ++sequence.current; setBusy(true); setError(""); setFeedback("");
    try {
      const body = { ...draft, title: draft.title.trim(), content: draft.content.trim(), systemId: draft.systemId ? Number(draft.systemId) : null };
      const data = await apiMutation(`/api/knowledge/documents${selected ? `/${selected.id}` : ""}`, selected ? "PUT" : "POST", body);
      if (!mounted.current) return;
      setSelected(data); setDraft({ ...data, systemId: data.systemId ?? "" }); setFeedback("Runbook saved and indexed."); await load();
    } catch (failure) { if (mounted.current) failed(failure); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!selected || !deleting || pending.current) return;
    pending.current = true; ++sequence.current; setBusy(true); setError("");
    try {
      await apiMutation(`/api/knowledge/documents/${selected.id}?version=${selected.version}`, "DELETE");
      if (!mounted.current) return;
      setSelected(null); setDraft(empty); setDeleting(false); setFeedback("Runbook deleted."); await load();
    } catch (failure) { if (mounted.current) failed(failure); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const id = ++sequence.current;
    if (file.size > 128000 || !/\.(txt|md)$/i.test(file.name)) { setError("Choose a .txt or .md file smaller than 128 KB."); return; }
    const content = await file.text();
    if (!mounted.current || id !== sequence.current) return;
    if (content.length > 32000) { setError("Runbooks can contain up to 32,000 characters."); return; }
    setError(""); setDraft(previous => ({ ...previous, content, title: previous.title || file.name.replace(/\.(txt|md)$/i, "") }));
  }
  function field(name, value) { ++sequence.current; setDraft(previous => ({ ...previous, [name]: value })); setDeleting(false); }
  return <div className="runbook-layout">
    <section className="assistant-card" aria-label="Runbook list"><div className="section-header"><h3>Runbook library</h3><button type="button" className="button-secondary button-small" disabled={busy || loading} onClick={load}>Refresh</button></div>
      <p className="section-description">Up to 200 recent documents available to your role.</p>
      {operations && <button type="button" className="button-secondary" disabled={busy} onClick={() => { ++sequence.current; setSelected(null); setDraft(empty); setDeleting(false); setFeedback(""); }}>New runbook</button>}
      {loading && <p role="status">Loading runbooks…</p>}
      {!loading && documents.length === 0 && <p className="empty-state">No runbooks yet. {operations ? "Add your team's operating procedures to start." : "Ask Operations to add shared runbooks."}</p>}
      <ul className="runbook-list">{documents.map(document => <li key={document.id}><button type="button" disabled={busy} aria-pressed={selected?.id === document.id} onClick={() => open(document)}><strong>{document.title}</strong><span>Version {document.version} · {document.operationsOnly ? "Operations" : "Shared"} · {document.chunkCount} excerpts</span></button></li>)}</ul>
    </section>
    <section className="assistant-card" aria-label="Runbook editor">
      {error && <p role="alert" className="error-message">{error}</p>}{feedback && <p role="status" className="success-message">{feedback}</p>}
      {operations ? <><h3>{selected ? "Edit runbook" : "Add a runbook"}</h3><p className="section-description">Add verified operating procedures or clearly labelled example incidents. Saved changes replace the searchable version.</p>
        <form className="editor-form" onSubmit={save} aria-busy={busy}>
          <label>Title<input required maxLength={200} disabled={busy} value={draft.title} onChange={event => field("title", event.target.value)} /></label>
          <label>Import text or Markdown<input type="file" accept=".txt,.md,text/plain,text/markdown" disabled={busy} onChange={importFile} /></label>
          <label>Runbook content<textarea required rows={13} maxLength={32000} disabled={busy} value={draft.content} onChange={event => field("content", event.target.value)} /></label>
          <label>System ID (optional)<input type="number" min="1" step="1" disabled={busy} value={draft.systemId} onChange={event => field("systemId", event.target.value)} /></label>
          <label className="assistant-checkbox"><input type="checkbox" disabled={busy} checked={draft.operationsOnly} onChange={event => field("operationsOnly", event.target.checked)} />Operations only</label>
          <div className="assistant-tabs"><button disabled={busy || !draft.title.trim() || !draft.content.trim()}>{busy ? "Saving…" : "Save and index"}</button>{selected && <button type="button" className="button-secondary" disabled={busy} onClick={() => setDeleting(true)}>Delete runbook</button>}</div>
        </form>
        {deleting && <div className="assistant-confirm"><p>Delete “{selected.title}” and remove its searchable excerpts?</p><div className="assistant-tabs"><button disabled={busy} onClick={remove}>Confirm deletion</button><button className="button-secondary" disabled={busy} onClick={() => setDeleting(false)}>Cancel</button></div></div>}
      </> : selected ? <><h3>{selected.title}</h3><p className="section-copy">Version {selected.version}</p><p className="assistant-answer">{selected.content}</p></> : <div className="empty-state">Select a runbook to read its full content.</div>}
    </section>
  </div>;
}
