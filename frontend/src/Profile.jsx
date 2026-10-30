import { useEffect, useRef, useState } from "react";
import { apiJson, apiMutation } from "./api";

export default function Profile({ onSessionExpired }) {
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    apiJson("/api/profile", { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setProfile(data); setEmail(data.email || ""); }
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure.status === 401) onSessionExpired?.(); else setError(failure.message);
    });
    return () => controller.abort();
  }, [onSessionExpired]);
  useEffect(() => {
    const finishAt = Math.max(resendAt, expiresAt);
    if (finishAt <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now(); setNow(current);
      if (current >= finishAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt, expiresAt]);
  async function action(kind, event) {
    event?.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setFeedback("");
    try {
      if (kind === "save") {
        const data = await apiMutation("/api/profile", "PUT", { email: email.trim() });
        setProfile(data); setEmail(data.email || ""); setCode(""); setExpiresAt(0);
        setFeedback(data.emailVerified ? "Email address saved. Its verification is still valid." : "Email address saved. Verify it to confirm ownership.");
      } else if (kind === "send") {
        const data = await apiMutation("/api/profile/email-verification", "POST");
        setResendAt(new Date(data.resendAt).getTime()); setNow(Date.now()); setCode("");
        setExpiresAt(Date.parse(data.expiresAt) || 0);
        setFeedback("Verification email sent. Check your inbox for the six-digit code.");
      } else {
        const data = await apiMutation("/api/profile/email-verification/confirm", "POST", { code });
        setProfile(data); setCode(""); setExpiresAt(0); setFeedback("Email verified successfully.");
      }
    } catch (failure) {
      if (failure.status === 401) onSessionExpired?.(); else {
        if (failure.status === 429 && failure.retryAfter > 0) {
          const current = Date.now(); setResendAt(current + failure.retryAfter * 1000); setNow(current);
        }
        setError(failure.message);
      }
    } finally { pending.current = false; setBusy(false); }
  }
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return <section className="form-panel profile-panel" id="profile" aria-labelledby="profile-title">
    <h2 id="profile-title">My profile</h2>
    {!profile && !error && <p>Loading profile…</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {feedback && <p role="status" className="success-message">{feedback}</p>}
    {profile && <>
      <dl className="detail-grid"><div><dt>Username</dt><dd>{profile.username}</dd></div>
        <div><dt>Role</dt><dd>{profile.role}</dd></div><div><dt>Email status</dt>
        <dd>{profile.emailVerified ? "Verified" : profile.email ? "Not verified" : "No email address"}</dd></div></dl>
      {profile.emailVerifiedAt && <p>Verified on {new Date(profile.emailVerifiedAt).toLocaleString()}</p>}
      <form className="editor-form" onSubmit={event => action("save", event)}>
        <label>Email address<input type="email" required maxLength={254} value={email} disabled={busy}
          onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>
        <button disabled={busy || email.trim().toLowerCase() === profile.email}>Save email address</button>
      </form>
      {profile.email && !profile.emailVerified && <div className="verification-panel">
        {expiresAt > 0 && <p className="section-copy">{now >= expiresAt ? "This verification code has expired. Request a new code." : <>
          Verification code expires at <time dateTime={new Date(expiresAt).toISOString()}>{new Date(expiresAt).toLocaleString()}</time>.</>}</p>}
        <button type="button" disabled={busy || seconds > 0} onClick={() => action("send")}>{seconds > 0 ? `Resend in ${seconds}s` : "Send verification code"}</button>
        <form className="editor-form" onSubmit={event => action("confirm", event)}>
          <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6}
            value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
          <button disabled={busy || code.length !== 6}>Verify email</button>
        </form>
      </div>}
    </>}
  </section>;
}
