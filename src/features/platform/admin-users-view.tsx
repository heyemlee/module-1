"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import type { UserRole } from "@/server/platform/types";
import { CreateUserForm } from "./create-user-form";
import { UserStatusAction } from "./user-status-action";
import { UserQuotaAction } from "./user-quota-action";
import { UserLogsDialog } from "./user-logs-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function canManageUserStatus(currentUserId: string, targetUserId: string) {
  return currentUserId !== targetUserId;
}

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

function roleLabel(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function AdminUsersView({
  users,
  currentUserId,
  currentUserRole
}: {
  users: CompanyUserSummary[];
  currentUserId: string;
  currentUserRole: UserRole;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [viewingLogsUser, setViewingLogsUser] =
    useState<CompanyUserSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const gridCols = isDeleteMode
    ? "grid-cols-[auto_1.4fr_0.8fr_1fr_1.1fr_0.6fr]"
    : "grid-cols-[1.4fr_0.8fr_1fr_1.1fr_0.6fr]";

  function toggleSelection(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds, (id) =>
          fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
            method: "DELETE"
          })
        )
      );
      const failed = results.filter(
        (result) => result.status === "rejected" || !result.value.ok
      ).length;
      if (failed > 0) {
        setDeleteError(`Failed to delete ${failed} user(s).`);
      } else {
        setIsDeleteMode(false);
        setSelectedIds(new Set());
      }
      router.refresh();
    } catch {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-anim-screen flex min-h-[100dvh] flex-col">
      <header className="studio-glass-header sticky top-0 z-[5] flex items-end justify-between gap-4 px-5 pb-[24px] pt-[28px] sm:px-[40px]">
        <div>
          <p className="mb-[9px] font-mono text-[11px] tracking-[0.2em] text-[#86867f]">
            ADMIN / USERS
          </p>
          <h1 className="text-[33px] font-semibold tracking-[-0.025em] text-[#16161a]">
            User management
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="shrink-0 rounded-[13px] px-5 py-[13px] text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_26px_-12px_rgba(20,20,26,0.5)]"
          style={{ background: "linear-gradient(180deg,#2c2c30,#141416)" }}
        >
          + New user
        </button>
      </header>

      <div className="px-5 pb-[60px] pt-[22px] sm:px-[40px]">
        <div className="mb-[14px] flex min-h-[34px] items-center justify-end gap-3">
          {deleteError && (
            <span role="alert" className="text-[12px] font-medium text-studio-danger">
              {deleteError}
            </span>
          )}
          {isDeleteMode ? (
            <>
              <span aria-live="polite" className="font-mono text-[11px] text-[#86867f]">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setIsDeleteMode(false);
                  setSelectedIds(new Set());
                  setDeleteError(null);
                }}
                className="rounded-[10px] border border-white/85 bg-white/55 px-3 py-2 text-[12px] font-medium text-[#16161a] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || selectedIds.size === 0}
                onClick={handleDelete}
                className="rounded-[10px] bg-studio-danger px-3 py-2 text-[12px] font-medium text-studio-danger-ink disabled:opacity-50"
              >
                {busy ? "Deleting…" : `Delete selected (${selectedIds.size})`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsDeleteMode(true)}
              className="rounded-[10px] border border-white/85 bg-white/55 px-3 py-2 text-[12px] font-medium text-[#16161a]"
            >
              Select users
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <div
            className="min-w-[680px] overflow-hidden rounded-[18px]"
            style={{
              background:
                "linear-gradient(160deg,rgba(255,255,255,0.58),rgba(255,255,255,0.42))",
              border: "1px solid rgba(255,255,255,0.75)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.85) inset,0 18px 44px -26px rgba(20,20,26,0.22)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)"
            }}
          >
            <div
              className={cn(
                "grid items-center gap-2 border-b border-[rgba(20,20,26,0.07)] px-[18px] py-[14px] font-mono text-[10px] tracking-[0.12em] text-[#9a9a94]",
                gridCols
              )}
            >
              {isDeleteMode && <span className="sr-only">Select</span>}
              <span>USER</span>
              <span>ROLE</span>
              <span>STATUS</span>
              <span>RENDER QUOTA</span>
              <span className="text-right">ACTION</span>
            </div>

            {users.map((user) => {
              const self = user.id === currentUserId;
              const isDisabled = user.disabledAt !== null;
              return (
                <div
                  key={user.id}
                  className={cn(
                    "grid items-center gap-2 border-b border-[rgba(20,20,26,0.05)] px-[18px] py-[15px] last:border-b-0",
                    gridCols,
                    self && "bg-white/40"
                  )}
                >
                  {isDeleteMode && (
                    <span>
                      {!self && (
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={(checked) =>
                            toggleSelection(user.id, checked === true)
                          }
                          disabled={busy}
                          aria-label={`Select ${user.name}`}
                        />
                      )}
                    </span>
                  )}

                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      style={{ background: "linear-gradient(150deg,#2c2c30,#141416)" }}
                    >
                      {initialsOf(user.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-[#16161a]">
                        {user.name}
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-[#9a9a94]">
                        @{user.account}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span
                      className={cn(
                        "inline-block rounded-full px-[9px] py-[3px] font-mono text-[9.5px] tracking-[0.08em]",
                        user.role === "ADMIN" || user.role === "OWNER"
                          ? "bg-studio-ink text-white"
                          : "border border-white/80 bg-white/70 text-[#46463f]"
                      )}
                    >
                      {roleLabel(user.role)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-[7px] rounded-full"
                      style={{ background: isDisabled ? "#cacac4" : "#1a1a1c" }}
                    />
                    <span className="text-[12.5px] text-[#5a5a56]">
                      {isDisabled ? "Disabled" : "Active"}
                    </span>
                  </div>

                  <div>
                    <UserQuotaAction
                      userId={user.id}
                      userName={user.name}
                      initialQuota={user.monthlyRenderQuota}
                      used={user.used ?? 0}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingLogsUser(user)}
                      aria-label={`View usage for ${user.name}`}
                      title="View usage"
                      className="flex size-7 items-center justify-center rounded-[8px] border border-white/85 bg-white/55 text-[#6a6a64] transition-colors hover:text-studio-ink"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                      </svg>
                    </button>
                    {self ? (
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-[9px] border border-[rgba(20,20,26,0.1)] bg-transparent px-3 py-1.5 text-[11px] font-medium text-[#bcbcb6]"
                      >
                        You
                      </button>
                    ) : (
                      <UserStatusAction
                        userId={user.id}
                        userName={user.name}
                        disabled={isDisabled}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="px-[18px] py-12 text-center text-[13px] text-[#86867f]">
                No users yet.
              </div>
            )}
          </div>
        </div>

        <p className="mt-[14px] font-mono text-[10.5px] tracking-[0.04em] text-[#aaaaa4]">
          ⌿ The current administrator cannot suspend or delete their own account.
        </p>
      </div>

      {showCreate && (
        <CreateUserForm
          onClose={() => setShowCreate(false)}
          currentUserRole={currentUserRole}
        />
      )}

      {viewingLogsUser && (
        <UserLogsDialog
          open
          userId={viewingLogsUser.id}
          userName={viewingLogsUser.name}
          onOpenChange={(open) => {
            if (!open) setViewingLogsUser(null);
          }}
        />
      )}
    </div>
  );
}
