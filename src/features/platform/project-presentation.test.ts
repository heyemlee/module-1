import { describe, expect, test } from "vitest";
import {
  projectDashboardCounts,
  projectNextAction,
  projectStatusPresentation
} from "./project-presentation";

describe("project presentation", () => {
  test("derives dashboard counts from real statuses", () => {
    const counts = projectDashboardCounts([
      { status: "INTAKE" },
      { status: "RENDERING_READY" },
      { status: "ROUND2_MEASURING" },
      { status: "ARCHIVED" }
    ]);

    expect(counts).toEqual({
      active: 3,
      intake: 1,
      renderingReady: 1
    });
  });

  test("maps every project status to one Studio tone", () => {
    expect(projectStatusPresentation("INTAKE")).toEqual({
      label: "Intake",
      tone: "muted"
    });
    expect(projectStatusPresentation("RENDERING_READY").tone).toBe("success");
    expect(projectStatusPresentation("ROUND2_MEASURING").tone).toBe("action");
    expect(projectStatusPresentation("ARCHIVED").tone).toBe("muted");
  });

  test("selects the next action from persisted project progress", () => {
    expect(
      projectNextAction({
        hasRound1State: false,
        hasSnapshot: false,
        hasRendering: false
      })
    ).toEqual({ label: "Start Round 1", destination: "round1" });

    expect(
      projectNextAction({
        hasRound1State: true,
        hasSnapshot: true,
        hasRendering: false
      })
    ).toEqual({ label: "Generate rendering", destination: "round1" });

    expect(
      projectNextAction({
        hasRound1State: true,
        hasSnapshot: true,
        hasRendering: true
      })
    ).toEqual({ label: "Review renderings", destination: "renderings" });
  });
});
