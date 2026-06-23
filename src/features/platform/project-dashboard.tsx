"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UiverseDeleteButton } from "./uiverse-delete-button";

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
  const router = useRouter();
  const canDeleteProjects = user.role === "ADMIN";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (!canDeleteProjects) return;
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} project(s)?`)) return;
    setDeleting(true);
    try {
      const responses = await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/projects/${id}`, { method: "DELETE" })
        )
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to delete one or more projects");
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      alert("Unable to delete one or more projects");
    } finally {
      setDeleting(false);
    }
  };
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
            <div className="flex flex-1 items-center justify-end gap-4 min-w-[280px]">
              {canDeleteProjects && selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--app-red)]">{selectedIds.size} selected</span>
                  <UiverseDeleteButton onClick={handleDeleteSelected} disabled={deleting} />
                </div>
              )}
              <label className="text-sm font-medium text-[var(--app-muted)] md:max-w-md w-full">
                Search customer, address, or project
                <Input
                  name="q"
                  className="mt-1"
                  placeholder="Search projects..."
                />
              </label>
            </div>
          </form>

          {projects.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  {canDeleteProjects && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={projects.length > 0 && selectedIds.size === projects.length}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
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
                      data-state={selectedIds.has(project.id) ? "selected" : undefined}
                    >
                      {canDeleteProjects && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(project.id)}
                          onCheckedChange={() => toggleOne(project.id)}
                          aria-label={`Select project ${project.projectName}`}
                        />
                      </TableCell>
                      )}
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
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/projects/${project.id}`}
                            className="uiverse-fill-button px-3 py-2 text-xs"
                          >
                            Open
                          </Link>
                        </div>
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
