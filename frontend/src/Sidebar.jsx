import { useEffect, useRef, useState } from "react";
import Icon from "./Icons";

const mainEntries = [["dashboard", "Dashboard"], ["system", "System"], ["alerts", "Alert Center"], ["runbooks", "Runbook library"]];
const accountEntries = [["profile", "My profile"], ["retention", "Metric retention"]];

export default function Sidebar({ view, onNavigate, currentUser, onLogout, isLoggingOut, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useRef(null);
  const sidebar = useRef(null);
  const mobileTrigger = useRef(null);
  const username = currentUser?.username || "Account";
  const initials = username.split(/[._\s-]+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const role = currentUser?.role === "OPERATIONS" ? "Operations" : currentUser?.role === "MANAGEMENT" ? "Management" : currentUser?.role;

  useEffect(() => {
    function outside(event) { if (!account.current?.contains(event.target)) setAccountOpen(false); }
    function escape(event) { if (event.key === "Escape") { setAccountOpen(false); onCloseMobile?.(); } }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [onCloseMobile]);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 760px)");
    const resized = event => { if (!event.matches) onCloseMobile?.(); };
    media?.addEventListener?.("change", resized);
    return () => media?.removeEventListener?.("change", resized);
  }, [onCloseMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileTrigger.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector("a")?.focus();
    function trapFocus(event) {
      if (event.key !== "Tab") return;
      const controls = [...sidebar.current.querySelectorAll("a, button:not(:disabled)")].filter(node => node.getClientRects().length);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", trapFocus);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", trapFocus); mobileTrigger.current?.focus(); };
  }, [mobileOpen]);

  const navigate = id => { onNavigate(id); setAccountOpen(false); onCloseMobile?.(); };
  const entry = ([id, label]) => <a key={id} href={`#${id}`} aria-label={label} aria-current={view === id ? "page" : undefined}
    title={collapsed ? label : undefined} onClick={() => navigate(id)}>
    <Icon name={id} /><span className="nav-label">{label}</span><span className="nav-active-dot" />
  </a>;

  return <>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onCloseMobile} />}
    <aside ref={sidebar} id="workspace-sidebar" className={`sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Application sidebar">
      <div className="sidebar-brand-row">
        <a className="sidebar-brand-link" href="#dashboard" aria-label="System Health home" onClick={() => navigate("dashboard")}>
          <span className="brand-symbol" aria-hidden="true"><Icon name="activity" /></span><span className="nav-label">System Health<span className="brand-caption">MONITORING WORKSPACE</span></span>
        </a>
        <button type="button" className="sidebar-mobile-close" aria-label="Close menu" onClick={onCloseMobile}><Icon name="close" /></button>
      </div>
      <nav id="workspace-navigation" aria-label="Primary navigation">
        <p className="sidebar-section-label nav-label">Workspace</p>
        {mainEntries.map(entry)}
        <div className="sidebar-nav-divider" />
        <p className="sidebar-section-label nav-label">Your workspace</p>
        {accountEntries.filter(([id]) => id !== "retention" || currentUser?.role === "OPERATIONS").map(entry)}
      </nav>
      <div className="sidebar-workspace-note"><Icon name="shield" /><span className="nav-label"><strong>A clearer view of your systems</strong><small>Your metrics, alerts and insights in one place.</small></span></div>
      <div ref={account} className="sidebar-account">
        <button className="sidebar-account-trigger" aria-label={`Account menu for ${username}`} aria-expanded={accountOpen} aria-controls="sidebar-account-options" title={collapsed ? username : undefined} onClick={() => setAccountOpen(value => !value)}>
          <span className="sidebar-user-avatar" aria-hidden="true">{initials}</span><span className="nav-label account-label"><strong>{username}</strong><small>{role}</small></span><Icon name={accountOpen ? "collapse" : "expand"} className="account-chevron nav-label" />
        </button>
        {accountOpen && <div id="sidebar-account-options" className="sidebar-account-options" role="group" aria-label="Account options">
          <a href="#profile" onClick={() => navigate("profile")}><Icon name="profile" />Account settings</a>
          <span>{role} workspace</span>
        </div>}
        <button className="sidebar-logout" aria-label={isLoggingOut ? "Logging out…" : "Logout"} title={collapsed ? "Logout" : undefined} disabled={isLoggingOut} onClick={onLogout}><Icon name="logout" /><span className="nav-label">{isLoggingOut ? "Logging out…" : "Logout"}</span></button>
      </div>
      <button className="sidebar-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-navigation" title={collapsed ? "Expand sidebar" : undefined} onClick={onToggleCollapse}><Icon name={collapsed ? "expand" : "collapse"} /><span className="nav-label">Collapse sidebar</span></button>
    </aside>
  </>;
}
