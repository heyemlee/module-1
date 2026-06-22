import Link from "next/link";
import { ClipboardList, ImageIcon, Lock } from "lucide-react";
import type { ProjectSummary } from "@/server/platform/project-repository";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "./logout-button";

export function ProjectDetail({ project }: { project: ProjectSummary }) {
  return (
    <PageShell width="max-w-5xl" backHref="/projects" backLabel="Back to projects" actions={<LogoutButton />}>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.customerName}</h1>
        <Badge tone="neutral">{project.status}</Badge>
      </div>
      <p className="text-muted-foreground">{project.projectName}</p>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <Link
          href={`/projects/${project.id}/round1`}
          className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
        >
          <ClipboardList size={20} className="text-primary" />
          <h2 className="mt-3 font-semibold">Round 1 Intake</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Showroom intake, rough layout, snapshot, and rendering.</p>
        </Link>
        <Link
          href={`/projects/${project.id}/renderings`}
          className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
        >
          <ImageIcon size={20} className="text-primary" />
          <h2 className="mt-3 font-semibold">Renderings</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Saved Round 1 concept images for this project.</p>
        </Link>
        <div className="rounded-lg border border-dashed border-border bg-surface p-5 opacity-70">
          <Lock size={20} className="text-subtle-foreground" />
          <h2 className="mt-3 font-semibold">Round 2</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Reserved for detailed measured design.</p>
        </div>
      </section>
    </PageShell>
  );
}
