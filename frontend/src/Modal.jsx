import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ModalContext = createContext(null);
export function useModalNavigation() { return useContext(ModalContext); }
export function useModalGuard(dirty, busy) {
  const context = useContext(ModalContext);
  const setGuard = context?.setGuard;
  useEffect(() => {
    setGuard?.({ dirty, busy });
    return () => setGuard?.({ dirty: false, busy: false });
  }, [setGuard, dirty, busy]);
  return context;
}

export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  const timer = useRef(null);
  const keepEditing = useRef(null);
  const draftFocus = useRef(null);
  const [guard, setGuard] = useState({ dirty: false, busy: false });
  const [leaving, setLeaving] = useState(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (node.showModal) node.showModal(); else node.setAttribute("open", "");
    return () => { clearTimeout(timer.current); if (node.close) node.close(); document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, []);
  useEffect(() => { if (leaving) keepEditing.current?.focus(); }, [leaving]);
  function finishClose() {
    if (closing) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    setClosing(true); timer.current = setTimeout(onClose, 180);
  }
  function requestLeave(action = finishClose) {
    if (guard.busy || closing) return;
    if (guard.dirty) { draftFocus.current = document.activeElement; setLeaving(() => action); } else action();
  }
  function keepDraft() { setLeaving(null); draftFocus.current?.focus(); }
  const context = useMemo(() => ({ setGuard, requestLeave }), [guard, closing]);
  return createPortal(<dialog ref={dialog} className={`workspace-modal${closing ? " is-closing" : ""}`} aria-labelledby="modal-title"
    onCancel={event => { event.preventDefault(); if (guard.busy) return; if (leaving) keepDraft(); else requestLeave(); }}
    onClick={event => { if (event.target === event.currentTarget) requestLeave(); }}>
    <ModalContext.Provider value={context}><div className="modal-surface"><header className="modal-header"><div><p className="section-kicker">System workspace</p><h2 id="modal-title">{title}</h2></div>
      <button type="button" className="icon-button" aria-label="Close system dialog" disabled={guard.busy || closing} onClick={() => requestLeave()} autoFocus>×</button></header>
      <div className="modal-content">
        {leaving && <div className="modal-discard" role="group" aria-labelledby="discard-title"><h3 id="discard-title">Discard unsaved changes?</h3><p>Your changes have not been saved. Keep editing to finish your work.</p><div className="row-actions"><button ref={keepEditing} type="button" disabled={guard.busy} onClick={keepDraft}>Keep editing</button><button type="button" className="button-secondary" disabled={guard.busy} onClick={() => { if (guard.busy) return; const action = leaving; setLeaving(null); action(); }}>Discard changes</button></div></div>}
        {guard.busy && <p className="modal-working" role="status">Saving your changes. Please keep this window open.</p>}
        {children}
      </div></div></ModalContext.Provider>
  </dialog>, document.body);
}
