import { useEffect, useState } from "react";
import { apiJson } from "./api";
import { HealthDistribution } from "./Charts";
import { formatMetric, formatTime } from "./metricDisplay";

export default function Dashboard({onSessionExpired,refreshVersion=0}) {
  const [summary,setSummary]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [version,setVersion]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");
    apiJson("/api/dashboard/summary",{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setSummary(data);})
      .catch(failure=>{if(controller.signal.aborted)return;if(failure.status===401)onSessionExpired?.();else setError("Unable to load dashboard data. Please try again.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[onSessionExpired,refreshVersion,version]);
  return <section className="dashboard overview-page" aria-labelledby="overview-title"><div className="page-heading"><div><p className="section-kicker">Fleet snapshot</p><h2 id="overview-title">Overview</h2></div>
    <button className="button-secondary" disabled={loading} onClick={()=>setVersion(value=>value+1)}>Refresh dashboard</button></div>
    {loading&&<p role="status">Loading dashboard data...</p>}{error&&<p role="alert" className="error-message">{error}</p>}
    {summary&&!loading&&!error&&<><div className="overview-grid">{[["Total Systems","total"],["Healthy","healthy"],["Warning","warning"],["Critical","critical"],["Offline","offline"]].map(([label,key])=>
      <article key={key} className={`overview-card overview-${key}`}><h3>{label}</h3><p>{summary[key]}</p><span className="card-subtitle">{key==="total"?"Registered objects":"Stored health status"}</span></article>)}</div>
      <div className="overview-grid metric-kpis" aria-label="Alert and metric overview">{[["Active alerts","activeAlertCount","","alerts"],["Average CPU","averageCpuUsage","%","cpu"],["Average memory","averageMemoryUsage","%","memory"],["Average response time","averageResponseTime"," ms","response"]].map(([label,key,unit,style])=>
        <article key={key} className={`overview-card overview-${style}`}><h3>{label}</h3><p>{formatMetric(summary[key],unit)}</p><span className="card-subtitle">{key==="activeAlertCount"?"Awaiting acknowledgement":"Recent, available latest readings"}</span></article>)}</div>
      <HealthDistribution summary={summary}/><div className="overview-footnote"><p>System health and reading update times are separate. Averages exclude outdated or unavailable readings; No data is different from a measured zero.</p>
        {summary.evaluatedAt&&<p>Evaluated: <time dateTime={summary.evaluatedAt}>{formatTime(summary.evaluatedAt)}</time></p>}</div></>}
  </section>;
}
