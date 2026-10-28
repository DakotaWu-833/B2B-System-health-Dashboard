import { useCallback, useEffect, useRef, useState } from "react";
import AlertCenter from "./AlertCenter";
import { apiJson } from "./api";

export default function AlertsPage(props) {
  const [systems,setSystems]=useState([]); const [page,setPage]=useState(0); const [more,setMore]=useState(false);
  const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const controller=useRef(null);
  const load=useCallback(async(index=0)=>{
    controller.current?.abort();const active=new AbortController();controller.current=active;setLoading(true);setError("");
    try{const result=await apiJson(`/api/systems/page?page=${index}&size=100`,{signal:active.signal});if(active.signal.aborted)return;
      const items=Array.isArray(result)?result:result.items;setSystems(old=>index===0?items:[...new Map([...old,...items].map(s=>[s.id,s])).values()]);setMore(!Array.isArray(result)&&!result.last);setPage(index);
    }catch(failure){if(active.signal.aborted)return;if(failure.status===401)props.onSessionExpired?.();else setError("Unable to load system filter options. Retry below.");}
    finally{if(!active.signal.aborted)setLoading(false);}
  },[props.onSessionExpired]);
  useEffect(()=>{load();return()=>controller.current?.abort();},[load]);
  return <AlertCenter {...props} systems={systems} systemsLoading={loading} systemsError={error}
    hasMoreSystems={more||Boolean(error)} onLoadMoreSystems={()=>load(error?page:page+1)} />;
}
