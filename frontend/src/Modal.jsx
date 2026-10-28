import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (node.showModal) node.showModal(); else node.setAttribute("open", "");
    return () => { if (node.close) node.close(); document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="workspace-modal" aria-labelledby="modal-title"
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-surface"><header className="modal-header"><div><p className="section-kicker">System workspace</p><h2 id="modal-title">{title}</h2></div>
      <button type="button" className="icon-button" aria-label="Close system dialog" onClick={onClose} autoFocus>×</button></header>
      <div className="modal-content">{children}</div></div>
  </dialog>, document.body);
}
