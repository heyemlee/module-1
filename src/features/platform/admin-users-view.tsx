"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { CreateUserForm } from "./create-user-form";

import { UserStatusAction } from "./user-status-action";
import { UserQuotaAction } from "./user-quota-action";
import { UserLogsModal } from "./user-logs-modal";

export function canManageUserStatus(currentUserId: string, targetUserId: string) {
  return currentUserId !== targetUserId;
}

function UserStatus({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-black/[0.05] px-2.5 text-[11px] font-bold text-[#6e6e73]">
        <span className="size-1.5 rounded-full bg-[#86868b]" />
        Disabled
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#e6f4ef] px-2.5 text-[11px] font-bold text-[#008060]">
      <span className="size-1.5 rounded-full bg-[#008060]" />
      Active
    </span>
  );
}

export function AdminUsersView({
  users,
  userName,
  currentUserId
}: {
  users: CompanyUserSummary[];
  userName: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [viewingLogsUser, setViewingLogsUser] = useState<CompanyUserSummary | null>(null);

  const colsClass = isDeleteMode 
    ? "grid grid-cols-[24px_1.5fr_1.3fr_0.8fr_0.8fr_80px_60px_76px] items-center gap-3"
    : "grid grid-cols-[1.5fr_1.3fr_0.8fr_0.8fr_80px_60px_76px] items-center gap-3";

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          console.error("Failed to delete user", id);
        }
      }
      setIsDeleteMode(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="mx-auto max-w-[1320px] px-8 py-10">
        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-[18px] border border-[#d2d2d7] bg-white p-5">
            <div className={`${colsClass} px-4 pb-3 text-[11px] font-bold text-[#6e6e73]`}>
              {isDeleteMode && <span></span>}
              <span>Name</span>
              <span>Account</span>
              <span>Role</span>
              <span>Quota</span>
              <span>Status</span>
              <span>Stats</span>
              <span className="text-right">
                {isDeleteMode ? (
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => { setIsDeleteMode(false); setSelectedIds(new Set()); }}
                      disabled={busy}
                      className="text-[#6e6e73] hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDelete}
                      disabled={busy || selectedIds.size === 0}
                      className="text-[#b42318] hover:underline disabled:opacity-50"
                    >
                      {busy ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsDeleteMode(true)} 
                    className="text-[#1d1d1f] hover:text-[#0066cc] hover:underline transition-colors"
                  >
                    Action
                  </button>
                )}
              </span>
            </div>
            
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`${colsClass} rounded-xl border border-[#d2d2d7] px-4 py-3 ${
                    u.id === currentUserId ? "bg-[#e6f4ef]" : "bg-white"
                  } ${isDeleteMode && selectedIds.has(u.id) ? "border-[#b42318] bg-[#fffcfc]" : ""}`}
                >
                  {isDeleteMode && (
                    <div className="flex items-center">
                      {u.id !== currentUserId ? (
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelection(u.id)}
                          disabled={busy}
                          className="size-4 cursor-pointer rounded border-[#d2d2d7] text-[#b42318] focus:ring-[#b42318]"
                        />
                      ) : <span />}
                    </div>
                  )}

                  <span className="truncate text-[13px] font-semibold text-[#1d1d1f]">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-[11px] font-bold text-[#6e6e73]">You</span>
                    )}
                  </span>
                  <span className="truncate text-[13px] text-[#6e6e73]">{u.account}</span>
                  <span
                    className={`text-[13px] font-medium ${
                      u.role === "ADMIN" ? "text-[#008060]" : "text-[#1d1d1f]"
                    }`}
                  >
                    {u.role}
                  </span>
                  <UserQuotaAction userId={u.id} initialQuota={u.monthlyRenderQuota} />
                  <UserStatus disabled={u.disabledAt !== null} />
                  <button 
                    onClick={() => setViewingLogsUser(u)}
                    className="text-[#0066cc] hover:underline text-[13px] font-semibold text-left"
                  >
                    Logs
                  </button>
                  {canManageUserStatus(currentUserId, u.id) ? (
                    <UserStatusAction userId={u.id} disabled={u.disabledAt !== null} />
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              {users.length === 0 && (
                <p className="px-4 py-8 text-[13px] text-[#6e6e73]">No users yet.</p>
              )}
            </div>
          </div>

          <CreateUserForm />
        </section>
      </div>

      {viewingLogsUser && (
        <UserLogsModal
          userId={viewingLogsUser.id}
          userName={viewingLogsUser.name}
          onClose={() => setViewingLogsUser(null)}
        />
      )}
    </main>
  );
}
