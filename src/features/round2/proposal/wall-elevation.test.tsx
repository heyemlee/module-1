import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import {
  canEditSegmentKind,
  KIND_OPTIONS,
  WallElevation
} from "./wall-elevation";

describe("WallElevation", () => {
  test("keeps the editor header on a solid background above the grid", () => {
    const html = render(elevationModel());

    expect(html).toContain('data-elevation-layer="header"');
    expect(html).toMatch(
      /data-elevation-layer="header"[^>]*bg-white/
    );
  });

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

  test("keeps overall and upper dimensions above the ceiling line", () => {
    const model = elevationModel([
      { ...cabinet("upper-left", 33 * 16), tier: "upper" },
      { ...cabinet("upper-center", 30 * 16), tier: "upper" },
      { ...cabinet("upper-right", 57 * 16), tier: "upper" }
    ]);
    const html = render(model);

    // CEILING_Y is 62: every dimension drawn above the run must clear it.
    expect(overallLabelY(html)).toBeLessThan(30);
    expect(overallGuideY(html)).toBeLessThan(40);
    expect(chainLabelY(html, "upper-center")).toBeLessThan(50);
    expect(chainGuideY(html, "upper-center")).toBeLessThan(55);
  });

  test("points upper chain guide ticks toward the cabinets opposite the base guide", () => {
    const model = elevationModel([
      { ...cabinet("upper-wide", 60 * 16), tier: "upper" },
      cabinet("base-wide", 60 * 16)
    ]);
    const html = render(model);

    const upperTick = chainGuideTick(html, "upper-wide");
    const baseTick = chainGuideTick(html, "base-wide");

    expect(upperTick.endY).toBeGreaterThan(upperTick.startY);
    expect(baseTick.endY).toBeLessThan(baseTick.startY);
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

  test("draws width-chain guide linework for unstaggered upper and lower labels", () => {
    const model = elevationModel([
      { ...cabinet("upper-left", 60 * 16), tier: "upper" },
      { ...cabinet("upper-right", 60 * 16), tier: "upper" },
      cabinet("base-left", 60 * 16),
      cabinet("base-right", 60 * 16)
    ]);
    const html = render(model);

    for (const segmentId of ["upper-left", "upper-right", "base-left", "base-right"]) {
      expect(html).toContain(`data-chain-guide="${segmentId}"`);
    }
  });

  test("uses the overall dimension style for segment and height dimensions", () => {
    const html = render(elevationModel());

    const chainLabel = tagFor(html, "text", 'data-chain-label="a-base-1"');
    const chainGuide = tagFor(html, "path", 'data-chain-guide="a-base-1"');

    expect(chainLabel).toContain('font-size="11"');
    expect(chainLabel).toContain('fill="#079ca5"');
    expect(chainGuide).toContain('stroke-width="2"');
    expect(html).toMatch(/data-elevation-layer="height-chain"[\s\S]*font-size="11"/);
  });

  test("bolds every dimension label consistently", () => {
    // Labels were standardized to a single bold weight (commit f7df17b) so
    // overall/ceiling no longer stand out from per-segment counter/upper.
    const html = render(elevationModel());
    const overall = tagFor(html, "text", 'data-chain-label="overall"');
    const ceiling = tagFor(html, "text", 'data-height-label="ceiling"');
    const counter = tagFor(html, "text", 'data-height-label="counter"');
    const upper = tagFor(html, "text", 'data-height-label="upper"');

    expect(overall).toContain('font-weight="bold"');
    expect(ceiling).toContain('font-weight="bold"');
    expect(counter).toContain('font-weight="bold"');
    expect(upper).toContain('font-weight="bold"');
    expect(counter).toContain('font-size="11"');
    expect(upper).toContain('font-size="11"');
    expect(counter).toContain('fill="#079ca5"');
    expect(upper).toContain('fill="#079ca5"');
    expect(counter).toContain('stroke="none"');
    expect(upper).toContain('stroke="none"');
  });

  test("does not render cabinet swing lines for F-coded filler panels", () => {
    const model = elevationModel([
      cabinet("base-left", 48 * 16),
      { ...cabinet("f-coded-filler", 12 * 16), label: "F13", code: "F13" }
    ]);
    const html = render(model);
    const fillerHtml = segmentMarkup(html, "f-coded-filler");

    expect(fillerHtml).not.toContain('data-face="');
    expect(fillerHtml).toContain('data-display-label="F13"');
  });

  test("renders segment fills opaque and keeps filler panels light", () => {
    const model = elevationModel([
      cabinet("base-left", 48 * 16),
      { ...cabinet("light-filler", 12 * 16, "filler"), label: "F12", code: "F12" }
    ]);
    const html = render(model);
    const cabinetRect = segmentRectTag(segmentMarkup(html, "base-left"));
    const fillerRect = segmentRectTag(segmentMarkup(html, "light-filler"));

    expect(cabinetRect).toContain('fill-opacity="1"');
    expect(fillerRect).toContain('fill="#fdf9eb"');
    expect(fillerRect).toContain('fill-opacity="1"');
  });

  test("does not render cabinet swing lines for narrow filler sliver panels", () => {
    const model = elevationModel([
      cabinet("base-left", 57 * 16),
      { ...cabinet("narrow-sliver", 3 * 16), label: "#2", code: "W3" }
    ]);
    const html = render(model);
    const sliverHtml = segmentMarkup(html, "narrow-sliver");

    expect(sliverHtml).not.toContain('data-face="');
    expect(sliverHtml).toContain('data-display-label="W3"');
  });

  test("renders cabinet face swing lines in neutral gray with reversed direction", () => {
    const model = elevationModel([cabinet("base-double", 60 * 16)]);
    const html = render(model);
    const faceHtml = segmentMarkup(html, "base-double");

    expect(faceHtml).not.toContain('stroke="#e12821"');
    expect(faceHtml).toContain('stroke="#a7aaa5"');
    expect(faceHtml).toContain("M 318 230 L 73 276.5 L 318 323");
    expect(faceHtml).toContain("M 322 230 L 567 276.5 L 322 323");
    expect(faceHtml).not.toContain("M 73 230 L 318 276.5 L 73 323");
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

  test("only exposes cabinet kind editing for non-appliance base segments", () => {
    expect(KIND_OPTIONS.map((option) => option.value)).toEqual([
      "base",
      "tall"
    ]);
    expect(canEditSegmentKind(cabinet("base-cabinet", 30 * 16))).toBe(true);
    expect(
      canEditSegmentKind({
        ...cabinet("a-dw", 24 * 16, "appliance"),
        label: "DW24",
        sourceFixedPointId: "top-appliance-dishwasher"
      })
    ).toBe(false);
    expect(
      canEditSegmentKind({
        ...cabinet("upper-cabinet", 30 * 16),
        tier: "upper"
      })
    ).toBe(false);
  });

  test("places tall-unit height dimensions to the far left of the regular height chain", () => {
    const model = elevationModel([
      {
        ...cabinet("a-fridge", 36 * 16, "appliance"),
        label: "REF36",
        cabinetKind: "tall",
        sourceFixedPointId: "top-appliance-fridge"
      },
      cabinet("a-b24", 24 * 16)
    ]);
    const html = render(model);
    const tallLabel = tagFor(html, "text", 'data-tall-height-label="a-fridge"');

    expect(Number(tallLabel.match(/\sx="([^"]+)"/)?.[1])).toBeLessThan(49);
    expect(tallLabel).toContain('font-weight="bold"');
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
    expect(html).not.toContain('data-display-label="Window"');
  });

  test("scales the vertical layout from the height profile", () => {
    const shortUppers = render(elevationModel(undefined, 30 * 16));
    const tallUppers = render(elevationModel(undefined, 42 * 16));

    expect(shortUppers).toContain("30″");
    expect(tallUppers).toContain("42″");
    expect(shortUppers).not.toBe(tallUppers);
  });

  test("pulses the filler that absorbed the last width change", () => {
    const model = elevationModel();
    const html = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={model}
        selectedObjectId={null}
        lastAbsorbed={{ segmentId: "a-base-4", deltaSixteenths: 16, token: 1 }}
        onSelect={() => {}}
      />
    );

    expect(html).toContain('data-elevation-layer="absorb-pulse"');
    expect(html).toContain('data-absorb-delta="16"');
    expect(html).toContain("+1″");
  });

  test("renders no pulse layer without an absorbed change", () => {
    expect(render(elevationModel())).not.toContain(
      'data-elevation-layer="absorb-pulse"'
    );
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

function chainGuideY(html: string, segmentId: string): number {
  const tag = tagFor(html, "path", `data-chain-guide="${segmentId}"`);
  const y = tag.match(/ V ([\d.]+) M/);
  expect(y).not.toBeNull();
  return Number(y?.[1]);
}

function overallLabelY(html: string): number {
  const tag = tagFor(html, "text", 'data-chain-label="overall"');
  const y = tag.match(/\sy="([^"]+)"/);
  expect(y).not.toBeNull();
  return Number(y?.[1]);
}

function overallGuideY(html: string): number {
  const tag = tagFor(html, "path", 'data-chain-guide="overall"');
  const y = tag.match(/M 70 ([\d.]+) H 570/);
  expect(y).not.toBeNull();
  return Number(y?.[1]);
}

function chainGuideTick(
  html: string,
  segmentId: string
): { startY: number; endY: number } {
  const tag = tagFor(html, "path", `data-chain-guide="${segmentId}"`);
  const match = tag.match(/M [\d.]+ ([\d.]+) V ([\d.]+)/);
  expect(match).not.toBeNull();
  return {
    startY: Number(match?.[1]),
    endY: Number(match?.[2])
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

function segmentMarkup(html: string, segmentId: string): string {
  const start = html.indexOf(`data-segment-id="${segmentId}"`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf('data-segment-id="', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function segmentRectTag(markup: string): string {
  const matches = [...markup.matchAll(/<rect[^>]*>/g)];
  expect(matches.length).toBeGreaterThanOrEqual(2);
  return matches[1]?.[0] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
