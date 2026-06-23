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
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col justify-center gap-12 px-6 py-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-16">
        <section className="relative hidden lg:block">
          <h1
            className="max-w-[560px] text-[56px] font-bold leading-[1.05] text-[#1d1d1f] xl:text-[72px]"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            Make the quote ready
          </h1>
          <p className="mt-6 max-w-[430px] text-[17px] leading-[25px] text-[#6e6e73]">
            Internal Round 1 workspace for sales, design handoff, snapshots and concept renderings.
          </p>
        </section>

        <section className="flex w-full items-center justify-center">
          <div className="w-full max-w-[420px]">
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
        </section>
      </div>
    </main>
  );
}
