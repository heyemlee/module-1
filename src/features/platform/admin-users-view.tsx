"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { CreateUserForm } from "./create-user-form";
import { UserStatusAction } from "./user-status-action";
import { UserQuotaAction } from "./user-quota-action";
import { UserLogsModal } from "./user-logs-modal";
import { StudioPage, StudioPageHeader, StudioStat, StudioSection } from "./studio-page";
import { userSummary } from "./admin-presentation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function canManageUserStatus(currentUserId: string, targetUserId: string) {
  return currentUserId !== targetUserId;
}

export function AdminUsersView({
  users,
  currentUserId
}: {
  users: CompanyUserSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [viewingLogsUser, setViewingLogsUser] = useState<CompanyUserSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const summary = userSummary(users);

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
    } catch (err) {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  const userList = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="sr-only">Users List</h2>
        {isDeleteMode ? (
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteMode(false);
                setSelectedIds(new Set());
                setDeleteError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy || selectedIds.size === 0}
            >
              {busy ? "Deleting..." : `Delete selected (${selectedIds.size})`}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsDeleteMode(true)}>
            Select users
          </Button>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {isDeleteMode ? `${selectedIds.size} users selected.` : ""}
      </div>

      {deleteError && (
        <div role="alert" className="text-sm font-medium text-studio-danger">
          {deleteError}
        </div>
      )}

      {/* Desktop Table (lg and above) */}
      <div className="hidden lg:block overflow-hidden rounded-xl border border-studio-line bg-studio-void">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-studio-line bg-studio-shell">
            <tr>
              {isDeleteMode && <th className="p-4 w-12"><span className="sr-only">Select</span></th>}
              <th className="p-4 font-semibold text-studio-secondary">Name</th>
              <th className="p-4 font-semibold text-studio-secondary">Account</th>
              <th className="p-4 font-semibold text-studio-secondary">Role</th>
              <th className="p-4 font-semibold text-studio-secondary">Quota</th>
              <th className="p-4 font-semibold text-studio-secondary">Status</th>
              <th className="p-4 font-semibold text-studio-secondary">Stats</th>
              <th className="p-4 font-semibold text-studio-secondary text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-line">
            {users.map((u) => (
              <tr key={u.id} className={u.id === currentUserId ? "bg-studio-shell/50" : ""}>
                {isDeleteMode && (
                  <td className="p-4">
                    {u.id !== currentUserId && (
                      <Checkbox
                        checked={selectedIds.has(u.id)}
                        onCheckedChange={(checked) => toggleSelection(u.id, checked === true)}
                        disabled={busy}
                        aria-label={`Select ${u.name}`}
                      />
                    )}
                  </td>
                )}
                <td className="p-4 font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 rounded-full bg-studio-line px-2 py-0.5 text-xs font-semibold text-studio-secondary">
                      You
                    </span>
                  )}
                </td>
                <td className="p-4 text-studio-secondary">{u.account}</td>
                <td className="p-4 font-medium text-studio-secondary">{u.role}</td>
                <td className="p-4">
                  <UserQuotaAction userId={u.id} initialQuota={u.monthlyRenderQuota} />
                </td>
                <td className="p-4">
                  {u.disabledAt !== null ? "Disabled" : "Active"}
                </td>
                <td className="p-4">
                  <Button variant="link" className="px-0" onClick={() => setViewingLogsUser(u)}>
                    View usage
                  </Button>
                </td>
                <td className="p-4 text-right">
                  {canManageUserStatus(currentUserId, u.id) && (
                    <UserStatusAction userId={u.id} disabled={u.disabledAt !== null} />
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={isDeleteMode ? 8 : 7} className="p-8 text-center text-studio-secondary">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Stacked Card representation (< lg) */}
      <div className="lg:hidden space-y-4">
        {users.map((u) => (
          <div key={u.id} className={`flex flex-col gap-3 rounded-xl border border-studio-line p-4 ${u.id === currentUserId ? "bg-studio-shell/50" : "bg-studio-void"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isDeleteMode && u.id !== currentUserId && (
                  <Checkbox
                    checked={selectedIds.has(u.id)}
                    onCheckedChange={(checked) => toggleSelection(u.id, checked === true)}
                    disabled={busy}
                    aria-label={`Select ${u.name}`}
                  />
                )}
                <div className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 rounded-full bg-studio-line px-2 py-0.5 text-xs font-semibold text-studio-secondary">
                      You
                    </span>
                  )}
                </div>
              </div>
              <div>{u.disabledAt !== null ? "Disabled" : "Active"}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-studio-secondary">Account</div>
              <div className="text-right">{u.account}</div>
              
              <div className="text-studio-secondary">Role</div>
              <div className="text-right font-medium">{u.role}</div>
              
              <div className="text-studio-secondary">Quota</div>
              <div className="flex justify-end">
                <UserQuotaAction userId={u.id} initialQuota={u.monthlyRenderQuota} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-studio-line pt-3 mt-1">
              <Button variant="link" className="px-0 h-auto" onClick={() => setViewingLogsUser(u)}>
                View usage
              </Button>
              {canManageUserStatus(currentUserId, u.id) && (
                <UserStatusAction userId={u.id} disabled={u.disabledAt !== null} />
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="p-8 text-center text-studio-secondary rounded-xl border border-studio-line bg-studio-void">
            No users yet.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <StudioPage>
      <StudioPageHeader
        title="Users"
        description="Manage access, roles, quotas, and usage."
        meta={
          <div className="grid max-w-md grid-cols-3 gap-4">
            <StudioStat label="Active" value={summary.active} />
            <StudioStat label="Disabled" value={summary.disabled} tone="warning" />
            <StudioStat label="Admins" value={summary.admins} />
          </div>
        }
      />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
        <StudioSection aria-label="Company users">
          {userList}
        </StudioSection>
        <CreateUserForm />
      </div>

      {viewingLogsUser && (
        <UserLogsModal
          userId={viewingLogsUser.id}
          userName={viewingLogsUser.name}
          onClose={() => setViewingLogsUser(null)}
        />
      )}
    </StudioPage>
  );
}
