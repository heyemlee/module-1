"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/page-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        setError("Invalid email or password");
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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-7 shadow-sm">
        <Logo className="mb-6" />
        <h1 className="text-xl font-semibold">{`${process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Showroom"} Login`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to access your projects.</p>
        <div className="mt-7 space-y-5">
          <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm text-danger-foreground">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
