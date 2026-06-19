import Link from "next/link";
import type { ProjectSummary } from "@/server/platform/project-repository";

export function ProjectDetail({ project }: { project: ProjectSummary }) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-5xl">
        <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
        <h1 className="mt-4 text-2xl font-semibold">{project.customerName}</h1>
        <p className="text-stone-700">{project.projectName}</p>
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Link href={`/projects/${project.id}/round1`} className="rounded border border-stone-300 bg-white p-4">
            <h2 className="font-semibold">Round 1 Intake</h2>
            <p className="mt-2 text-sm text-stone-600">Showroom intake, rough layout, snapshot, and rendering.</p>
          </Link>
          <div className="rounded border border-stone-300 bg-white p-4">
            <h2 className="font-semibold">Renderings</h2>
            <p className="mt-2 text-sm text-stone-600">Saved concept images appear after Round 1 generation.</p>
          </div>
          <div className="rounded border border-stone-300 bg-white p-4 opacity-70">
            <h2 className="font-semibold">Round 2</h2>
            <p className="mt-2 text-sm text-stone-600">Reserved for detailed measured design.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
