import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import FloatingAssistant from "./FloatingAssistant";

const AssistantContext = createContext(null);
export function useAssistant() { return useContext(AssistantContext); }

export default function AssistantProvider({ page, currentUser, onSessionExpired, onAlertsChanged, children }) {
  const [reported, setReported] = useState(null);
  const [selected, setSelected] = useState(null);
  const [launch, setLaunch] = useState(null);
  const [host, setHostNode] = useState(null);
  const sequence = useRef(0);
  const setScope = useCallback(scope => { setReported({ page, scope: scope || {} }); setSelected(null); }, [page]);
  const ask = useCallback((scope, question = "") => {
    setSelected({ page, scope: scope || {} });
    setLaunch({ page, sequence: ++sequence.current, question });
  }, [page]);
  const setHost = useCallback(node => setHostNode(node), []);
  const clearSelection = useCallback(() => setSelected(null), []);
  const value = useMemo(() => ({ setScope, ask, setHost }), [setScope, ask, setHost]);
  const selectionActive = selected?.page === page;
  const reportedScope = reported?.page === page ? reported.scope : {};
  const currentScope = selectionActive ? selected.scope : reportedScope;
  const scope = { ...currentScope, page, ...(page === "alerts" ? { archived: Boolean(currentScope.archived ?? reportedScope.archived) } : {}) };
  return <AssistantContext.Provider value={value}>
    {children}
    <FloatingAssistant scope={scope} launch={launch} host={host} currentUser={currentUser} selectionActive={selectionActive} onClearSelection={clearSelection}
      onSessionExpired={onSessionExpired} onAlertsChanged={onAlertsChanged} />
  </AssistantContext.Provider>;
}
