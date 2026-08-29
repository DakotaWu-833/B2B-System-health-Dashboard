import { useState } from "react";
import { apiFetch } from "./api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

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
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">ELEC5619 · System Health Dashboard</p>

        <h1>Sign in</h1>

        <p>
          Sign in to access the system monitoring dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          {error && <p className="error-message">{error}</p>}

          <button type="submit">Login</button>
        </form>
      </section>
    </main>
  );
}

export default Login;
