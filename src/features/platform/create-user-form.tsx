"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { UserRole } from "@/server/platform/types";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={submit} className="h-fit space-y-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Add user</h2>
      <Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <label className="group relative block">
        <span className="absolute -top-2 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
          Role
        </span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          className="h-11 w-full appearance-none rounded-lg border border-border bg-input px-3 pr-9 text-sm text-foreground outline-none transition-all hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent/40"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground"
        />
      </label>
      <Field
        label="Temporary password (min 8)"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <p className="text-sm text-danger-foreground">{error}</p>}
      <Button type="submit" disabled={busy || !canSubmit} className="w-full">
        {busy ? "Creating..." : "Create user"}
      </Button>
    </form>
  );
}
