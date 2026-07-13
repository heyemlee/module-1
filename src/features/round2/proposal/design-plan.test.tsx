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
    expect(html).toContain('data-plan-corner-glyph="TL"');
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
    // The body reservation duplicates the corner square already covered by
    // the blind cabinet's rectangle, so it keeps its dimension but no rect.
    expect(html).not.toContain('data-segment-id="left-blind-body"');
    expect(html).toContain('data-chain-label="left-blind-body"');
    expect(html).toContain('data-segment-id="left-blind-pull"');
  });

  test("renders the diagonal upper corner as a chamfered pentagon at upper depth", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [
          upperSegment("top-upper-corner-lazy", 24, "cabinet", "WDC24"),
          upperSegment("top-upper-run", 36, "cabinet", "W36"),
          segment("top-lazy-susan", 36, "cabinet", "LS36")
        ]),
        wall("B", "LEFT", [
          upperSegment("left-upper-corner-lazy-return", 24, "gap", "WDC24 return"),
          segment("left-lazy-return", 36, "gap", "LS36 return")
        ])
      ])
    );

    const pentagon = tagFor(html, "path", 'data-plan-upper-corner="TL"');
    // 24″ along each wall at 12″ upper depth with a chamfered front:
    // (162,132) → +91.2 → depth 26 → chamfer → close.
    expect(pentagon).toContain("M 162 132");
    expect(pentagon).toContain("L 253.2 132");
    expect(pentagon).toContain("L 253.2 158");
    expect(pentagon).toContain("L 188 198.2");
    expect(pentagon).toContain('stroke-dasharray="5 3"');
    // The diagonal cabinet must not double-draw as a straight dashed rect.
    const overlays = html.match(/data-plan-upper="cabinet"/g) ?? [];
    expect(overlays).toHaveLength(1);
  });

  test("annotates base and upper cabinet depth per wall", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-base", 36, "cabinet", "B36")])
      ])
    );

    const depth = tagFor(html, "g", 'data-plan-depth-wall="A"');
    expect(depth).toContain('stroke="#079ca5"');
    expect(html).toContain('data-plan-depth-base="A"');
    expect(html).toContain('data-plan-depth-upper="A"');
    // Base 24″ and upper 12″ read from the standards.
    const base = tagFor(html, "text", 'data-plan-depth-base="A"');
    expect(html.slice(html.indexOf(base))).toContain("24″");
    const upper = tagFor(html, "text", 'data-plan-depth-upper="A"');
    expect(html.slice(html.indexOf(upper))).toContain("12″");
  });

  test("omits the depth callout on a wall with no base cabinets", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-opening", 30, "opening", "Window")])
      ])
    );

    expect(html).not.toContain('data-plan-depth-wall="A"');
  });

  test("keeps upper fillers visible in the dashed projection", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [
          upperSegment("top-upper-cabinet", 36, "cabinet", "W36"),
          upperSegment("top-upper-filler", 4, "filler", "F4")
        ])
      ])
    );

    expect(html).toContain('data-plan-upper="filler"');
  });

  test("annotates segments with dimension chains instead of code labels", () => {
    const html = render(
      modelWithSegments([
        wall("A", "TOP", [segment("top-blind-base", 45, "cabinet", "BB45")])
      ])
    );

    const label = tagFor(html, "text", 'data-chain-label="top-blind-base"');
    expect(html.slice(html.indexOf(label))).toContain("45″");
    const overall = tagFor(html, "text", 'data-plan-overall-label="A"');
    expect(html.slice(html.indexOf(overall))).toContain("A · 120″");
    expect(html).not.toContain("data-display-label");
    // Codes survive only as hover tooltips, never as drawn text.
    expect(html).toContain("<title>BB45</title>");
    expect(html).not.toContain("BB45</text>");
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

function upperSegment(
  id: string,
  inches: number,
  kind: WallSegment["kind"],
  label: string
): WallSegment {
  return {
    ...segment(id, inches, kind, label),
    tier: "upper",
    cabinetKind: kind === "cabinet" ? "upper" : undefined,
    sourceCornerId: id.includes("corner") ? "TL" : undefined
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
