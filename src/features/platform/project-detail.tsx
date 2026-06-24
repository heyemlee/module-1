import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/server/platform/project-repository";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioSection
} from "./studio-page";
import {
  projectNextAction,
  projectStatusPresentation
} from "./project-presentation";

export function ProjectDetail({
  project,
  progress
}: {
  project: ProjectSummary;
  progress: {
    hasRound1State: boolean;
    hasSnapshot: boolean;
    latestRendering: {
      id: string;
      createdAt: string;
    } | null;
  };
}) {
  const status = projectStatusPresentation(project.status);
  const nextAction = projectNextAction({
    hasRound1State: progress.hasRound1State,
    hasSnapshot: progress.hasSnapshot,
    hasRendering: Boolean(progress.latestRendering)
  });
  const nextHref =
    nextAction.destination === "renderings"
      ? `/projects/${project.id}/renderings`
      : `/projects/${project.id}/round1`;

  const metaPill = (
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
  );

  return (
    <StudioPage>
      <StudioPageHeader
        title={project.projectName}
        description={project.customerName}
        meta={metaPill}
        action={
          <Button asChild size="lg">
            <Link href={nextHref}>{nextAction.label}</Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
        {/* Project Phases */}
        <section>
          <h2 className="text-[16px] font-semibold text-studio-ink">Project phases</h2>
          <div className="mt-4 flex flex-col rounded-studio-panel border border-studio-line bg-studio-shell">
            <Link
              href={`/projects/${project.id}/round1`}
              className="group flex items-center justify-between border-b border-studio-line px-6 py-4 transition-colors hover:bg-black/[0.02]"
            >
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Round 1</p>
                <p className="mt-1 text-[13px] text-studio-muted">Showroom preferences and measurements</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">
                {project.status === "INTAKE" ? "In progress" : "Completed"}
              </span>
            </Link>
            <Link
              href={`/projects/${project.id}/renderings`}
              className="group flex items-center justify-between border-b border-studio-line px-6 py-4 transition-colors hover:bg-black/[0.02]"
            >
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Rendering</p>
                <p className="mt-1 text-[13px] text-studio-muted">Concept visualizations</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">
                {progress.latestRendering ? "Completed" : "Pending"}
              </span>
            </Link>
            <div className="flex items-center justify-between px-6 py-4 opacity-60">
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Round 2</p>
                <p className="mt-1 text-[13px] text-studio-muted">Detailed measured design</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">
                {project.status === "ROUND2_MEASURING" ? "In progress" : "Pending"}
              </span>
            </div>
          </div>
        </section>

        {/* Latest Rendering */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-studio-ink">Latest concept</h2>
            {progress.latestRendering && (
              <Button asChild variant="link" className="h-auto p-0 text-[13px]">
                <Link href={`/projects/${project.id}/renderings`}>View history</Link>
              </Button>
            )}
          </div>
          <StudioSection className="mt-4 overflow-hidden">
            {progress.latestRendering ? (
              <Link
                href={`/projects/${project.id}/renderings`}
                className="group block"
              >
                <img
                  src={`/api/projects/${project.id}/round1/renderings/${progress.latestRendering.id}/image`}
                  alt="Latest concept rendering"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </Link>
            ) : (
              <StudioEmptyState
                title="No rendering available"
                description="Complete the Round 1 intake and capture a snapshot to generate the first concept."
                className="min-h-[300px]"
              />
            )}
          </StudioSection>
        </section>
      </div>
    </StudioPage>
  );
}
