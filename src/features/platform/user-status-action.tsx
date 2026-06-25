"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        role="switch"
        aria-checked={!disabled}
        aria-label={actionLabel}
        disabled={busy}
        onClick={updateStatus}
        data-state={!disabled ? "active" : "disabled"}
        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-action focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-studio-success data-[state=disabled]:bg-studio-line-strong"
      >
        <span
          aria-hidden
          className="pointer-events-none inline-block size-5 transform rounded-full bg-studio-paper shadow ring-0 transition-transform motion-reduce:transition-none data-[state=active]:translate-x-5 data-[state=disabled]:translate-x-0"
          data-state={!disabled ? "active" : "disabled"}
        />
      </button>
      {error && <span role="alert" className="text-[10px] font-semibold text-studio-danger">{error}</span>}
    </div>
  );
}
