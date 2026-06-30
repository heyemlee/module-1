"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";
import type { UserRole } from "@/server/platform/types";

export function UserRoleAction({
  userId,
  userName,
  role,
  assignableRoles
}: {
  userId: string;
  userName: string;
  role: UserRole;
  assignableRoles: UserRole[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(next: UserRole) {
    if (next === role) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetchJson(
        `/api/admin/users/${encodeURIComponent(userId)}/role`,
        { method: "PATCH", body: { role: next } }
      );
      if (!response.ok) {
        setError("Unable to update");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label={`Role for ${userName}`}
        value={role}
        disabled={busy}
        onChange={(event) => changeRole(event.target.value as UserRole)}
        className="studio-glass-input appearance-none rounded-[9px] px-[9px] py-[5px] font-mono text-[10px] tracking-[0.06em] text-[#16161a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {assignableRoles.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-[10px] font-semibold text-studio-danger">
          {error}
        </span>
      )}
    </div>
  );
}
