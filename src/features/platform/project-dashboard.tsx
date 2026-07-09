"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/server/platform/types";
import type { ProjectSummary } from "@/server/platform/project-repository";
import {
  projectDashboardCounts,
  projectStatusPresentation
} from "./project-presentation";
import { CustomerAvatar } from "./customer-avatar";

const CTA =
  "inline-flex items-center gap-[9px] rounded-[13px] px-5 py-[13px] text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_26px_-12px_rgba(20,20,26,0.5)]";
const CTA_STYLE = { background: "linear-gradient(180deg,#2c2c30,#141416)" };

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
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
  const canDeleteProjects = user.role === "ADMIN" || user.role === "OWNER";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const showCheckboxes = canDeleteProjects && selectionMode;

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const counts = projectDashboardCounts(projects);
  const stats = [
    { label: "ACTIVE", value: counts.active, unit: "in progress" },
    { label: "INTAKE", value: counts.intake, unit: "in queue" },
    { label: "CONCEPT READY", value: counts.renderingReady, unit: "concepts" },
    { label: "TOTAL", value: projects.length, unit: "projects" }
  ];

  const gridCols = showCheckboxes
    ? "grid-cols-[auto_minmax(0,1.6fr)_1fr_0.7fr]"
    : "grid-cols-[minmax(0,1.6fr)_1fr_0.7fr]";

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
    setDeleting(true);
    try {
      const responses = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/projects/${id}`, { method: "DELETE" })
        )
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to delete one or more projects");
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      alert("Unable to delete one or more projects");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="studio-anim-screen flex min-h-[100dvh] flex-col">
      <header className="studio-glass-header sticky top-0 z-[5] px-5 pb-[22px] pt-[28px] sm:px-[40px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-[9px] font-mono text-[11px] tracking-[0.2em] text-[#86867f]">
              WORKSPACE / PROJECTS
            </p>
            <h1 className="text-[37px] font-semibold tracking-[-0.025em] text-[#16161a]">
              Projects
            </h1>
          </div>
          <Link
            href="/projects/new"
            className={cn(CTA, "self-start")}
            style={CTA_STYLE}
          >
            <span className="text-[16px] leading-none">+</span>New project
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-[14px] lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[18px] px-5 py-[18px]"
              style={{
                background:
                  "linear-gradient(160deg,rgba(255,255,255,0.6),rgba(255,255,255,0.42))",
                border: "1px solid rgba(255,255,255,0.75)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.85) inset,0 16px 40px -24px rgba(20,20,26,0.22)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)"
              }}
            >
              <p className="mb-[10px] font-mono text-[10.5px] tracking-[0.12em] text-[#86867f]">
                {stat.label}
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-[34px] font-semibold tabular-nums tracking-[-0.02em] text-[#16161a]">
                  {stat.value}
                </span>
                <span className="font-mono text-[11px] text-[#aaaaa4]">
                  {stat.unit}
                </span>
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="px-5 pb-[60px] pt-[22px] sm:px-[40px]">
        <div className="mb-[18px] flex items-center gap-[14px]">
          <form
            method="get"
            className="flex flex-1 items-center gap-[10px] rounded-[14px] border border-white/80 bg-white/55 px-[15px] py-3 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
          >
            <span aria-hidden className="text-[14px] text-[#aaaaa4]">
              ⌕
            </span>
            <input
              name="q"
              type="search"
              defaultValue={query}
              aria-label="Search projects"
              placeholder="Search customer, address or project…"
              className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#16161a] outline-none placeholder:text-[#aaaaa4]"
            />
          </form>
          {showCheckboxes ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || selectedIds.size === 0}
                onClick={() => setConfirmOpen(true)}
              >
                <TrashIcon aria-hidden />
                {selectedIds.size > 0
                  ? `Delete ${selectedIds.size} selected`
                  : "Select to delete"}
              </Button>
              <Button type="button" variant="ghost" onClick={exitSelectionMode}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] tracking-[0.1em] text-[#86867f]">
                {projects.length} SHOWN
              </span>
              {canDeleteProjects && projects.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectionMode(true)}
                  aria-label="Delete projects"
                >
                  <TrashIcon aria-hidden />
                </Button>
              )}
            </div>
          )}
        </div>

        {projects.length > 0 ? (
          <>
            <div
              className={cn(
                "grid items-center gap-0 px-[18px] pb-3 font-mono text-[10px] tracking-[0.14em] text-[#a4a49e]",
                gridCols
              )}
            >
              {showCheckboxes && (
                <span className="pr-3">
                  <Checkbox
                    checked={
                      projects.length > 0 &&
                      selectedIds.size === projects.length
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </span>
              )}
              <span>CUSTOMER / PROJECT</span>
              <span>STATUS</span>
              <span className="text-right">UPDATED</span>
            </div>

            <div className="flex flex-col">
              {projects.map((project, index) => {
                const status = projectStatusPresentation(project.status);
                const selected = selectedIds.has(project.id);
                return (
                  <div
                    key={project.id}
                    onClick={() =>
                      showCheckboxes
                        ? toggleOne(project.id)
                        : router.push(`/projects/${project.id}`)
                    }
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "group cursor-pointer rounded-[14px] border border-transparent transition hover:-translate-y-px hover:border-white/80 hover:bg-white/[0.72] hover:shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_16px_34px_-20px_rgba(20,20,26,0.3)]",
                      selected && "border-white/80 bg-white/[0.72]"
                    )}
                  >
                    <div
                      className={cn(
                        "grid items-center gap-0 px-[18px] py-[15px]",
                        gridCols
                      )}
                    >
                      {showCheckboxes && (
                        <span
                          className="pr-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleOne(project.id)}
                            aria-label={`Select project ${project.projectName}`}
                          />
                        </span>
                      )}
                      <div className="flex min-w-0 items-center gap-[14px]">
                        <span
                          aria-hidden
                          className="size-10 shrink-0 overflow-hidden rounded-full transition duration-300 group-hover:scale-[1.08]"
                          style={{
                            boxShadow:
                              "0 0 0 1px rgba(20,20,26,.08),0 6px 14px -8px rgba(20,20,26,.3)"
                          }}
                        >
                          <CustomerAvatar index={index} className="size-full" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-[#16161a]">
                            {project.customerName}
                          </div>
                          <div className="truncate text-[12.5px] text-[#86867f]">
                            {project.projectName}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span
                          data-project-status={project.status}
                          data-status-tone={status.tone}
                          className={cn(
                            "inline-flex min-h-[22px] items-center rounded-full px-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em]",
                            status.tone === "success" &&
                              "border border-studio-ink/15 bg-studio-ink/[0.06] text-studio-ink",
                            status.tone === "action" &&
                              "bg-studio-action text-studio-action-ink",
                            status.tone === "muted" &&
                              "border border-white/80 bg-white/60 text-studio-muted"
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="text-right font-mono text-[11.5px] text-[#86867f]">
                        {formatUpdated(project.updatedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="studio-glass flex min-h-64 flex-col items-center justify-center rounded-studio-panel px-6 py-12 text-center">
            <h2 className="text-[18px] font-semibold text-[#16161a]">
              No projects yet
            </h2>
            <p className="mt-2 max-w-md text-[13px] leading-5 text-[#86867f]">
              Create your first project to get started.
            </p>
            <Link href="/projects/new" className={cn(CTA, "mt-5")} style={CTA_STYLE}>
              <span className="text-[16px] leading-none">+</span>New project
            </Link>
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !deleting && setConfirmOpen(open)}>
        <DialogContent className="w-[min(92vw,420px)]">
          <div className="flex flex-col gap-5 rounded-studio-panel border border-studio-line bg-studio-shell p-6 text-studio-ink shadow-[0_30px_70px_-28px_rgba(20,20,26,0.55)]">
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-studio-danger/10 text-studio-danger"
              >
                <TrashIcon className="size-5" />
              </span>
              <div className="space-y-1.5">
                <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em] text-studio-ink">
                  Delete {selectedIds.size} project
                  {selectedIds.size === 1 ? "" : "s"}?
                </DialogTitle>
                <DialogDescription className="text-[13px] leading-5 text-studio-muted">
                  This permanently removes the selected project
                  {selectedIds.size === 1 ? "" : "s"} and all related data. This
                  can&rsquo;t be undone.
                </DialogDescription>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={deleting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={handleDeleteSelected}
              >
                <TrashIcon aria-hidden />
                {deleting ? "Deleting" : `Delete ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
