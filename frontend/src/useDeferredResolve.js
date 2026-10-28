import { useEffect, useRef, useState } from "react";
import { apiMutation } from "./api";

// The API has no reopen operation. Undo cancels a scheduled write before it is sent.
export default function useDeferredResolve(currentUser, onSessionExpired, onCommitted) {
  const [pending,setPending]=useState(null);const [message,setMessage]=useState("");const [error,setError]=useState("");
  const [now,setNow]=useState(Date.now());const active=useRef(null);const latest=useRef({onSessionExpired,onCommitted});
  latest.current={onSessionExpired,onCommitted};
  function cancel(){if(!active.current||active.current.sending)return;const old=active.current;clearTimeout(old.timer);active.current=null;setPending(null);setMessage(`Resolution cancelled. ${old.alert.systemName} alert remains ${old.alert.status}.`);}
  useEffect(()=>{
    if(currentUser)return;
    if(active.current)clearTimeout(active.current.timer);active.current=null;setPending(null);setMessage("");setError("");
  },[currentUser]);
  useEffect(()=>()=>{if(active.current)clearTimeout(active.current.timer);active.current=null;},[]);
  useEffect(()=>{if(!pending||pending.sending)return;const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[pending]);
  function schedule(alert){
    if(active.current)return;setError("");setMessage("");const item={alert,deadline:Date.now()+10000,sending:false};
    active.current=item;setNow(Date.now());setPending({...item});
    item.timer=setTimeout(async()=>{
      if(active.current!==item)return;item.sending=true;setPending({...item});
      try{await apiMutation(`/api/alerts/${alert.alertId}/resolve`,"PATCH");if(active.current!==item)return;
        setMessage(`${alert.systemName} alert resolved successfully.`);latest.current.onCommitted?.();
      }catch(failure){if(active.current!==item)return;if(failure.status===401)latest.current.onSessionExpired?.();
        else setError(failure.status===409?"The alert changed on the server. Refresh alerts to see its current status.":"Resolution was not confirmed. Refresh alerts before retrying.");
      }finally{if(active.current===item){active.current=null;setPending(null);}}
    },10000);
  }
  return {pending,schedule,cancel,message,error,seconds:pending?Math.max(0,Math.ceil((pending.deadline-now)/1000)):0,
    dismiss:()=>{setMessage("");setError("");}};
}
