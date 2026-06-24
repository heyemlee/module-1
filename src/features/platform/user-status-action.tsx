"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function userStatusEndpoint(userId: string) {
  return `/api/admin/users/${encodeURIComponent(userId)}/status`;
}

export function UserStatusAction({
  userId,
  disabled
}: {
  userId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionLabel = disabled ? "Activate" : "Pause";

  async function updateStatus() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(userStatusEndpoint(userId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !disabled })
      });
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
    <div className="flex min-w-[76px] flex-col items-end gap-1">
      <label className="user-status-switch" title={actionLabel}>
        <input
          type="checkbox"
          checked={!disabled}
          disabled={busy}
          onChange={updateStatus}
          aria-label={actionLabel}
        />
        <span className="user-status-slider" />
      </label>
      {error && <span className="text-[10px] font-semibold text-[#b42318]">{error}</span>}
    </div>
  );
}
