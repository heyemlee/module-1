"use client";

import { useState } from "react";

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
    <main className="min-h-screen bg-stone-100 px-6 py-16 text-stone-950">
      <form onSubmit={submit} className="mx-auto max-w-sm rounded border border-stone-300 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{`${process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Showroom"} Login`}</h1>
        <label className="mt-5 block text-sm font-medium">
          Email
          <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-6 w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
