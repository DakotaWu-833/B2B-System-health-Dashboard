import { useEffect, useRef, useState } from "react";
import { apiJson, apiMutation } from "./api";
import Icon from "./Icons";

export default function Profile({ onSessionExpired }) {
  const [profile, setProfile] = useState(null);
  const [loadVersion, setLoadVersion] = useState(0);
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
    setError("");
    apiJson("/api/profile", { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setProfile(data); setEmail(data.email || ""); }
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure.status === 401) onSessionExpired?.(); else setError(failure instanceof TypeError ? "Unable to load your profile. Check your connection and try again." : failure.message);
    });
    return () => controller.abort();
  }, [onSessionExpired, loadVersion]);
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
  const initials = (profile?.username || "").split(/[._\s-]+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const emailStatus = profile?.emailVerified ? "Verified" : profile?.email ? "Not verified" : "No email address";
  return <section className="profile-panel profile-page" id="profile" aria-labelledby="profile-title">
    <div className="page-heading profile-heading"><div><p className="section-kicker">YOUR ACCOUNT</p><h2 id="profile-title">My profile</h2><p className="section-description">Your workspace identity and a little peace of mind.</p></div><span className="profile-heading__label"><Icon name="profile" />Personal settings</span></div>
    {!profile && !error && <div className="state-message" role="status"><span className="spinner" aria-hidden="true" />Loading profile…</div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {!profile && error && <button className="button-secondary" type="button" onClick={() => setLoadVersion(value => value + 1)}>Retry profile</button>}
    {feedback && <p role="status" className="success-message">{feedback}</p>}
    {profile && <>
      <section className="profile-identity" aria-labelledby="profile-identity-heading">
        <div className="profile-identity__cover" aria-hidden="true"><span>Your own corner of the workspace.</span><div className="profile-identity__orbits"><i /><i /><i /></div><span className="profile-identity__wordmark">SYSTEM HEALTH</span></div>
        <div className="profile-identity__body"><div className="profile-avatar"><span className="profile-avatar__image" aria-hidden="true">{initials}</span></div>
          <div className="profile-identity__details"><span className="profile-identity__label">Your account</span><h3 id="profile-identity-heading">{profile.username}</h3><p>{profile.email || "Add an email address below to complete your account."}</p></div>
          <span className="profile-role-tag"><Icon name="shield" />{profile.role === "OPERATIONS" ? "Operations workspace" : profile.role === "MANAGEMENT" ? "Management workspace" : profile.role}</span>
        </div>
      </section>
      <div className="profile-layout">
        <section className="profile-card" aria-labelledby="profile-details-heading">
          <header className="profile-section-heading"><span className="profile-section-icon"><Icon name="profile" /></span><div><h3 id="profile-details-heading">Account details</h3><p>A familiar identity for your everyday work.</p></div></header>
          <dl className="profile-details-grid"><div><dt>Username</dt><dd>{profile.username}</dd></div><div><dt>Role</dt><dd>{profile.role}</dd></div></dl>
          <form className="editor-form profile-email-form" onSubmit={event => action("save", event)} aria-busy={busy}>
            <label>Email address<input type="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} autoComplete="email" aria-describedby="profile-email-hint" placeholder="you@organisation.com" /></label>
            <p id="profile-email-hint" className="profile-field-note">Save your email address, then verify it to confirm that it belongs to you.</p>
            <div className="profile-form-actions"><button disabled={busy || email.trim().toLowerCase() === profile.email}>Save email address</button></div>
          </form>
        </section>
        <section className="profile-card profile-verification-card" aria-labelledby="profile-security-heading">
          <header className="profile-section-heading"><span className="profile-section-icon profile-section-icon--mint"><Icon name="shield" /></span><div><h3 id="profile-security-heading">Email verification</h3><p>A simple check to confirm it is you.</p></div></header>
          <dl className="profile-email-status"><div><dt>Email status</dt><dd><span className={`status-badge ${profile.emailVerified ? "status-healthy" : profile.email ? "status-warning" : "status-offline"}`}>{emailStatus}</span></dd></div></dl>
          {profile.emailVerifiedAt && <p className="profile-field-note">Verified on {new Date(profile.emailVerifiedAt).toLocaleString()}</p>}
          {!profile.email && <p className="profile-field-note">Add and save an email address to start verification.</p>}
          {profile.emailVerified && <p className="profile-verification-complete"><Icon name="check" />Your email address is verified and ready to use.</p>}
          {profile.email && !profile.emailVerified && <div className="verification-panel">
            <p className="profile-field-note">We will send a six-digit code to your saved email address.</p>
            {expiresAt > 0 && <p className="section-copy">{now >= expiresAt ? "This verification code has expired. Request a new code." : <>
              Verification code expires at <time dateTime={new Date(expiresAt).toISOString()}>{new Date(expiresAt).toLocaleString()}</time>.</>}</p>}
            <button type="button" className="button-secondary" disabled={busy || seconds > 0} onClick={() => action("send")}>{seconds > 0 ? `Resend in ${seconds}s` : "Send verification code"}</button>
            <form className="editor-form profile-code-form" onSubmit={event => action("confirm", event)} aria-busy={busy}>
              <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
              <button disabled={busy || code.length !== 6}>Verify email</button>
            </form>
          </div>}
        </section>
      </div>
    </>}
  </section>;
}
