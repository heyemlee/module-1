import type { ProjectStatus } from "@/server/platform/types";

export type ProjectStatusTone = "muted" | "success" | "action";

const STATUS_PRESENTATION: Record<
  ProjectStatus,
  { label: string; tone: ProjectStatusTone }
> = {
  INTAKE: { label: "Intake", tone: "muted" },
  RENDERING_READY: { label: "Rendering ready", tone: "success" },
  ROUND2_MEASURING: { label: "Round 2 measuring", tone: "action" },
  ARCHIVED: { label: "Archived", tone: "muted" }
};

export function projectStatusPresentation(status: ProjectStatus) {
  return STATUS_PRESENTATION[status];
}

export function projectDashboardCounts(
  projects: ReadonlyArray<{ status: ProjectStatus }>
) {
  return {
    active: projects.filter((project) => project.status !== "ARCHIVED").length,
    intake: projects.filter((project) => project.status === "INTAKE").length,
    renderingReady: projects.filter(
      (project) => project.status === "RENDERING_READY"
    ).length
  };
}

export function projectNextAction(input: {
  hasRound1State: boolean;
  hasSnapshot: boolean;
  hasRendering: boolean;
}): {
  label: string;
  destination: "round1" | "renderings";
} {
  if (input.hasRendering) {
    return { label: "Review renderings", destination: "renderings" };
  }
  if (input.hasSnapshot) {
    return { label: "Generate rendering", destination: "round1" };
  }
  if (input.hasRound1State) {
    return { label: "Continue Round 1", destination: "round1" };
  }
  return { label: "Start Round 1", destination: "round1" };
}
