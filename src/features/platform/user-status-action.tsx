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
      <button
        type="button"
        disabled={busy}
        onClick={updateStatus}
        className="inline-flex h-7 items-center justify-center rounded-full border border-[#d2d2d7] bg-white px-3 text-[11px] font-bold text-[#1d1d1f] transition hover:border-[#1d1d1f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (disabled ? "Activating..." : "Pausing...") : actionLabel}
      </button>
      {error && <span className="text-[10px] font-semibold text-[#b42318]">{error}</span>}
    </div>
  );
}
