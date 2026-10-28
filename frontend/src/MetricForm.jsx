import { useRef, useState } from "react";
import { apiFetch } from "./api";

export default function MetricForm({ system, onSubmitted, onSessionExpired, showTitle = true }) {
  const [values, setValues] = useState({ cpuUsage: "", memoryUsage: "", responseTime: "", availability: "true" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const body = {
      cpuUsage: Number(values.cpuUsage), memoryUsage: Number(values.memoryUsage),
      responseTime: Number(values.responseTime), availability: values.availability === "true",
    };
    if (["cpuUsage", "memoryUsage", "responseTime"].some((key) => values[key].trim() === "") ||
      !Number.isFinite(body.cpuUsage) || body.cpuUsage < 0 || body.cpuUsage > 100 ||
      !Number.isFinite(body.memoryUsage) || body.memoryUsage < 0 || body.memoryUsage > 100 ||
      !Number.isSafeInteger(body.responseTime) || body.responseTime < 0) {
      setError("Enter CPU and memory between 0 and 100%, and a non-negative whole number for response time.");
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      const csrfResponse = await apiFetch("/api/auth/csrf");
      if (csrfResponse.status === 401) { onSessionExpired?.(); return; }
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || !csrf.success || !csrf.data?.token) throw new Error("Unable to prepare the request. Please try again.");
      const response = await apiFetch(`/api/systems/${system.id}/metrics`, {
        method: "POST", headers: { "Content-Type": "application/json", [csrf.data.headerName || "X-CSRF-TOKEN"]: csrf.data.token },
        body: JSON.stringify(body),
      });
      if (response.status === 401) { onSessionExpired?.(); return; }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(response.status === 403 ? "Only Operations users can submit readings. Sign in again if your session has changed." :
          response.status === 404 ? "This system no longer exists. Refresh the dashboard." :
          result.message || "Unable to submit the reading. Please try again.");
      }
      await onSubmitted(result.data);
      setValues({ cpuUsage: "", memoryUsage: "", responseTime: "", availability: "true" });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Unable to connect. Your reading has not been confirmed; check your connection before retrying." : requestError.message);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return <form className="system-form metric-form" onSubmit={handleSubmit} aria-labelledby={showTitle ? "metric-form-title" : "detail-tab-submit"}>
    {showTitle && <h3 id="metric-form-title">Submit a metric reading</h3>}
    <p className="section-copy">Record a manual observation for {system.name}. Saving updates system health and may generate alerts. The server records the measurement time.</p>
    <fieldset disabled={isSubmitting}>
      <legend className="visually-hidden">Metric reading</legend>
      <div className="system-form-grid">
        {[["cpuUsage", "CPU usage (%)", 100, "0.01"], ["memoryUsage", "Memory usage (%)", 100, "0.01"],
          ["responseTime", "Response time (ms)", Number.MAX_SAFE_INTEGER, "1"]].map(([key, label, max, step]) =>
          <label key={key} htmlFor={`metric-${key}`}>{label}
            <input id={`metric-${key}`} type="number" required min="0" max={max} step={step} value={values[key]}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
          </label>)}
        <label htmlFor="metric-availability">Availability
          <select id="metric-availability" value={values.availability} onChange={(event) => setValues({ ...values, availability: event.target.value })}>
            <option value="true">Available</option><option value="false">Unavailable</option>
          </select>
        </label>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button type="submit">{isSubmitting ? "Submitting reading…" : "Submit reading"}</button>
    </fieldset>
  </form>;
}
