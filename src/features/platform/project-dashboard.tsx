"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
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
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioSection,
  StudioStat
} from "./studio-page";
import {
  projectDashboardCounts,
  projectStatusPresentation
} from "./project-presentation";

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

  const counts = projectDashboardCounts(projects);

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

  const emptyState = (
    <StudioEmptyState
      title="No projects yet"
      description="Create your first project to get started."
      action={
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      }
    />
  );

  const projectTable = (
    <Table>
      <TableHeader>
        <TableRow className="border-studio-line hover:bg-transparent [&>th]:h-11 [&>th]:font-medium [&>th]:text-studio-muted">
          {canDeleteProjects && (
            <TableHead className="w-12">
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
          const status = projectStatusPresentation(project.status);
          return (
            <TableRow
              key={project.id}
              data-state={selectedIds.has(project.id) ? "selected" : undefined}
              className="cursor-pointer border-studio-line transition-colors hover:bg-white/[0.035] data-[state=selected]:bg-white/[0.035]"
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
              <TableCell className="font-medium text-studio-ink">
                {project.customerName}
              </TableCell>
              <TableCell className="text-studio-ink">{project.projectName}</TableCell>
              <TableCell>
                <span
                  data-project-status={project.status}
                  data-status-tone={status.tone}
                  className={cn(
                    "inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-semibold",
                    status.tone === "success" && "bg-studio-action/10 text-studio-action",
                    status.tone === "action" && "bg-studio-action text-studio-action-ink",
                    status.tone === "muted" && "bg-white/[0.05] text-studio-muted"
                  )}
                >
                  {status.label}
                </span>
              </TableCell>
              <TableCell className="text-studio-muted">{formatUpdated(project.updatedAt)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <StudioPage>
      <StudioPageHeader
        title="Projects"
        description="Continue active work, review ready concepts, or start a new project."
        action={
          <Button asChild>
            <Link href="/projects/new">New project</Link>
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-3 gap-5 rounded-studio-panel border border-studio-line bg-studio-shell px-5 py-4">
        <StudioStat label="Active" value={counts.active} />
        <StudioStat label="Intake" value={counts.intake} />
        <StudioStat
          label="Rendering ready"
          value={counts.renderingReady}
          tone="action"
        />
      </div>

      <form
        method="get"
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="block min-w-0 flex-1">
          <span className="mb-2 block text-[12px] font-medium text-studio-muted">
            Search projects
          </span>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search customer, address, or project"
          />
        </label>
        {canDeleteProjects && selectedIds.size > 0 && (
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={handleDeleteSelected}
          >
            <TrashIcon aria-hidden />
            {deleting
              ? "Deleting"
              : `Delete ${selectedIds.size} selected`}
          </Button>
        )}
      </form>

      <StudioSection className="mt-4 overflow-hidden">
        {projects.length > 0 ? projectTable : emptyState}
      </StudioSection>
    </StudioPage>
  );
}
