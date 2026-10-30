import { useRef, useState } from "react";
import { apiFetch } from "./api";
import Icon from "./Icons";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submissionInProgress.current) return;
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    try {
      const csrfResponse = await apiFetch("/api/auth/csrf");

      const csrfResult = await csrfResponse.json();

      if (!csrfResponse.ok || !csrfResult.success) {
        throw new Error("Failed to get CSRF token.");
      }

      const token = csrfResult.data.token;

      const loginResponse = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const loginResult = await loginResponse.json();

      if (!loginResponse.ok || !loginResult.success) {
        setError(loginResult.message || "Invalid username or password.");
        return;
      }

      onLogin(loginResult.data);
    } catch (error) {
      console.error("Login failed:", error);
      setError("Unable to connect to the authentication service.");
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-topbar"><a href="#" aria-label="System Health"><span className="brand-symbol" aria-hidden="true"><Icon name="activity" /></span>System Health</a><span>Your monitoring workspace</span></header>
      <div className="login-layout">
        <section className="login-form-wrap" aria-labelledby="login-title">
          <div className="login-card">
            <span className="login-brand" aria-hidden="true"><Icon name="shield" /></span>
            <p className="eyebrow">WELCOME BACK</p>
            <h1 id="login-title">Sign in</h1>
            <p className="login-copy">Your systems. Your workspace. All in one place.</p>
            <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <label htmlFor="username">Username</label>
              <input id="username" type="text" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your username" disabled={isSubmitting} />
              <label htmlFor="password">Password</label>
              <div className="login-password-field">
                <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" disabled={isSubmitting} />
                <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? "eyeOff" : "eye"} /></button>
              </div>
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="spinner" aria-hidden="true" />Signing in…</> : <>Login<Icon name="arrow" /></>}</button>
            </form>
            <p className="login-help"><Icon name="shield" />Use the account provided by your organisation.</p>
          </div>
          <p className="login-footer">System Health Dashboard · ELEC5619</p>
        </section>
      </div>
    </main>
  );
}

export default Login;
