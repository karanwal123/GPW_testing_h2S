import React, { useState } from "react";
import { ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import { trackLogin } from "./analytics";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const validatePassword = (pass) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return (
      pass.length >= minLength &&
      hasUpper &&
      hasLower &&
      hasNumber &&
      hasSpecial
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!validatePassword(password)) {
      setError(
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      );
      return;
    }
    setError("");
    trackLogin(username.trim());
    onLogin(username.trim());
  };

  return (
    <div className="login-card-wrap">
      <div className="login-brand-block">
        <div className="login-brand-icon" aria-hidden="true">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to your Election Assistant</p>
      </div>

      <div className="login-card">
        <form onSubmit={handleSubmit} className="login-form" aria-label="Sign in form">
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              placeholder="e.g. aditya"
              autoComplete="username"
              aria-invalid={Boolean(error) && !username.trim()}
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">
              Password
            </label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input login-password-input"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-describedby="password-help"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="login-password-toggle"
                aria-label={showPass ? "Hide password" : "Show password"}
                aria-pressed={showPass}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p id="password-help" className="login-help">
              Use any strong password that meets the on-screen requirements.
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert" aria-live="polite">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="login-submit">
            <span>Continue</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      <p className="login-footnote">
        Powered by Vertex AI &middot; Google Cloud
      </p>
    </div>
  );
}
