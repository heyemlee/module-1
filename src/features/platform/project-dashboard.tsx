import Link from "next/link";
import type { AuthUser } from "@/server/platform/types";
import type { ProjectSummary } from "@/server/platform/project-repository";

export function ProjectDashboard({
  user,
  projects
}: {
  user: AuthUser;
  projects: ProjectSummary[];
}) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Projects</h1>
            <p className="text-sm text-stone-600">{user.name} · {user.role}</p>
          </div>
          <Link href="/projects/new" className="rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            New customer project
          </Link>
        </header>
        <form className="mt-6">
          <label className="block text-sm font-medium text-stone-700">
            Search customer, address, or project
            <input name="q" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
          </label>
        </form>
        <div className="mt-6 overflow-hidden rounded border border-stone-300 bg-white">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="grid grid-cols-4 gap-4 border-b border-stone-200 px-4 py-3 text-sm last:border-b-0">
              <span className="font-medium">{project.customerName}</span>
              <span>{project.projectName}</span>
              <span>{project.status}</span>
              <span className="text-right text-stone-500">{new Date(project.updatedAt).toLocaleDateString()}</span>
            </Link>
          ))}
          {projects.length === 0 && <p className="px-4 py-8 text-sm text-stone-600">No projects yet.</p>}
        </div>
      </div>
    </main>
  );
}
