"use client";

import { useState } from "react";
import SignInForm from "@/components/ui/sign-in-form";

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
        body: JSON.stringify({ account: account.trim(), password })
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
      <div className="w-full max-w-md">
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
        <SignInForm
          account={account}
          password={password}
          remember={remember}
          busy={busy}
          error={
            error ? (
              <p className="rounded-lg bg-[var(--app-red-soft)] px-3 py-2 text-sm text-[var(--app-red)]">
                {error}
              </p>
            ) : null
          }
          onAccountChange={setAccount}
          onPasswordChange={setPassword}
          onRememberChange={setRemember}
          onSubmit={submit}
        />
      </div>
    </main>
  );
}
