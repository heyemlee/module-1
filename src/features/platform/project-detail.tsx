import Link from "next/link";
import type { ProjectSummary } from "@/server/platform/project-repository";
import { LogoutButton } from "./logout-button";

export function ProjectDetail({ project }: { project: ProjectSummary }) {
  return (
    <main className="app-page px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="text-sm font-semibold text-[var(--app-blue)]">Back to projects</Link>
          <LogoutButton />
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-normal text-[var(--app-ink)]">{project.customerName}</h1>
        <p className="mt-2 text-[var(--app-muted)]">{project.projectName}</p>
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Link href={`/projects/${project.id}/round1`} className="app-panel p-4 transition hover:-translate-y-0.5">
            <h2 className="font-semibold">Round 1 Intake</h2>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Showroom intake, rough layout, snapshot, and rendering.</p>
          </Link>
          <Link href={`/projects/${project.id}/renderings`} className="app-panel p-4 transition hover:-translate-y-0.5">
            <h2 className="font-semibold">Renderings</h2>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Saved Round 1 concept images for this project.</p>
          </Link>
          <div className="app-panel-flat p-4 opacity-70">
            <h2 className="font-semibold">Round 2</h2>
            <p className="mt-2 text-sm text-[var(--app-muted)]">Reserved for detailed measured design.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
