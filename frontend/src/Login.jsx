import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    // Temporary mock login.
    // Replace this with the real backend authentication API later.
    if (username === "admin" && password === "admin123") {
      onLogin(username);
    } else {
      setError("Invalid username or password.");
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