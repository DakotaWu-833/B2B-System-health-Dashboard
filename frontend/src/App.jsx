import { useCallback, useEffect, useState } from "react";
<<<<<<< HEAD
import Dashboard from "./Dashboard";

=======
import Login from "./Login";
>>>>>>> feature/login
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const checkBackend = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/health`, { signal });

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

  const backendOnline = health?.status === "UP";
  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <main className="app-shell">
     <button type="button" onClick={() => setCurrentUser(null)}>
       Logout
     </button>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">ELEC5619 · Sprint 1 foundation</p>
        <h1 id="page-title">B2B System Health Dashboard</h1>
        <p className="hero-copy">
          A shared React and Spring Boot foundation for the team&apos;s monitoring
          dashboard. Feature work should be delivered through reviewed Jira branches.
        </p>
      </section>

      <section className="connection-card" aria-live="polite">
        <div>
          <p className="card-label">Integration check</p>
          <h2>Frontend → Backend</h2>
        </div>

        <span
          className={`status-badge ${backendOnline ? "status-up" : "status-down"}`}
        >
          {isLoading ? "CHECKING" : backendOnline ? "CONNECTED" : "OFFLINE"}
        </span>

        {health && (
          <dl className="health-details">
            <div>
              <dt>Service</dt>
              <dd>{health.service}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{health.status}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{new Date(health.timestamp).toLocaleString()}</dd>
            </div>
          </dl>
        )}

        {error && <p className="error-message">{error}</p>}

        <button type="button" onClick={() => checkBackend()} disabled={isLoading}>
          {isLoading ? "Checking…" : "Check again"}
        </button>
      </section>

      <Dashboard />
    </main>
  );
}

export default App;
