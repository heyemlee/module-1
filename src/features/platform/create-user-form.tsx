"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/server/platform/types";

const ROLES: UserRole[] = ["SALES", "DESIGNER", "ADMIN"];

const FIELD =
  "mt-2 h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 text-[14px] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#1d1d1f]/40 focus:ring-2 focus:ring-[#1d1d1f]/10";

export function CreateUserForm() {
  const [account, setAccount] = useState("");
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
        body: JSON.stringify({ account: account.trim(), role, password })
      });
      if (!response.ok) {
        if (response.status === 409) {
          setError("Account already in use");
        } else {
          setError("Unable to create user. Check the fields and try again.");
        }
        return;
      }
      router.refresh();
      setAccount("");
      setPassword("");
      setRole("SALES");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = account.trim() && password.length >= 8;

  return (
    <form
      onSubmit={submit}
      className="h-fit rounded-[18px] border border-[#d2d2d7] bg-white p-8"
    >
      <h2 className="text-[28px] font-bold text-[#1d1d1f]">Create user</h2>
      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">Account</span>
          <input className={FIELD} value={account} onChange={(event) => setAccount(event.target.value)} />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">Role</span>
          <select className={FIELD} value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">Password</span>
          <input className={FIELD} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
      </div>
      {error && (
        <p className="mt-4 rounded-lg bg-[#fdeceb] px-3 py-2 text-sm text-[#b42318]">{error}</p>
      )}
      <button
        disabled={busy || !canSubmit}
        className="mt-6 inline-flex h-[42px] w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
