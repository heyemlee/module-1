"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/api-client";

export function userQuotaEndpoint(userId: string) {
  return `/api/admin/users/${encodeURIComponent(userId)}/quota`;
}

export function UserQuotaAction({
  userId,
  userName,
  initialQuota,
  used = 0
}: {
  userId: string;
  userName: string;
  initialQuota: number;
  used?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [quotaInput, setQuotaInput] = useState(initialQuota.toString());

  const pct =
    initialQuota > 0
      ? Math.min(100, Math.round((used / initialQuota) * 100))
      : 0;

  async function saveQuota(event?: React.FormEvent) {
    if (event) event.preventDefault();
    const parsed = parseInt(quotaInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError("Invalid quota");
      return;
    }
    if (parsed === initialQuota) {
      setIsEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetchJson(userQuotaEndpoint(userId), {
        method: "PUT",
        body: { quota: parsed }
      });
      if (!response.ok) {
        setError("Unable to update quota");
        return;
      }
      setIsEditing(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={saveQuota} className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={`quota-${userId}`} className="sr-only">
            Edit {userName} monthly quota
          </label>
          <input
            id={`quota-${userId}`}
            type="number"
            min="0"
            value={quotaInput}
            onChange={(event) => setQuotaInput(event.target.value)}
            disabled={busy}
            autoFocus
            className="studio-glass-input h-8 w-20 rounded-[9px] px-2 text-[13px] tabular-nums text-[#16161a]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-[9px] bg-studio-action px-2.5 py-1.5 text-[11px] font-medium text-studio-action-ink disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setIsEditing(false);
              setQuotaInput(initialQuota.toString());
              setError(null);
            }}
            className="rounded-[9px] border border-white/85 bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-[#16161a] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && (
          <span role="alert" className="text-[10px] font-semibold text-studio-danger">
            {error}
          </span>
        )}
      </form>
    );
  }

  return (
    <div className="group/quota flex items-center gap-[10px]">
      <div className="h-[6px] max-w-[120px] flex-1 overflow-hidden rounded-full bg-[rgba(20,20,26,0.08)]">
        <div
          className="h-full rounded-full bg-studio-ink"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[#86867f]">
        {used}/{initialQuota}
      </span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={`Edit ${userName} monthly quota`}
        className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-[#aaaaa4] opacity-0 transition-opacity hover:text-studio-ink focus-visible:opacity-100 group-hover/quota:opacity-100"
      >
        EDIT
      </button>
    </div>
  );
}
