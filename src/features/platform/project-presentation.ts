import type { ProjectStatus } from "@/server/platform/types";

export type ProjectStatusTone = "muted" | "success" | "action";

const STATUS_PRESENTATION: Record<
  ProjectStatus,
  { label: string; tone: ProjectStatusTone }
> = {
  INTAKE: { label: "Concept", tone: "muted" },
  RENDERING_READY: { label: "Concept Ready", tone: "success" },
  ROUND2_MEASURING: { label: "Technical Design", tone: "action" },
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
  hasBasis: boolean;
}): {
  label: string;
  destination: "round1" | "renderings" | "round2";
} {
  if (input.hasBasis) {
    return { label: "Open technical design", destination: "round2" };
  }
  if (input.hasRendering) {
    return { label: "Confirm proposal", destination: "renderings" };
  }
  if (input.hasSnapshot) {
    return { label: "Generate rendering", destination: "round1" };
  }
  if (input.hasRound1State) {
    return { label: "Continue concept", destination: "round1" };
  }
  return { label: "Start concept", destination: "round1" };
}
