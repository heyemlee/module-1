"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { fetchJson } from "@/lib/api-client";
import type { UserRole } from "@/server/platform/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

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
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Role for ${userName}`}
          disabled={busy}
          className="group inline-flex items-center gap-1.5 rounded-[9px] border border-white/80 bg-white/60 px-[10px] py-[5px] font-mono text-[10px] tracking-[0.06em] text-[#16161a] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-studio-ink/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-white/85 data-[state=open]:ring-2 data-[state=open]:ring-studio-ink/25"
        >
          {role}
          <ChevronDownIcon
            aria-hidden
            className="size-3 text-[#9a9a94] transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[150px]">
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(next) => void changeRole(next as UserRole)}
          >
            {assignableRoles.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                className="font-mono text-[11px] tracking-[0.04em] text-[#16161a]"
              >
                {option}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <span role="alert" className="text-[10px] font-semibold text-studio-danger">
          {error}
        </span>
      )}
    </div>
  );
}
