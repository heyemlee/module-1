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

  test("keeps upper cabinet width-chain labels above the cabinet box", () => {
    const model = elevationModel(
      [
        { ...cabinet("upper-left", 36 * 16), tier: "upper" },
        { ...cabinet("upper-right", 36 * 16), tier: "upper" }
      ],
      42 * 16,
      100 * 16
    );
    const html = render(model);
    const upperTop = rectForSegment(html, "upper-left").y;
    const labelY = chainLabelY(html, "upper-left");

    expect(labelY).toBeLessThanOrEqual(upperTop - 14);
  });

  test("keeps upper cabinet width-chain labels on one baseline", () => {
    const model = elevationModel([
      { ...cabinet("upper-left", 33 * 16), tier: "upper" },
      { ...cabinet("upper-filler", 3 * 16, "filler"), tier: "upper" },
      { ...cabinet("upper-center", 30 * 16), tier: "upper" },
      { ...cabinet("upper-right", 24 * 16), tier: "upper" }
    ]);
    const html = render(model);

    const labelYs = [
      chainLabelY(html, "upper-left"),
      chainLabelY(html, "upper-filler"),
      chainLabelY(html, "upper-center"),
      chainLabelY(html, "upper-right")
    ];

    expect(new Set(labelYs).size).toBe(1);
  });

  test("uses compact in-box labels for narrow corner clearance segments", () => {
    const model = elevationModel([
      {
        ...cabinet("corner-clearance", 12 * 16, "gap"),
        label: "Corner clearance",
        sourceCornerId: "TL"
      },
      {
        ...cabinet("dead-corner", 12 * 16, "gap"),
        label: "Dead corner",
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

    expect(html).toContain('data-display-label="CLEAR"');
    expect(html).toContain('data-display-label="DEAD"');
    expect(html).toContain('data-display-label="BLIND"');
    expect(html).toContain("<title>Corner clearance</title>");
    expect(html).toContain("<title>Dead corner</title>");
    expect(html).toContain("<title>Blind corner</title>");
    for (const label of ["CLEAR", "DEAD", "BLIND"]) {
      expect(html).toMatch(
        new RegExp(
          `data-display-label="${label}"[^>]*font-size="8"[^>]*letter-spacing="0.08em"[^>]*fill="#5d6b64"`
        )
      );
    }
    expect(html).not.toMatch(/<text[^>]*>Corner clearance<\/text>/);
    expect(html).not.toMatch(/<text[^>]*>Dead corner<\/text>/);
    expect(html).not.toMatch(/<text[^>]*>Blind corner<\/text>/);
  });

  test("identifies appliance cabinets with glyphs and role tags", () => {
    const model = elevationModel([
      {
        ...cabinet("a-fridge", 36 * 16, "appliance"),
        label: "REF36",
        cabinetKind: "tall",
        sourceFixedPointId: "top-appliance-fridge"
      },
      {
        ...cabinet("a-sink", 36 * 16, "appliance"),
        label: "SB36",
        cabinetKind: "sink",
        sourceFixedPointId: "top-appliance-sink"
      },
      {
        ...cabinet("a-dw", 24 * 16, "appliance"),
        label: "DW24",
        sourceFixedPointId: "top-appliance-dishwasher"
      },
      {
        ...cabinet("a-range", 30 * 16, "appliance"),
        label: "RNG30",
        sourceFixedPointId: "top-appliance-range"
      },
      cabinet("a-b24", 24 * 16)
    ]);
    model.walls[0].fixedPoints = (
      ["fridge", "sink", "dishwasher", "range"] as const
    ).map((symbol, index) => ({
      id: `top-appliance-${symbol}`,
      type: "appliance",
      label: symbol,
      sourceWall: "TOP",
      order: index,
      positionRatio: index / 4,
      symbol
    }));
    const html = render(model);

    for (const role of ["fridge", "sink", "dishwasher", "range"]) {
      expect(html).toContain(`data-appliance-role="${role}"`);
      expect(html).toContain(`data-role-tag="${role}"`);
    }
    // The sink base keeps its door face under the faucet glyph.
    expect(html).toContain('data-face="double-door"');
    // The fridge is a tall unit, so it carries its own overall height dimension.
    expect(html).toContain('data-elevation-layer="tall-height"');
  });

  test("draws window sash lines on window opening segments", () => {
    const model = elevationModel([
      cabinet("a-b30", 30 * 16),
      {
        ...cabinet("a-window", 36 * 16, "opening"),
        tier: "upper",
        label: "Window",
        sourceFixedPointId: "top-window"
      },
      cabinet("a-b36", 36 * 16)
    ]);
    model.walls[0].fixedPoints = [
      {
        id: "top-window",
        type: "window",
        label: "Window",
        sourceWall: "TOP",
        order: 0.5,
        positionRatio: 0.5
      }
    ];
    const html = render(model);

    expect(html).toContain('data-glyph="window"');
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

function chainLabelY(html: string, segmentId: string): number {
  const tag = html.match(
    new RegExp(`<text(?=[^>]*data-chain-label="${segmentId}")[^>]*>`)
  );
  expect(tag).not.toBeNull();
  const y = tag?.[0].match(/\sy="([^"]+)"/);
  expect(y).not.toBeNull();
  return Number(y?.[1]);
}

function elevationModel(
  segments?: WallSegment[],
  upperHeightSixteenths = 36 * 16,
  ceilingHeightSixteenths = 96 * 16
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
    ceilingHeightSixteenths,
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
