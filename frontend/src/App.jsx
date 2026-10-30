import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Login from "./Login";
import Profile from "./Profile";
import MetricRetention from "./MetricRetention";
import Sidebar from "./Sidebar";
import ConnectionStatus from "./ConnectionStatus";
import SystemsPage from "./SystemsPage";
import AlertsPage from "./AlertsPage";
import useDeferredResolve from "./useDeferredResolve";
import { apiFetch } from "./api";
import { HeaderToolsProvider } from "./HeaderTools";
import Icon from "./Icons";

const pageNames = { dashboard: "Dashboard", system: "System", alerts: "Alert Center", profile: "My profile", retention: "Metric retention" };
function routeFromHash() { const hash = window.location.hash.slice(1); return ({ "alert-center-title": "alerts", "metric-retention": "retention" })[hash] || (pageNames[hash] ? hash : "dashboard"); }

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const [view, setView] = useState(() => routeFromHash());
  const [headerTarget, setHeaderTarget] = useState(null);
  const [alertVersion, setAlertVersion] = useState(0);
  useEffect(() => { const changed = () => setView(routeFromHash()); window.addEventListener("hashchange", changed); return () => window.removeEventListener("hashchange", changed); }, []);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutInProgress = useRef(false);

  const checkBackend = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/health", { signal });

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      setHealth(payload.data);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setHealth(null);
        setError("Backend is not reachable. Start Spring Boot and try again.");
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkBackend(controller.signal);
    return () => controller.abort();
  }, [checkBackend]);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const result = await response.json();
        return result.success ? result.data : null;
      })
      .then((user) => {
        setCurrentUser(user);
      })
      .catch((requestError) => {
        console.error("Failed to restore session:", requestError);
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const handleSessionExpired = useCallback(() => {
    setLogoutError("");
    setCurrentUser(null);
    setView("dashboard");
  }, []);

  async function handleLogout() {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      const csrfResponse = await apiFetch("/api/auth/csrf");

      if (csrfResponse.status === 401) { handleSessionExpired(); return; }

      if (!csrfResponse.ok) {
        throw new Error(`Failed to get CSRF token: HTTP ${csrfResponse.status}`);
      }

      const csrfResult = await csrfResponse.json();
      if (!csrfResult.success || !csrfResult.data?.token) throw new Error("CSRF token unavailable");

      const logoutResponse = await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: {
          [csrfResult.data.headerName || "X-CSRF-TOKEN"]: csrfResult.data.token,
        },
      });

      if (logoutResponse.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!logoutResponse.ok) {
        throw new Error(`Logout failed with HTTP ${logoutResponse.status}`);
      }

      const logoutResult = await logoutResponse.json();
      if (!logoutResult.success) throw new Error("Logout was not confirmed");

      handleSessionExpired();
    } catch (requestError) {
      console.error("Logout failed:", requestError);
      setLogoutError("Unable to log out. Check your connection and try Logout again.");
    } finally {
      logoutInProgress.current = false;
      setIsLoggingOut(false);
    }
  }

  const resolution = useDeferredResolve(currentUser, handleSessionExpired, () => setAlertVersion(version => version + 1));
  const navigate = id => { setView(id); };
  if (authLoading) return <main className="startup-message" role="status"><span className="brand-symbol" aria-hidden="true"><Icon name="activity" /></span><span className="spinner" aria-hidden="true" /><p>Checking session...</p></main>;
  if (!currentUser) return <Login onLogin={user => { setLogoutError(""); setCurrentUser(user); setView("dashboard"); window.location.hash = "dashboard"; }} />;

  return <div className={`workspace-layout${collapsed ? " is-nav-collapsed" : ""}`}>
    <a className="skip-link" href="#workspace-main" onClick={event => { event.preventDefault(); document.getElementById("workspace-main")?.focus(); }}>Skip to main content</a>
    <Sidebar view={view} currentUser={currentUser} onNavigate={navigate} onLogout={handleLogout} isLoggingOut={isLoggingOut}
      collapsed={collapsed} onToggleCollapse={() => setCollapsed(value => !value)} mobileOpen={mobileOpen} onCloseMobile={closeMobile} />
    <div className="workspace-frame"><header className="workspace-header"><div className="workspace-header-leading">
      <button type="button" className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-sidebar" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
      <div className="workspace-header-title"><p className="workspace-breadcrumb">Workspace <span aria-hidden="true">/</span> <span>{pageNames[view]}</span></p><h1>{pageNames[view]}</h1></div>
      </div><div className="workspace-header-tools" ref={setHeaderTarget} /></header>
      <HeaderToolsProvider value={headerTarget}><main className="workspace-main" id="workspace-main" tabIndex={-1}>
        {logoutError&&<p className="error-message" role="alert">{logoutError}</p>}
        {view === "dashboard" && <><div className="workspace-intro"><p>A little clarity for your everyday operations.</p><ConnectionStatus health={health} isLoading={isLoading} error={error} onCheck={()=>checkBackend()} /></div><Dashboard onSessionExpired={handleSessionExpired} refreshVersion={alertVersion} /></>}
        {view === "system" && <SystemsPage currentUser={currentUser} onSessionExpired={handleSessionExpired} />}
        {view === "alerts" && <AlertsPage currentUser={currentUser} onSessionExpired={handleSessionExpired} refreshVersion={alertVersion}
          onAlertsChanged={()=>setAlertVersion(version=>version+1)} onResolveRequested={resolution.schedule} pendingResolution={resolution.pending} />}
        {view === "profile" && <Profile onSessionExpired={handleSessionExpired} />}
        {view === "retention" && <MetricRetention currentUser={currentUser} onSessionExpired={handleSessionExpired} />}
      </main></HeaderToolsProvider>
    </div>
    {(resolution.pending||resolution.message||resolution.error)&&<aside className="resolution-toast" aria-label="Alert resolution notification">
      {resolution.pending ? <><div role="status"><strong>{resolution.pending.sending?"Saving resolution…":`Resolve ${resolution.pending.alert.systemName}?`}</strong>
        <p>{resolution.pending.sending?"Waiting for the server. This action can no longer be cancelled.":`Scheduled in ${resolution.seconds}s. The original ${resolution.pending.alert.status} state is unchanged until then.`}</p></div>
        {!resolution.pending.sending&&<button className="button-secondary" onClick={resolution.cancel}>Undo resolve</button>}</>:
        <><p role={resolution.error?"alert":"status"}>{resolution.error||resolution.message}</p><button className="button-secondary button-small" onClick={resolution.dismiss}>Dismiss</button></>}
    </aside>}
  </div>;
}
export default App;
