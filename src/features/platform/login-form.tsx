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
    <main className="min-h-[100dvh] bg-studio-void text-studio-ink">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1180px] items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_420px] lg:px-10">
        <section className="hidden lg:block">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-[10px] bg-studio-action" />
            <span className="text-[14px] font-semibold">ABCabinet Studio</span>
          </div>
          <h1 className="mt-12 max-w-[560px] text-[54px] font-semibold leading-[1.02] tracking-[-0.055em]">
            Make the quote ready.
          </h1>
          <p className="mt-5 max-w-[48ch] text-[15px] leading-6 text-studio-muted">
            Capture the room, confirm the layout, and produce a concept rendering in one project workspace.
          </p>
        </section>

        <section className="w-full">
          <SignInForm
            account={account}
            password={password}
            remember={remember}
            busy={busy}
            error={
              error ? (
                <p
                  role="alert"
                  className="rounded-studio-control border border-studio-danger/30 bg-studio-danger/10 px-3 py-2 text-[13px] text-studio-danger"
                >
                  {error}
                </p>
              ) : null
            }
            onAccountChange={setAccount}
            onPasswordChange={setPassword}
            onRememberChange={setRemember}
            onSubmit={submit}
          />
        </section>
      </div>
    </main>
  );
}
