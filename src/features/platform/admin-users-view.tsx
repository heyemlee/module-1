import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { CreateUserForm } from "./create-user-form";
import { PlatformHeader, NavPill } from "./platform-header";

const COLS = "grid grid-cols-[1.5fr_1.3fr_0.9fr_auto] items-center gap-3";

/**
 * Status reflects the real `disabledAt` field: a user is Active until disabled.
 * (There is no invite flow — created users sign in immediately — so there is no
 * "Pending" state.)
 */
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
  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <PlatformHeader
        userName={userName}
        nav={
          <>
            <NavPill href="/projects">Projects</NavPill>
            <NavPill href="/admin/users" active>
              Users
            </NavPill>
            <NavPill href="/admin/cabinet-colors">Cabinet Colors</NavPill>
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] px-8 py-10">

        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-[18px] border border-[#d2d2d7] bg-white p-5">
            <div className={`${COLS} px-4 pb-3 text-[11px] font-bold text-[#6e6e73]`}>
              <span>Name</span>
              <span>Account</span>
              <span>Role</span>
              <span>Status</span>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`${COLS} rounded-xl border border-[#d2d2d7] px-4 py-3 ${
                    u.id === currentUserId ? "bg-[#e6f4ef]" : "bg-white"
                  }`}
                >
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
                  <UserStatus disabled={u.disabledAt !== null} />
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
    </main>
  );
}
