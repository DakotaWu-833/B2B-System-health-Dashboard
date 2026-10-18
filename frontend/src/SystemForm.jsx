import { useRef, useState } from "react";
import { apiMutation } from "./api";

export default function SystemForm({ system, onSaved, onCancel, onSessionExpired }) {
  const [values, setValues] = useState({ name: system?.name || "", type: system?.type || "SERVICE", host: system?.host || "", description: system?.description || "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await apiMutation(system ? `/api/systems/${system.id}` : "/api/systems", system ? "PUT" : "POST", values);
      await onSaved(result);
    } catch (failure) {
      if (failure.status === 401) onSessionExpired?.();
      else setError(failure.message);
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className="form-panel" aria-labelledby="system-form-title">
    <h3 id="system-form-title">{system ? "Edit system" : "Add system"}</h3>
    <form onSubmit={submit} className="editor-form">
      {[ ["name", "System name", 120], ["type", "System type", 50], ["host", "Host or identifier", 255] ].map(([field, label, max]) =>
        <label key={field}>{label}<input required maxLength={max} value={values[field]} disabled={busy}
          onChange={event => setValues({ ...values, [field]: event.target.value })} /></label>)}
      <label>Description<textarea maxLength={1000} value={values.description} disabled={busy}
        onChange={event => setValues({ ...values, description: event.target.value })} /></label>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="row-actions"><button disabled={busy}>{busy ? "Saving…" : "Save system"}</button>
        <button className="button-secondary" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
    </form>
  </section>;
}
