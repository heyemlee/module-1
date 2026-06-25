"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function userQuotaEndpoint(userId: string) {
  return `/api/admin/users/${encodeURIComponent(userId)}/quota`;
}

export function UserQuotaAction({
  userId,
  userName,
  initialQuota
}: {
  userId: string;
  userName: string;
  initialQuota: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [quotaInput, setQuotaInput] = useState(initialQuota.toString());

  async function saveQuota(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
      const response = await fetch(userQuotaEndpoint(userId), {
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
        <span className="tabular-nums text-studio-ink font-medium">{initialQuota}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit ${userName} monthly quota`}
          className="h-auto px-2 py-1 text-xs"
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={saveQuota} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={`quota-${userId}`} className="sr-only">
          Edit {userName} monthly quota
        </Label>
        <Input
          id={`quota-${userId}`}
          type="number"
          min="0"
          value={quotaInput}
          onChange={(e) => setQuotaInput(e.target.value)}
          disabled={busy}
          className="h-8 w-20 px-2 py-1 text-sm tabular-nums"
          autoFocus
        />
        <Button
          type="submit"
          disabled={busy}
          size="sm"
          className="h-8 px-2 py-1 text-xs"
        >
          Save
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setIsEditing(false);
            setQuotaInput(initialQuota.toString());
            setError(null);
          }}
          disabled={busy}
          size="sm"
          className="h-8 px-2 py-1 text-xs"
        >
          Cancel
        </Button>
      </div>
      {error && <span role="alert" className="text-[10px] font-semibold text-studio-danger">{error}</span>}
    </form>
  );
}
