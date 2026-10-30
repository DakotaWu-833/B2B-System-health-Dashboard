import { useEffect, useRef, useState } from "react";
import { apiJson } from "./api";
import { MetricTrend } from "./Charts";
import { formatMetric, formatTime, readingUpdateLabel } from "./metricDisplay";
import MetricForm from "./MetricForm";
import { useModalNavigation } from "./Modal";

const tabs = [["basic","Basic information"],["history","Recent Metrics"],["submit","Submit a metric reading"]];
const SIZE=10;
export default function SystemDetails({system,currentUser,onSessionExpired,onMetricSubmitted}) {
  const [tab,setTab]=useState("basic");const [details,setDetails]=useState(null);const [error,setError]=useState("");const [reload,setReload]=useState(0);
  const [pages,setPages]=useState([]);const [index,setIndex]=useState(0);const [historyBusy,setHistoryBusy]=useState(false);const [historyError,setHistoryError]=useState("");
  const [range,setRange]=useState({from:"",to:""});const [feedback,setFeedback]=useState("");const historyController=useRef(null);const tabRefs=useRef([]);
  const allowed=currentUser?.role==="OPERATIONS";
  const modal=useModalNavigation();
  const selectTab=id=>{ if(id===tab)return; if(modal)modal.requestLeave(()=>setTab(id));else setTab(id); };
  async function requestHistory(query,pageIndex=0,reset=false) {
    historyController.current?.abort();const controller=new AbortController();historyController.current=controller;setHistoryBusy(true);setHistoryError("");
    try{const data=await apiJson(`/api/systems/${system.id}/metrics/history?${query}`,{signal:controller.signal});if(controller.signal.aborted)return;
      const page=Array.isArray(data)?{items:data.slice(0,SIZE),nextCursor:null}:data;
      setPages(old=>reset?[page]:[...old.slice(0,pageIndex),page]);setIndex(pageIndex);
    }catch(failure){if(controller.signal.aborted)return;if(failure.status===401)onSessionExpired?.();else setHistoryError(failure.message||"Unable to load metric history.");}
    finally{if(!controller.signal.aborted)setHistoryBusy(false);}
  }
  useEffect(()=>{setTab("basic");setFeedback("");setRange({from:"",to:""});},[system?.id]);
  useEffect(()=>{
    if(!system){setDetails(null);return;}
    const controller=new AbortController();setDetails(null);setError("");setPages([]);setIndex(0);setRange({from:"",to:""});
    apiJson(`/api/systems/${system.id}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setDetails(data);})
      .catch(failure=>{if(controller.signal.aborted)return;if(failure.status===401)onSessionExpired?.();else setError(failure.message||"Failed to load system details.");});
    requestHistory(new URLSearchParams({size:String(SIZE)}),0,true);
    return()=>{controller.abort();historyController.current?.abort();};
  },[system?.id,reload,onSessionExpired]);
  async function submitted(reading){setFeedback(`Metric reading ${reading.metricId} submitted successfully.`);setReload(value=>value+1);await onMetricSubmitted?.();}
  function applyRange(event){event.preventDefault();
    try{const from=range.from?new Date(range.from):null;const to=range.to?new Date(range.to):null;
      if((from&&Number.isNaN(from.getTime()))||(to&&Number.isNaN(to.getTime())))throw new Error("Enter valid history dates.");
      if(from&&to&&(from>to||to-from>31*86400000))throw new Error("Choose an ordered history range of no more than 31 days.");
      const query=new URLSearchParams({size:String(SIZE)});if(from)query.set("from",from.toISOString());if(to)query.set("to",to.toISOString());requestHistory(query,0,true);
    }catch(failure){setHistoryError(failure.message);}
  }
  const activePage=pages[index];const metrics=(activePage?.items||[]).slice(0,SIZE);
  function next(){if(pages[index+1])setIndex(index+1);else if(activePage?.nextCursor)requestHistory(new URLSearchParams({size:String(SIZE),cursor:activePage.nextCursor}),index+1);}
  function tabKey(event,position){const enabled=tabs.map(([id],i)=>id!=="submit"||allowed?i:null).filter(i=>i!==null);let next;
    if(event.key==="ArrowRight")next=enabled[(enabled.indexOf(position)+1)%enabled.length];
    if(event.key==="ArrowLeft")next=enabled[(enabled.indexOf(position)+enabled.length-1)%enabled.length];
    if(event.key==="Home")next=enabled[0];if(event.key==="End")next=enabled.at(-1);
    if(next!==undefined){event.preventDefault();selectTab(tabs[next][0]);tabRefs.current[next]?.focus();}
  }
  const outdatedNote = "The latest reading is outside the current update window and may not reflect the system’s health now.";
  const noReadingsNote = "No measurements are available. The stored health status does not confirm measured health.";
  const notes = [...new Set([
    ...(details?.metricDataStatus === "STALE" ? [outdatedNote] : []),
    ...(details?.metricDataStatus === "NO_DATA" ? [noReadingsNote] : []),
    ...(details?.statusReasons || []).map(reason => reason === "Latest metric data is stale" ? outdatedNote : reason === "No metric data is available" ? noReadingsNote : reason),
  ])];
  if(!system)return null;
  return <section className="system-details"><h2 className="visually-hidden">System Details</h2>
    <div className="detail-tabs" role="tablist" aria-label="System detail sections">{tabs.map(([id,label],i)=><button key={id} type="button" role="tab" ref={node=>{tabRefs.current[i]=node;}}
      id={`detail-tab-${id}`} aria-controls={`detail-panel-${id}`} aria-selected={tab===id} tabIndex={tab===id?0:-1} disabled={id==="submit"&&!allowed}
      title={id==="submit"&&!allowed?"Only Operations users can submit readings":undefined} onKeyDown={event=>tabKey(event,i)} onClick={()=>selectTab(id)}>{label}</button>)}</div>
    {feedback&&<p role="status" className="success-message">{feedback}</p>}
    {error?<><p role="alert" className="error-message">{error}</p><button onClick={()=>setReload(value=>value+1)}>Retry system details</button></>:
      !details?<p>Loading system details...</p>:<div role="tabpanel" id={`detail-panel-${tab}`} aria-labelledby={`detail-tab-${tab}`} tabIndex={0} className="detail-tabpanel">
        {tab==="basic"&&<><div className="detail-card-header"><h3>{details.name}</h3><span className={`system-status status-${details.status.toLowerCase()}`}>{details.status}</span></div>
          <dl className="basic-detail-grid">{[["Type",details.type],["Host",details.host],["Reading updates",readingUpdateLabel(details.metricDataStatus)],["Last measured",formatTime(details.latestMetric?.timestamp)],
            ["CPU",formatMetric(details.latestMetric?.cpuUsage,"%")],["Memory",formatMetric(details.latestMetric?.memoryUsage,"%")],["Response time",formatMetric(details.latestMetric?.responseTime," ms")],
            ["Availability",details.latestMetric?details.latestMetric.availability?"Available":"Unavailable":"No data"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="section-copy">{details.description||"No description available."}</p>
          {notes.length > 0 && <div className="permission-note health-notes" aria-label="Reading and health notes">{notes.map(note => <p key={note}>{note}</p>)}</div>}
          <section className="threshold-summary" aria-label="Health threshold rules"><strong>Health thresholds:</strong>{details.evaluatedThresholds ? <>
            <ul className="threshold-values">
              {[["CPU","cpuWarning","cpuCritical","%"],["Memory","memoryWarning","memoryCritical","%"],["Response time","responseTimeWarning","responseTimeCritical"," ms"]].map(([label,warning,critical,unit]) =>
                <li key={label}>{label}: Warning ≥ {formatMetric(details.evaluatedThresholds[warning],unit)}; Critical ≥ {formatMetric(details.evaluatedThresholds[critical],unit)}.</li>)}
            </ul>
            <p>Each new reading is checked in this order; the first matching rule determines system health:</p>
            <ol className="threshold-rules">
              <li><strong>OFFLINE:</strong> Availability is Unavailable, regardless of the other values.</li>
              <li><strong>CRITICAL:</strong> The system is available and any one of CPU, memory or response time reaches or exceeds its Critical threshold.</li>
              <li><strong>WARNING:</strong> The system is available, no Critical threshold is reached, and at least one metric reaches or exceeds its Warning threshold.</li>
              <li><strong>HEALTHY:</strong> The system is available and all three metrics are below their Warning thresholds.</li>
            </ol>
            <p>Equal to the threshold counts as reaching it. Values are checked individually, not averaged. These are current settings; stored health is recalculated when a new reading is submitted. Outdated data alone does not make a system OFFLINE.</p>
          </> : <p>Current configuration is unavailable.</p>}</section>
</>}
        {tab==="submit"&&allowed&&<MetricForm showTitle={false} system={system} onSubmitted={submitted} onSessionExpired={onSessionExpired}/>}
        {tab==="history"&&<><form className="history-controls" onSubmit={applyRange}><label>History from<input type="datetime-local" value={range.from} onChange={event=>setRange({...range,from:event.target.value})}/></label>
          <label>History to<input type="datetime-local" value={range.to} onChange={event=>setRange({...range,to:event.target.value})}/></label><button>Apply history range</button></form>
          <p className="section-copy">Last seven days by default · Up to 31 days per range · 10 readings per page.</p>
          {historyBusy&&<p role="status">Loading history…</p>}{historyError&&<p role="alert" className="error-message">{historyError}</p>}
          {historyError&&<button className="button-secondary" onClick={event=>applyRange({preventDefault:()=>{}})}>Retry history</button>}
          <div className="metric-chart-grid"><MetricTrend title="Resource usage" metrics={metrics} unit="%" maximum={100} series={[{key:"cpuUsage",label:"CPU",color:"var(--chart-cpu)"},{key:"memoryUsage",label:"Memory",color:"var(--chart-memory)"}]}/>
            <MetricTrend title="Response time" metrics={metrics} unit="ms" series={[{key:"responseTime",label:"Response time",color:"var(--chart-response)"}]}/></div>
          <div className="table-wrapper"><table aria-label="Recent metric readings"><thead><tr><th>Time</th><th>CPU</th><th>Memory</th><th>Response Time</th><th>Available</th></tr></thead><tbody>
            {metrics.length?metrics.map(metric=><tr key={metric.metricId}><td>{formatTime(metric.timestamp)}</td><td>{formatMetric(metric.cpuUsage,"%")}</td><td>{formatMetric(metric.memoryUsage,"%")}</td><td>{formatMetric(metric.responseTime," ms")}</td><td>{metric.availability?"Yes":"No"}</td></tr>):!historyBusy&&<tr><td colSpan="5">No recent metrics available.</td></tr>}</tbody></table></div>
          <nav className="pagination" aria-label="Metric history pages"><button className="button-secondary" disabled={index===0||historyBusy} onClick={()=>setIndex(value=>value-1)}>Previous page</button><span>Page {index+1} · {metrics.length} readings</span>
            <button className="button-secondary" disabled={historyBusy||(!pages[index+1]&&!activePage?.nextCursor)} onClick={next}>Next page</button></nav></>}
      </div>}
  </section>;
}
