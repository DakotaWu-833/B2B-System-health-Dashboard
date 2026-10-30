import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "./api";
import { formatMetric, formatTime } from "./metricDisplay";
import Modal from "./Modal";
import SystemDetails from "./SystemDetails";
import SystemForm from "./SystemForm";
import { collectionPage, nameIncludes, readCollection } from "./collectionQuery";
import HeaderTools from "./HeaderTools";

export default function SystemsPage({ currentUser, onSessionExpired }) {
  const [page, setPage] = useState({ items: [], page: 0, totalPages: 0, totalElements: 0, first: true, last: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const collection = useRef(null);
  const controller = useRef(null);
  const allowed = currentUser?.role === "OPERATIONS";
  const load = useCallback(async (index = 0, background = false) => {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    if (!background) setLoading(true); setError("");
    try {
      if (keyword) {
        const systems = collection.current ?? await readCollection("/api/systems/page", { signal: active.signal });
        if (active.signal.aborted) return;
        collection.current = systems;
        setPage(collectionPage(systems.filter(system => nameIncludes(system.name, keyword)), index, 12));
        return;
      }
      const data = await apiJson(`/api/systems/page?page=${index}&size=12`, { signal: active.signal });
      if (active.signal.aborted) return;
      const result = Array.isArray(data) ? { items: data, page: 0, totalPages: data.length ? 1 : 0, totalElements: data.length, first: true, last: true } : data;
      setPage(result);
    } catch (failure) {
      if (active.signal.aborted) return;
      if (failure.status === 401) onSessionExpired?.(); else setError("Unable to load systems. Please try again.");
    } finally { if (!active.signal.aborted) setLoading(false); }
  }, [onSessionExpired, keyword]);
  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  async function saved(system) {
    setFeedback(`${system.name} ${form.system ? "updated" : "created"} successfully.`);
    setForm(null); collection.current = null; await load(page.page, true);
  }
  return <section className="systems-page" aria-labelledby="systems-title">
    <div className="page-heading"><div><p className="section-kicker">Infrastructure inventory</p><h2 id="systems-title">Systems</h2><p className="section-copy">{page.totalElements} {keyword ? "matching" : "registered"} systems · Select a card to investigate.</p></div>
      <div className="row-actions"><button className="button-secondary" disabled={loading} onClick={() => { collection.current = null; load(page.page); }}>Refresh systems</button>
        {allowed && <button onClick={() => setForm({ system: null })}>Add system</button>}</div></div>
    <HeaderTools><form className="collection-search" role="search" aria-label="System search" onSubmit={event => { event.preventDefault(); const next = searchInput.trim(); if (next === keyword) load(0); else setKeyword(next); }}>
      <label htmlFor="system-name-search">Search systems by name</label>
      <div><input id="system-name-search" type="search" placeholder="Enter part of a system name" value={searchInput} onChange={event => setSearchInput(event.target.value)} />
        <button type="submit" className="button-secondary">Search systems</button>
        {(keyword || searchInput) && <button type="button" className="button-secondary" onClick={() => { setSearchInput(""); setKeyword(""); }}>Clear search</button>}</div>
      {keyword && <p className="section-copy">Showing names containing “{keyword}” across all systems.</p>}
    </form></HeaderTools>
    {feedback && <p role="status" className="success-message">{feedback}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {loading ? <p role="status">Loading systems…</p> : !error && <>
      {!page.items.length && <p className="empty-state">{keyword ? `No systems match “${keyword}”.` : "No monitored systems are available yet."}</p>}
      <div className="system-card-grid">{page.items.map(system => <article className="system-card" key={system.id}>
        <button className="system-card-open" onClick={() => setSelected(system)} aria-label={`${system.name} ${system.type} ${system.host} ${system.status}`}>
          <div className="system-card-top"><span className="system-type">{system.type}</span><span className={`system-status status-${system.status.toLowerCase()}`}>{system.status}</span></div>
          <h3>{system.name}</h3><p className="system-host">{system.host}</p>
          <dl className="card-metrics">{[["CPU",system.latestMetric?.cpuUsage,"%"],["Memory",system.latestMetric?.memoryUsage,"%"],["Response",system.latestMetric?.responseTime," ms"]].map(([name,value,unit])=>
            <div key={name}><dt>{name}</dt><dd>{formatMetric(value,unit)}</dd></div>)}</dl>
          <div className="card-measured"><span>{formatTime(system.lastUpdated)}</span></div>
          {system.latestMetric?.availability === false && <span className="cell-detail">Unavailable</span>}
        </button>
        <footer><span>View details <span aria-hidden="true">↗</span></span>{allowed && <button className="button-secondary button-small" aria-label={`Edit ${system.name}`} onClick={() => setForm({ system })}>Edit</button>}</footer>
      </article>)}</div>
      {page.totalPages > 0 && <nav className="pagination" aria-label="System pages"><button className="button-secondary" disabled={page.first} onClick={() => load(page.page-1)}>Previous page</button>
        <span>Page {page.page+1} of {page.totalPages} · {page.totalElements} systems</span><button className="button-secondary" disabled={page.last} onClick={() => load(page.page+1)}>Next page</button></nav>}
    </>}
    {selected && <Modal title={selected.name} onClose={() => setSelected(null)}><SystemDetails system={selected} currentUser={currentUser} onSessionExpired={onSessionExpired} onMetricSubmitted={() => { collection.current = null; return load(page.page,true); }} /></Modal>}
    {form && <Modal title={form.system ? `Edit ${form.system.name}` : "Add system"} onClose={() => setForm(null)}><SystemForm system={form.system} onSaved={saved} onCancel={() => setForm(null)} onSessionExpired={onSessionExpired} /></Modal>}
  </section>;
}
