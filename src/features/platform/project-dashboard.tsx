import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { AuthUser } from "@/server/platform/types";
import type { ProjectSummary } from "@/server/platform/project-repository";
import { LogoutButton } from "./logout-button";

const STATUS_LABELS: Record<ProjectSummary["status"], string> = {
  DRAFT: "Draft",
  ROUND1_SNAPSHOT_READY: "Snapshot ready",
  ROUND1_RENDERING_READY: "Rendering ready",
  NEEDS_CONFIRMATION: "Needs review",
  ROUND2_READY: "Round 2 ready",
  ARCHIVED: "Archived"
};

function statusClass(status: ProjectSummary["status"]) {
  if (status === "ROUND1_RENDERING_READY" || status === "ROUND1_SNAPSHOT_READY") {
    return "bg-[var(--app-green-soft)] text-[var(--app-green)]";
  }
  if (status === "NEEDS_CONFIRMATION") {
    return "bg-[var(--app-amber-soft)] text-[var(--app-amber)]";
  }
  return "bg-[var(--app-blue-soft)] text-[var(--app-blue)]";
}

export function ProjectDashboard({
  user,
  projects
}: {
  user: AuthUser;
  projects: ProjectSummary[];
}) {
  return (
    <main className="app-page px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--app-blue)]">
              Projects
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-normal text-[var(--app-ink)]">
              Customer project workspace
            </h1>
            <p className="mt-2 text-sm text-[var(--app-muted)]">
              {user.name} · {user.role}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/projects/new" className="uiverse-fill-button px-4 py-2">
              New customer project
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin/users" className="uiverse-fill-button px-3 py-2">
                Users
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link href="/admin/cabinet-colors" className="uiverse-fill-button px-3 py-2">
                Cabinet Colors
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>

        <div className="app-panel mt-7 overflow-hidden">
          <form className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-border)] p-4">
            <h2 className="text-xl font-bold text-[var(--app-ink)]">Projects</h2>
            <label className="min-w-[280px] flex-1 text-sm font-medium text-[var(--app-muted)] md:max-w-md">
              Search customer, address, or project
              <Input
                name="q"
                className="mt-1"
                placeholder="Search projects..."
              />
            </label>
          </form>

          {projects.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>
                      Customer
                    </TableHead>
                    <TableHead>
                      Project
                    </TableHead>
                    <TableHead>
                      Status
                    </TableHead>
                    <TableHead className="text-right">
                      Updated
                    </TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow
                      key={project.id}
                    >
                      <TableCell>
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-[var(--app-ink)] hover:text-black"
                        >
                          {project.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--app-muted)]">
                        {project.projectName}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(project.status)}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[var(--app-muted)]">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/projects/${project.id}`}
                          className="uiverse-fill-button px-3 py-2 text-xs"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}

          {projects.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--app-muted)]">No projects yet.</p>
              <Link href="/projects/new" className="uiverse-fill-button mt-4 px-4 py-2">
                Create your first project
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
