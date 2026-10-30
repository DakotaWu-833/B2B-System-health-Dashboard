import { useEffect, useRef, useState } from "react";

export default function ConnectionStatus({ health, isLoading, error, onCheck }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);

  useEffect(() => {
    function outside(event) { if (!container.current?.contains(event.target)) setOpen(false); }
    function escape(event) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return <div ref={container} className="connection-disclosure">
    <button className="connection-trigger" aria-expanded={open} aria-controls="connection-panel" onClick={() => setOpen(value => !value)}>
      <span className={`connection-dot ${health?.status === "UP" ? "is-online" : ""}`} />
      {isLoading ? "Checking connection…" : health?.status === "UP" ? "Backend connected" : "Backend unavailable"}
    </button>
    {open && <div className="connection-detail" id="connection-panel" role="region" aria-label="Backend connection details">
      <p>{health?.service || "No backend response"}</p>
      {health?.timestamp && <p>Checked {new Date(health.timestamp).toLocaleString()}</p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      <button className="button-secondary button-small" disabled={isLoading} onClick={onCheck}>Check again</button>
    </div>}
  </div>;
}
