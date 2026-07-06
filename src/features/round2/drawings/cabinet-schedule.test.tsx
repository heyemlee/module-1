import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import { CabinetSchedule } from "./cabinet-schedule";

describe("CabinetSchedule", () => {
  test("adds a FRONT column resolved from the front configuration", () => {
    const html = renderToStaticMarkup(
      <CabinetSchedule
        model={scheduleModel()}
        customerName="Customer"
        projectName="Project"
        measurementVersion={1}
        proposalVersion={1}
      />
    );

    expect(html).toContain("FRONT");
    expect(html).toContain("2 doors");
    expect(html).toContain("3 drawers");
    expect(html).toContain("1 door + trash pullout");
  });

  test("keeps front exceptions visible in the schedule", () => {
    const model = scheduleModel();
    model.walls[0].segments[0].front = { doorCount: 1 };
    const html = renderToStaticMarkup(
      <CabinetSchedule
        model={model}
        customerName="Customer"
        projectName="Project"
        measurementVersion={1}
        proposalVersion={1}
      />
    );

    expect(html).toContain("1 door</td>");
  });
});

function segment(overrides: Partial<WallSegment> & { id: string }): WallSegment {
  return {
    wallId: "A",
    tier: "base",
    kind: "cabinet",
    widthSixteenths: 30 * 16,
    label: "B30",
    cabinetKind: "base",
    ...overrides
  };
}

function scheduleModel(): Round2Model {
  return {
    ceilingHeightSixteenths: 96 * 16,
    decisionItems: [],
    walls: [
      {
        id: "A",
        label: "A",
        sourceWall: "TOP",
        lengthSixteenths: 96 * 16,
        fixedPoints: [],
        notes: [],
        segments: [
          segment({ id: "a-1", code: "#1" }),
          segment({
            id: "a-2",
            code: "#2",
            label: "DB24",
            widthSixteenths: 24 * 16
          }),
          segment({
            id: "a-3",
            code: "#3",
            label: "WB18",
            widthSixteenths: 18 * 16
          }),
          segment({
            id: "a-4",
            code: "F1",
            kind: "filler",
            label: "F24",
            widthSixteenths: 24 * 16,
            cabinetKind: undefined
          })
        ]
      }
    ]
  };
}
