import Link from "next/link";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { CreateUserForm } from "./create-user-form";

export function AdminUsersView({ users }: { users: CompanyUserSummary[] }) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-4xl">
        <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
        <h1 className="mt-4 text-2xl font-semibold">Users</h1>
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded border border-stone-300 bg-white">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-3 gap-4 border-b border-stone-200 px-4 py-3 text-sm last:border-b-0">
                <span className="font-medium">{u.name}</span>
                <span className="truncate text-stone-600">{u.email}</span>
                <span className="text-right">{u.role}</span>
              </div>
            ))}
            {users.length === 0 && <p className="px-4 py-8 text-sm text-stone-600">No users yet.</p>}
          </div>
          <CreateUserForm />
        </section>
      </div>
    </main>
  );
}
