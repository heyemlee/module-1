import Link from "next/link";
import { Plus, Search, Users, Palette } from "lucide-react";
import type { AuthUser } from "@/server/platform/types";
import type { ProjectSummary } from "@/server/platform/project-repository";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "./logout-button";

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.includes("DONE") || s.includes("COMPLETE")) return "success" as const;
  if (s.includes("PROGRESS") || s.includes("ACTIVE")) return "primary" as const;
  return "neutral" as const;
}

export function ProjectDashboard({
  user,
  projects
}: {
  user: AuthUser;
  projects: ProjectSummary[];
}) {
  return (
    <PageShell
      actions={
        <>
          {user.role === "ADMIN" && (
            <Link href="/admin/users" className={buttonClass("secondary", "sm")}>
              <Users size={14} />
              Users
            </Link>
          )}
          {user.role === "ADMIN" && (
            <Link href="/admin/cabinet-colors" className={buttonClass("secondary", "sm")}>
              <Palette size={14} />
              Cabinet Colors
            </Link>
          )}
          <LogoutButton />
        </>
      }
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.name} · <span className="font-mono text-xs uppercase tracking-wide">{user.role}</span>
          </p>
        </div>
        <Link href="/projects/new" className={buttonClass()}>
          <Plus size={16} />
          New customer project
        </Link>
      </header>

      <form className="mt-6">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" />
          <input
            name="q"
            placeholder="Search customer, address, or project"
            className="h-11 w-full rounded-lg border border-border bg-input pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-subtle-foreground focus:border-accent focus:ring-1 focus:ring-accent/40"
          />
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="hidden grid-cols-4 gap-4 border-b border-border bg-surface-2 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Customer</span>
          <span>Project</span>
          <span>Status</span>
          <span className="text-right">Updated</span>
        </div>
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="grid grid-cols-2 items-center gap-4 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-surface-2 sm:grid-cols-4"
          >
            <span className="font-medium">{project.customerName}</span>
            <span className="text-muted-foreground">{project.projectName}</span>
            <span>
              <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            </span>
            <span className="hidden text-right text-muted-foreground sm:block">
              {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <Link href="/projects/new" className={`mt-4 ${buttonClass()}`}>
              <Plus size={16} />
              Create your first project
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}
