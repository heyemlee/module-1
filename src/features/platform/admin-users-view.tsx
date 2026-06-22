import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { CreateUserForm } from "./create-user-form";
import { LogoutButton } from "./logout-button";

export function AdminUsersView({ users }: { users: CompanyUserSummary[] }) {
  return (
    <PageShell width="max-w-4xl" backHref="/projects" backLabel="Back to projects" actions={<LogoutButton />}>
      <h1 className="text-2xl font-semibold">Users</h1>
      <section className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="h-fit overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          {users.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0 sm:grid-cols-3"
            >
              <span className="font-medium">{u.name}</span>
              <span className="hidden truncate text-muted-foreground sm:block">{u.email}</span>
              <span className="text-right">
                <Badge tone={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Badge>
              </span>
            </div>
          ))}
          {users.length === 0 && <p className="px-4 py-8 text-sm text-muted-foreground">No users yet.</p>}
        </div>
        <CreateUserForm />
      </section>
    </PageShell>
  );
}
