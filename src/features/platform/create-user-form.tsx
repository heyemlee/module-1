"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/server/platform/types";

const ROLES: UserRole[] = ["SALES", "DESIGNER", "ADMIN"];

export function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role, password })
      });
      if (!response.ok) {
        if (response.status === 409) {
          setError("Email already in use");
        } else {
          setError("Unable to create user. Check the fields and try again.");
        }
        return;
      }
      router.refresh();
      setEmail("");
      setName("");
      setPassword("");
      setRole("SALES");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim() && name.trim() && password.length >= 8;

  return (
    <form onSubmit={submit} className="space-y-4 rounded border border-stone-300 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add user</h2>
      <label className="block text-sm font-medium">
        Email
        <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Name
        <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        Role
        <select className="mt-1 w-full rounded border border-stone-300 px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Temporary password <span className="font-normal text-stone-500">(min 8 characters)</span>
        <input className="mt-1 w-full rounded border border-stone-300 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || !canSubmit} className="w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
