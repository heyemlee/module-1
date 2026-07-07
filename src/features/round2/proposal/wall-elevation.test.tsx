import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import { WallElevation } from "./wall-elevation";

describe("WallElevation", () => {
  test("renders fronts from the resolved configuration", () => {
    const html = render(elevationModel());

    // B30 ≥ double-door threshold, B18 is a single door, DB18 is a stack.
    expect(html).toContain('data-face="double-door"');
    expect(html).toContain('data-face="single-door"');
    expect(html).toContain('data-face="drawers"');
  });

  test("exposes every run segment as a clickable width-chain label", () => {
    const model = elevationModel();
    const html = render(model);

    for (const segment of model.walls[0].segments) {
      expect(html).toContain(`data-chain-label="${segment.id}"`);
    }
  });

  test("staggers narrow chain labels onto leader lanes", () => {
    const model = elevationModel([
      cabinet("wide-1", 60 * 16),
      cabinet("narrow-1", 2 * 16, "filler"),
      cabinet("narrow-2", 2 * 16, "filler"),
      cabinet("wide-2", 56 * 16)
    ]);
    const html = render(model);

    // Two adjacent narrow fillers land on different lanes → leader lines.
    expect(html).toContain('data-elevation-layer="width-chain"');
    const labelYs = [...html.matchAll(/data-chain-label="[^"]+" x="[^"]+" y="([\d.]+)"/g)].map(
      (match) => Number(match[1])
    );
    expect(new Set(labelYs).size).toBeGreaterThan(1);
  });

  test("uses compact in-box labels for narrow corner clearance segments", () => {
    const model = elevationModel([
      {
        ...cabinet("corner-clearance", 6 * 16, "gap"),
        label: "Corner clearance",
        sourceCornerId: "TL"
      },
      {
        ...cabinet("blind-corner", 12 * 16, "gap"),
        label: "Blind corner",
        sourceCornerId: "TL"
      },
      cabinet("wide-1", 102 * 16)
    ]);
    const html = render(model);

    expect(html).toContain('data-display-label="CLR"');
    expect(html).toContain('data-display-label="BLIND"');
    expect(html).toContain("<title>Corner clearance</title>");
    expect(html).toContain("<title>Blind corner</title>");
    expect(html).not.toMatch(/<text[^>]*>Corner clearance<\/text>/);
    expect(html).not.toMatch(/<text[^>]*>Blind corner<\/text>/);
  });

  test("scales the vertical layout from the height profile", () => {
    const shortUppers = render(elevationModel(undefined, 30 * 16));
    const tallUppers = render(elevationModel(undefined, 42 * 16));

    expect(shortUppers).toContain("30″");
    expect(tallUppers).toContain("42″");
    expect(shortUppers).not.toBe(tallUppers);
  });
});

function render(model: Round2Model): string {
  return renderToStaticMarkup(
    <WallElevation
      wallId="A"
      model={model}
      selectedObjectId={null}
      onSelect={() => {}}
    />
  );
}

function cabinet(
  id: string,
  widthSixteenths: number,
  kind: WallSegment["kind"] = "cabinet"
): WallSegment {
  return {
    id,
    wallId: "A",
    tier: "base",
    kind,
    widthSixteenths,
    label:
      kind === "filler"
        ? `F${Math.round(widthSixteenths / 16)}`
        : `B${Math.round(widthSixteenths / 16)}`,
    cabinetKind: kind === "cabinet" ? "base" : undefined
  };
}

function elevationModel(
  segments?: WallSegment[],
  upperHeightSixteenths = 36 * 16
): Round2Model {
  const base = segments ?? [
    cabinet("a-base-1", 30 * 16),
    cabinet("a-base-2", 18 * 16),
    { ...cabinet("a-base-3", 18 * 16), label: "DB18" },
    cabinet("a-base-4", 54 * 16, "filler")
  ];
  const length = base.reduce(
    (sum, segment) => sum + segment.widthSixteenths,
    0
  );
  return {
    ceilingHeightSixteenths: 96 * 16,
    heightProfile: {
      counterSixteenths: 36 * 16,
      backsplashSixteenths: 18 * 16,
      upperHeightSixteenths,
      mouldingSixteenths: 3 * 16
    },
    decisionItems: [],
    walls: [
      {
        id: "A",
        label: "A",
        sourceWall: "TOP",
        lengthSixteenths: length,
        fixedPoints: [],
        notes: [],
        segments: base
      }
    ]
  };
}
