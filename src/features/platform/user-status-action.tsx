"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

export function userStatusEndpoint(userId: string) {
  return `/api/admin/users/${encodeURIComponent(userId)}/status`;
}

export function UserStatusAction({
  userId,
  userName,
  disabled
}: {
  userId: string;
  userName: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionLabel = disabled ? `Activate ${userName}` : `Pause ${userName}`;

  async function updateStatus() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchJson(userStatusEndpoint(userId), {
        method: "PATCH",
        body: { disabled: !disabled }
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label={actionLabel}
        disabled={busy}
        onClick={updateStatus}
        className="rounded-[9px] border border-white/85 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-[#16161a] transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Enable" : "Disable"}
      </button>
      {error && (
        <span role="alert" className="text-[10px] font-semibold text-studio-danger">
          {error}
        </span>
      )}
    </div>
  );
}
