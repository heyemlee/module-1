import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import { DesignPlan } from "./design-plan";

describe("DesignPlan", () => {
  test("renders lazy Susan reservations as a connected right-angle footprint", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-lazy-susan", 36, "cabinet", "LS36")]),
        wall("B", "LEFT", [
          segment("left-lazy-return", 36, "gap", "LS36 return")
        ])
      ])
    );

    const path = tagFor(html, "path", 'data-plan-corner-footprint="TL"');

    expect(path).toContain('data-plan-corner-walls="TOP,LEFT"');
    expect(path).toContain("M 162 132");
    expect(path).toContain("L 298.8 132");
    expect(path).toContain("L 214 231.3");
    expect(html).toContain('data-display-label="LS36"');
    expect(html).toContain('data-segment-id="top-lazy-susan"');
    expect(html).not.toContain('data-segment-id="left-lazy-return"');
  });

  test("renders blind-base corner strategy as straight wall segments", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-blind-base", 45, "cabinet", "BB45")]),
        wall("B", "LEFT", [
          segment("left-blind-body", 24, "gap", "Blind corner"),
          segment("left-blind-pull", 3, "filler", "F3")
        ])
      ])
    );

    expect(html).not.toContain('data-plan-corner-footprint="TL"');
    expect(html).toContain('data-segment-id="top-blind-base"');
    expect(html).toContain('data-segment-id="left-blind-body"');
    expect(html).toContain('data-segment-id="left-blind-pull"');
    expect(html).toContain('data-display-label="BB45"');
    expect(html).toContain('data-display-label="BLIND"');
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

function tagFor(
  html: string,
  tagName: string,
  attribute: string
): string {
  const match = html.match(
    new RegExp(`<${tagName}(?=[^>]*${escapeRegExp(attribute)})[^>]*>`)
  );
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    sourceCornerId:
      id.includes("lazy") ||
      id.includes("blind") ||
      id.includes("clearance") ||
      id.includes("dead")
        ? "TL"
        : undefined
  };
}
