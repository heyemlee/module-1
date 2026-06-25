"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/server/platform/types";
import { StudioSection } from "./studio-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ROLES: UserRole[] = ["SALES", "DESIGNER", "ADMIN"];

const selectClass = "flex h-10 w-full rounded-studio-small border border-studio-line-strong bg-studio-surface px-3 py-2 text-sm text-studio-ink ring-offset-studio-void file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-studio-quiet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-action/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function CreateUserForm() {
  const [account, setAccount] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [password, setPassword] = useState("");
  const [monthlyRenderQuota, setMonthlyRenderQuota] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const nextAccount = String(formData.get("account") ?? "").trim();
    const nextRole = String(formData.get("role") ?? role) as UserRole;
    const nextPassword = String(formData.get("password") ?? "");
    const nextMonthlyRenderQuota = String(formData.get("monthlyRenderQuota") ?? "50");

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: nextAccount,
          role: nextRole,
          password: nextPassword,
          monthlyRenderQuota: parseInt(nextMonthlyRenderQuota, 10)
        })
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
      setMonthlyRenderQuota("50");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StudioSection aria-label="Create user">
      <form
        onSubmit={submit}
        autoComplete="off"
        aria-busy={busy}
        className="flex flex-col h-full p-6 lg:p-8"
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold text-studio-ink">Create user</h2>
          <p className="mt-1 text-sm text-studio-secondary">
            Create a company account and set its first monthly render allowance.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-user-account">Account</Label>
            <Input
              id="create-user-account"
              name="account"
              autoComplete="off"
              required
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-role">Role</Label>
            <select
              id="create-user-role"
              className={selectClass}
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              disabled={busy}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-password">Password</Label>
            <Input
              id="create-user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              aria-describedby="create-user-password-hint"
            />
            <p id="create-user-password-hint" className="text-xs text-studio-quiet">
              At least 8 characters
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-user-quota">Monthly quota</Label>
            <Input
              id="create-user-quota"
              name="monthlyRenderQuota"
              type="number"
              min="0"
              required
              value={monthlyRenderQuota}
              onChange={(event) => setMonthlyRenderQuota(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        {error && (
          <div role="alert" className="mt-4 rounded-md bg-studio-danger/10 px-3 py-2 text-sm text-studio-danger">
            {error}
          </div>
        )}
        <div className="mt-6">
          <Button
            type="submit"
            disabled={busy}
            className="w-full"
          >
            {busy ? "Creating..." : "Create user"}
          </Button>
        </div>
      </form>
    </StudioSection>
  );
}
