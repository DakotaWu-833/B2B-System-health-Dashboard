import { useEffect, useRef, useState } from "react";
const entries = [
  ["dashboard", "Dashboard", "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"],
  ["system", "System", "M3 3h18v7H3z M3 14h18v7H3z M7 6h1 M7 17h1 M12 6h5 M12 17h5"],
  ["alerts", "Alert Center", "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4"],
  ["profile", "My profile", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2"],
  ["retention", "Metric retention", "M3 3h18v5H3z M5 8v13h14V8 M9 12h6"],
];

export default function Sidebar({ view, onNavigate, currentUser, onLogout, isLoggingOut }) {
  const [hovered, setHovered] = useState(false);
  const [touchExpanded, setTouchExpanded] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const sidebar = useRef(null);
  const account = useRef(null);
  const open = touchExpanded || hovered || accountOpen;
  const username = currentUser?.username || "Account";
  const initials = username.split(/[._\s-]+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function close() {
    setTouchExpanded(false);
    setAccountOpen(false);
    setHovered(false);
  }

  useEffect(() => {
    function outside(event) {
      if (!sidebar.current?.contains(event.target)) close();
      else if (!account.current?.contains(event.target)) setAccountOpen(false);
    }
    function escape(event) { if (event.key === "Escape") close(); }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return <>
    {(touchExpanded || accountOpen) && <button className="sidebar-scrim" aria-label="Close navigation" onClick={close} />}
    <aside ref={sidebar} className={`sidebar ${open ? "is-expanded" : ""}`} aria-label="Application sidebar"
      onPointerEnter={event => { if (event.pointerType === "mouse" && window.matchMedia?.("(hover: hover)").matches) setHovered(true); }}
      onPointerLeave={event => { if (event.pointerType === "mouse") close(); }}>
      <div ref={account} className="sidebar-account">
        <button className="sidebar-toggle" aria-label={`Account menu for ${username}`} aria-expanded={accountOpen} aria-controls="sidebar-account-options"
          onClick={() => { setAccountOpen(value => !value); if (!window.matchMedia?.("(hover: hover)").matches) setTouchExpanded(true); }}>
          <span className="sidebar-brand" aria-hidden="true">{initials}</span>
          <span className="nav-label account-label"><strong>{username}</strong><small>{currentUser?.role}</small></span>
        </button>
        {accountOpen && <div id="sidebar-account-options" className="sidebar-account-options" role="group" aria-label="Account options">
          <button className="button-secondary" disabled={isLoggingOut} onClick={onLogout}>{isLoggingOut ? "Logging out…" : "Logout"}</button>
        </div>}
      </div>
      <nav id="workspace-navigation" aria-label="Primary navigation">
        {entries.filter(([id]) => id !== "retention" || currentUser?.role === "OPERATIONS").map(([id, label, path]) =>
          <a key={id} href={`#${id}`} aria-label={label} aria-current={view === id ? "page" : undefined}
            title={label} onClick={() => { onNavigate(id); close(); }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
            <span className="nav-label">{label}</span><span className="nav-active-dot" />
          </a>)}
      </nav>
      <div className="sidebar-footer"><span className="sidebar-online-dot" /><span className="nav-label">Monitoring workspace</span></div>
    </aside>
  </>;
}
