import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import { DesignPlan } from "./design-plan";

describe("DesignPlan", () => {
  test("renders blind-corner gap footprints at the adjacent wall corner", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-blind-base", 45, "cabinet", "BB45")]),
        wall("B", "LEFT", [
          segment("left-blind-body", 24, "gap", "Blind corner"),
          segment("left-blind-pull", 3, "filler", "F3")
        ])
      ])
    );

    const rect = rectForSegment(html, "left-blind-body");

    expect(html).toContain('data-plan-corner-gap="true"');
    expect(html).toContain('data-display-label="BLIND"');
    expect(rect.x).toBe(162);
    expect(rect.y).toBe(132);
  });

  test("draws bottom wall runs from left to right like the measured model", () => {
    const html = render(
      modelWithSegments([
        wall("A", "BOTTOM", [segment("bottom-start", 24, "cabinet", "B24")])
      ])
    );

    const rect = rectForSegment(html, "bottom-start");

    expect(rect.x).toBe(162);
  });
});

function render(model: Round2Model): string {
  return renderToStaticMarkup(
    <DesignPlan model={model} selectedObjectId={null} onSelect={() => {}} />
  );
}

function rectForSegment(
  html: string,
  segmentId: string
): { x: number; y: number } {
  const groupStart = html.indexOf(`data-segment-id="${segmentId}"`);
  expect(groupStart).toBeGreaterThan(-1);
  const segmentHtml = html.slice(groupStart);
  const match = segmentHtml.match(/<rect x="([^"]+)" y="([^"]+)"/);
  expect(match).not.toBeNull();
  return {
    x: Number(match?.[1]),
    y: Number(match?.[2])
  };
}

function modelWithSegments(walls: Round2Model["walls"]): Round2Model {
  return {
    ceilingHeightSixteenths: 96 * 16,
    decisionItems: [],
    walls
  };
}

function wall(
  id: string,
  sourceWall: Round2Model["walls"][number]["sourceWall"],
  segments: WallSegment[]
): Round2Model["walls"][number] {
  return {
    id,
    label: id,
    sourceWall,
    lengthSixteenths: 120 * 16,
    fixedPoints: [],
    notes: [],
    segments: segments.map((segment) => ({ ...segment, wallId: id }))
  };
}

function segment(
  id: string,
  inches: number,
  kind: WallSegment["kind"],
  label: string
): WallSegment {
  return {
    id,
    wallId: "pending",
    tier: "base",
    kind,
    widthSixteenths: inches * 16,
    label,
    cabinetKind: kind === "cabinet" ? "corner" : undefined,
    sourceCornerId: id.includes("blind") ? "TL" : undefined
  };
}
