"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserQuotaAction({
  userId,
  initialQuota
}: {
  userId: string;
  initialQuota: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [quotaInput, setQuotaInput] = useState(initialQuota.toString());

  async function saveQuota() {
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
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/quota`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quota: parsed })
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

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[#1d1d1f]">{initialQuota}</span>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-[11px] font-bold text-[#0066cc] hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={quotaInput}
          onChange={(e) => setQuotaInput(e.target.value)}
          disabled={busy}
          className="w-16 rounded-[4px] border border-[#d2d2d7] bg-[#f5f5f7] px-1.5 py-0.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#0066cc] focus:bg-white"
          autoFocus
        />
        <button
          type="button"
          onClick={saveQuota}
          disabled={busy}
          className="rounded-[4px] bg-[#0066cc] px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setQuotaInput(initialQuota.toString());
            setError(null);
          }}
          disabled={busy}
          className="px-1 text-[11px] text-[#6e6e73] hover:text-[#1d1d1f]"
        >
          Cancel
        </button>
      </div>
      {error && <span className="text-[10px] font-semibold text-[#b42318]">{error}</span>}
    </div>
  );
}
