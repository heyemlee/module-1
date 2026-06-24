"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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
import { PlatformHeader, NavPill } from "./platform-header";
import { UiverseDeleteButton } from "./uiverse-delete-button";

const STATUS_LABELS: Record<ProjectSummary["status"], string> = {
  INTAKE: "Intake",
  RENDERING_READY: "Rendering ready",
  ROUND2_MEASURING: "Round 2 measuring",
  ARCHIVED: "Archived"
};

const READY_STATUSES: ReadonlySet<ProjectSummary["status"]> = new Set([
  "RENDERING_READY",
  "ROUND2_MEASURING"
]);

function statusColor(status: ProjectSummary["status"]) {
  if (READY_STATUSES.has(status)) return "#008060";
  return "#1d1d1f";
}

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectDashboard({
  user,
  projects,
  query = ""
}: {
  user: AuthUser;
  projects: ProjectSummary[];
  query?: string;
}) {
  const router = useRouter();
  const canDeleteProjects = user.role === "ADMIN";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const activeCount = projects.filter((p) => p.status !== "ARCHIVED").length;

  const toggleAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
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
        Array.from(selectedIds).map((id) => fetch(`/api/projects/${id}`, { method: "DELETE" }))
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
    <main className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <PlatformHeader
        userName={user.name}
        nav={
          <>
            <NavPill href="/projects" active>
              Projects
            </NavPill>
            {canDeleteProjects && <NavPill href="/admin/users">Users</NavPill>}
            {canDeleteProjects && <NavPill href="/admin/cabinet-colors">Cabinet Colors</NavPill>}
          </>
        }
      />

      <div className="mx-auto max-w-[1320px] px-8 py-10">


        {/* Search + filters */}
        <form method="get" className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-[500px]">
            <label htmlFor="q" className="mb-2 block text-[12px] font-semibold text-[#6e6e73]">
              Search
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Search customer, address, or project"
              className="h-11 rounded-xl border-[#d2d2d7] bg-white text-[14px] text-[#1d1d1f] shadow-none placeholder:text-[#86868b] focus-visible:border-[#1d1d1f]/40 focus-visible:ring-[#1d1d1f]/10"
            />
          </div>
          <div className="flex items-center gap-3 pb-1.5">
            <span className="inline-flex h-7 items-center rounded-full bg-[#e6f4ef] px-3 text-[11px] font-bold text-[#008060]">
              {activeCount} active
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4 pb-1">
            {canDeleteProjects && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#b42318]">{selectedIds.size} selected</span>
                <UiverseDeleteButton onClick={handleDeleteSelected} disabled={deleting} />
              </div>
            )}
            <Link
              href="/projects/new"
              className="inline-flex h-[42px] items-center rounded-full bg-[#1d1d1f] px-6 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              New project
            </Link>
          </div>
        </form>

        {/* Table */}
        {projects.length > 0 ? (
          <div className="mt-6 max-w-[1000px] rounded-2xl border border-[#d2d2d7] bg-white p-4">
            <Table className="border-separate border-spacing-y-2">
              <TableHeader>
                <TableRow className="hover:bg-transparent [&>th]:h-auto [&>th]:px-4 [&>th]:pb-2 [&>th]:pt-1 [&>th]:text-[11px] [&>th]:font-bold [&>th]:text-[#6e6e73]">
                  {canDeleteProjects && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={projects.length > 0 && selectedIds.size === projects.length}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Customer</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const ready = READY_STATUSES.has(project.status);
                  return (
                    <TableRow
                      key={project.id}
                      data-state={selectedIds.has(project.id) ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer transition-transform duration-200 hover:-translate-y-[3px] hover:scale-[1.006]",
                        ready ? "bg-[#e6f4ef] hover:bg-[#e6f4ef]" : "bg-white hover:bg-white",
                        "data-[state=selected]:bg-[#e8e8ed]",
                        "[&>td]:border-y [&>td]:border-[#d2d2d7] [&>td]:text-[13px]",
                        "[&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l",
                        "[&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r"
                      )}
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      {canDeleteProjects && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(project.id)}
                            onCheckedChange={() => toggleOne(project.id)}
                            aria-label={`Select project ${project.projectName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-semibold text-[#1d1d1f]">
                        {project.customerName}
                      </TableCell>
                      <TableCell className="text-[#1d1d1f]">{project.projectName}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5 font-medium"
                          style={{ color: statusColor(project.status) }}
                        >
                          {STATUS_LABELS[project.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-[#1d1d1f]">{formatUpdated(project.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#d2d2d7] bg-white px-6 py-16 text-center">
            <p className="text-[14px] text-[#6e6e73]">No projects yet.</p>
            <Link
              href="/projects/new"
              className="mt-4 inline-flex h-[42px] items-center rounded-full bg-[#1d1d1f] px-6 text-[13px] font-semibold text-white"
            >
              Create your first project
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
