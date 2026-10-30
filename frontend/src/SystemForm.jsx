import { useRef, useState } from "react";
import { apiFetch } from "./api";
import { useModalGuard } from "./Modal";

export default function SystemForm({ system, onSaved, onCancel, onSessionExpired }) {
  const [values, setValues] = useState({
    name: system?.name ?? "", type: system?.type ?? "", host: system?.host ?? "",
    description: system?.description ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const editing = Boolean(system);
  const modal = useModalGuard(Object.entries(values).some(([key, value]) => value !== (system?.[key] ?? "")), isSaving);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const body = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    if (!body.name || !body.type || !body.host) {
      setError("Name, type and host are required.");
      return;
    }
    submitting.current = true;
    setIsSaving(true);
    setError("");
    try {
      const csrfResponse = await apiFetch("/api/auth/csrf");
      if (csrfResponse.status === 401) { onSessionExpired?.(); return; }
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok || !csrf.success) throw new Error(csrf.message || "Unable to prepare the request. Please try again.");
      const response = await apiFetch(editing ? `/api/systems/${system.id}` : "/api/systems", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", [csrf.data.headerName || "X-CSRF-TOKEN"]: csrf.data.token },
        body: JSON.stringify({ ...body, description: body.description || null }),
      });
      if (response.status === 401) { onSessionExpired?.(); return; }
      const result = await response.json();
      if (!response.ok || !result.success) {
        const messages = {
          403: "You do not have permission to save systems. Try signing in again if your session has changed.",
          404: "This system no longer exists. Cancel and refresh the system list.",
          409: "A system with the same name, type and host already exists.",
        };
        throw new Error(messages[response.status] || result.message || "Unable to save the system. Please try again.");
      }
      await onSaved(result.data);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Unable to connect. Check your connection and try again." : requestError.message);
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form className="system-form" onSubmit={handleSubmit} aria-labelledby="system-form-title">
      <h3 id="system-form-title">{editing ? "Edit system" : "Add system"}</h3>
      <p className="section-copy">{editing ? "Update system information. Health status is calculated from metrics." : "Register a monitored system. Measurements will appear once readings are submitted."}</p>
      <fieldset disabled={isSaving}>
        <legend className="visually-hidden">System information</legend>
        <div className="system-form-grid">
          {[ ["name", "Name", 120], ["type", "Type", 50], ["host", "Host", 255] ].map(([key, label, maxLength]) => (
            <label key={key} htmlFor={`system-${key}`}>{label}
              <input id={`system-${key}`} required maxLength={maxLength} value={values[key]}
                onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
            </label>
          ))}
          <label className="system-description" htmlFor="system-description">Description (optional)
            <textarea id="system-description" maxLength={1000} rows={3} value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="row-actions">
          <button type="submit">{isSaving ? "Saving…" : editing ? "Save changes" : "Create system"}</button>
          <button type="button" className="button-secondary" onClick={() => modal ? modal.requestLeave(onCancel) : onCancel()}>Cancel</button>
        </div>
      </fieldset>
    </form>
  );
}
