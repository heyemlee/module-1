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
        {/* Workflow */}
        <section>
          <h2 className="text-[16px] font-semibold text-studio-ink">Workflow progress</h2>
          <div className="mt-4 rounded-studio-panel border border-studio-line bg-studio-shell px-6 py-2">
            <div className="flex items-center justify-between border-b border-studio-line py-4">
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Project created</p>
                <p className="mt-1 text-[13px] text-studio-muted">Workspace initialized</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">Completed</span>
            </div>
            <div className="flex items-center justify-between border-b border-studio-line py-4">
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Round 1 state</p>
                <p className="mt-1 text-[13px] text-studio-muted">Customer preferences</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">
                {progress.hasRound1State ? "Saved" : "Not started"}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-[14px] font-medium text-studio-ink">Round 1 snapshot</p>
                <p className="mt-1 text-[13px] text-studio-muted">Measured room envelope</p>
              </div>
              <span className="text-[12px] font-medium text-studio-quiet">
                {progress.hasSnapshot ? "Captured" : "Not captured"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-studio-panel border border-studio-line bg-studio-void px-6 py-4">
            <div>
              <p className="text-[14px] font-medium text-studio-ink">Round 2</p>
              <p className="mt-1 text-[13px] text-studio-muted">Reserved for detailed measured design</p>
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
