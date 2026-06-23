"use client";

import { Lock, UserRound } from "lucide-react";
import { useState } from "react";

export function LoginForm() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account, password })
      });
      if (!response.ok) {
        setError("Invalid account or password");
        return;
      }
      window.location.href = "/projects";
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-page flex min-h-screen items-center justify-center px-6 py-16">
      <form
        onSubmit={submit}
        className="app-panel w-full max-w-md rounded-2xl p-6"
      >
        <div className="mb-6">
          <p className="text-sm font-semibold text-[var(--app-blue)]">
            {process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Showroom"}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--app-ink)]">
            Sign In
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            Access the internal Round 1 project workspace.
          </p>
        </div>

        <label className="block text-sm font-semibold text-[var(--app-ink)]">
          Account
          <span className="mt-2 flex h-12 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 transition focus-within:border-[rgba(0,113,227,0.72)] focus-within:ring-4 focus-within:ring-[rgba(0,113,227,0.12)]">
            <UserRound className="h-5 w-5 text-[var(--app-muted)]" aria-hidden />
            <input
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[var(--app-quiet)]"
              type="text"
              placeholder="Enter your account"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
            />
          </span>
        </label>

        <label className="mt-5 block text-sm font-semibold text-[var(--app-ink)]">
          Password
          <span className="mt-2 flex h-12 items-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 transition focus-within:border-[rgba(0,113,227,0.72)] focus-within:ring-4 focus-within:ring-[rgba(0,113,227,0.12)]">
            <Lock className="h-5 w-5 text-[var(--app-muted)]" aria-hidden />
            <input
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[var(--app-quiet)]"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </span>
        </label>

        <div className="mt-5">
          <label className="custom-checkbox text-sm">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span className="checkmark" />
            <span>Remember me</span>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-[var(--app-red-soft)] px-3 py-2 text-sm text-[var(--app-red)]">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="uiverse-fill-button mt-6 h-12 w-full px-5"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
