"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLandingPathForRole } from "../lib/roles";

/**
 * Credential login form. Calls the frontend's own /api/auth/login route
 * (which proxies to the backend), then redirects to the role's landing page.
 */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    let response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setStatus("error");
      setErrorMessage("Unable to reach the server. Please try again.");
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus("error");
      setErrorMessage(data.error || "Unable to sign in. Please try again.");
      return;
    }

    router.push(getLandingPathForRole(data.role));
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Login form">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {status === "error" && (
        <p role="alert" data-testid="login-error">
          {errorMessage}
        </p>
      )}
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
