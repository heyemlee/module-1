import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Round2Model, WallSegment } from "../model/round2-model";
import {
  accessoryOptionsForSegment,
  canOpenSegmentEditor,
  canEditSegmentKind,
  CORNER_STRATEGY_OPTIONS,
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
    expect(html).not.toContain(">1:30<");
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

  test("puts upper dimensions above and base dimensions below the elevation", () => {
    const html = render(
      elevationModel([
        { ...cabinet("upper-row", 36 * 16), tier: "upper" },
        cabinet("base-row", 36 * 16),
        { ...cabinet("full-row", 24 * 16), tier: "full" }
      ])
    );

    expect(chainLabelY(html, "upper-row")).toBe(42);
    expect(chainLabelY(html, "base-row")).toBe(368);
    expect(chainLabelY(html, "full-row")).toBe(368);
  });

  test("keeps overall and upper dimensions above the ceiling line", () => {
    const model = elevationModel([
      { ...cabinet("upper-left", 33 * 16), tier: "upper" },
      { ...cabinet("upper-center", 30 * 16), tier: "upper" },
      { ...cabinet("upper-right", 57 * 16), tier: "upper" }
    ]);
    const html = render(model);
    const ceiling = ceilingLineY(html);

    // CEILING_Y is 62: every dimension drawn above the run must clear it.
    expect(overallLabelY(html)).toBeLessThan(30);
    expect(overallGuideY(html)).toBeLessThan(40);
    expect(chainLabelY(html, "upper-center")).toBeLessThan(50);
    expect(chainGuideTick(html, "upper-center").endY).toBeLessThan(ceiling);
  });

  test("reserves vertical canvas padding around the dimension chains", () => {
    const html = renderCornerModel("A", { includeUpperCorner: true });
    const elevation = tagFor(html, "svg", 'role="img"');

    expect(elevation).toContain('viewBox="0 -12 640 436"');
  });

  test("keeps all three upper corner dimension rows above the ceiling line", () => {
    const html = renderCornerModel("A", { includeUpperCorner: true });
    const cornerHtml = segmentMarkup(html, "a-upper-corner-ls");
    const ceiling = ceilingLineY(html);

    expect(overallLabelY(html)).toBeLessThan(ceiling);
    expect(chainLabelY(html, "a-upper-corner-ls")).toBeLessThan(ceiling);
    expect(cornerBreakdownLabelYs(cornerHtml)).toEqual(
      expect.arrayContaining([expect.any(Number)])
    );
    expect(cornerBreakdownLabelYs(cornerHtml).every((y) => y < ceiling)).toBe(
      true
    );
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

  test("extends every horizontal dimension guide endpoint by eight SVG units", () => {
    const html = renderCornerModel("A", { includeUpperCorner: true });

    expect(tagFor(html, "path", 'data-chain-guide="overall"')).toContain("V 37");
    expect(tagFor(html, "path", 'data-chain-guide="a-upper-corner-ls"')).toMatch(/V 55/);
    expect(tagFor(html, "path", 'data-chain-guide="a-corner-ls"')).toMatch(/V 350/);
    expect(tagFor(html, "path", 'data-corner-breakdown-guide="a-upper-corner-ls"')).toMatch(/V 77/);
  });

  test("mirrors left-wall elevations so the upper corner reads on the right", () => {
    const top = elevationModel([
      cabinet("near-start", 30 * 16),
      cabinet("near-end", 30 * 16)
    ]);
    const left = {
      ...top,
      walls: [{ ...top.walls[0], sourceWall: "LEFT" as const }]
    };

    expect(rectForSegment(render(top), "near-start").x).toBeLessThan(
      rectForSegment(render(top), "near-end").x
    );
    expect(rectForSegment(render(left), "near-start").x).toBeGreaterThan(
      rectForSegment(render(left), "near-end").x
    );
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
    expect(fillerHtml).not.toContain("data-display-label=");
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
    expect(sliverHtml).not.toContain("data-display-label=");
  });

  test("renders cabinet face swing lines in neutral gray with reversed direction", () => {
    const model = elevationModel([cabinet("base-double", 60 * 16)]);
    const html = render(model);
    const faceHtml = segmentMarkup(html, "base-double");

    expect(faceHtml).not.toContain('stroke="#e12821"');
    expect(faceHtml).toContain('stroke="#a7aaa5"');
    expect(faceHtml).toContain("M 318 250 L 73 296.5 L 318 343");
    expect(faceHtml).toContain("M 322 250 L 567 296.5 L 322 343");
    expect(faceHtml).not.toContain("M 73 250 L 318 296.5 L 73 343");
  });

  test("does not render door swing lines on a corner cabinet", () => {
    const html = render(
      elevationModel([
        {
          ...cabinet("lazy-susan", 36 * 16),
          cabinetKind: "corner"
        }
      ])
    );

    expect(segmentMarkup(html, "lazy-susan")).not.toContain('data-face="');
  });

  test("renders corner reservations as sectioned returns, not empty boxes", () => {
    const model = elevationModel([
      {
        ...cabinet("corner-clearance", 24 * 16, "gap"),
        label: "Corner clearance",
        sourceCornerId: "TL"
      },
      cabinet("wide-1", 102 * 16)
    ]);
    const html = render(model);
    const cornerHtml = segmentMarkup(html, "corner-clearance");

    expect(cornerHtml).toContain('data-face="corner-return"');
    expect(cornerHtml).toContain('data-corner-return-profile="true"');
    expect(cornerHtml).toContain('data-corner-return-counter="true"');
    expect(html).not.toContain("<title>Corner return</title>");
    expect(cornerHtml).not.toContain("data-display-label=");
    // Without the paired wall in the model there is no jump target.
    expect(cornerHtml).not.toContain("data-corner-return-tag=");
  });

  test("renders a full base cabinet chain for a corner return", () => {
    const model = elevationModel([
      {
        ...cabinet("ls-return", 36 * 16, "gap"),
        label: "LS36 return",
        sourceCornerId: "TL"
      },
      cabinet("wide-1", 84 * 16)
    ]);
    const html = render(model);

    const total = tagFor(html, "text", 'data-chain-label="ls-return"');
    const returnHtml = segmentMarkup(html, "ls-return");

    expect(total).toContain('fill="#079ca5"');
    expect(returnHtml).toContain(">36″</text>");
    expect(returnHtml).toContain('data-corner-breakdown="ls-return"');
    expect(returnHtml).toContain(">24″</text>");
    expect(returnHtml).toContain(">12″</text>");
  });

  test("renders a full upper cabinet chain for a corner return", () => {
    const model = elevationModel([
      {
        ...cabinet("upper-return", 36 * 16, "gap"),
        tier: "upper",
        label: "LS36 return",
        sourceCornerId: "TL"
      },
      { ...cabinet("upper-wide", 84 * 16), tier: "upper" }
    ]);

    const html = render(model);
    const total = tagFor(html, "text", 'data-chain-label="upper-return"');
    const returnHtml = segmentMarkup(html, "upper-return");

    expect(returnHtml).toContain(">36″</text>");
    expect(returnHtml).toContain('data-corner-breakdown="upper-return"');
    expect(returnHtml).toContain(">12″</text>");
    expect(returnHtml).toContain(">24″</text>");
  });

  test("splits the upper return chain at its 12 inch depth", () => {
    const model = elevationModel([
      {
        ...cabinet("upper-return", 36 * 16, "gap"),
        tier: "upper",
        label: "LS36 return",
        sourceCornerId: "TL"
      },
      { ...cabinet("upper-wide", 84 * 16), tier: "upper" }
    ]);
    const guide = tagFor(
      render(model),
      "path",
      'data-corner-breakdown-guide="upper-return"'
    );

    expect(referenceGuideSpan(guide)).toBe(50);
  });

  test("splits the mirrored base return chain before its 24 inch depth", () => {
    const guide = tagFor(
      renderCornerModel("B"),
      "path",
      'data-corner-breakdown-guide="b-ls-return"'
    );

    expect(referenceGuideSpan(guide)).toBe(100);
  });

  test("draws the corner return without a cross-wall text tag", () => {
    const html = renderCornerModel("B");

    expect(html).toContain('data-elevation-layer="inside-corner"');
    const tag = segmentMarkup(html, "b-ls-return");
    expect(tag).not.toContain("data-corner-return-tag=");
    expect(tag).not.toContain("SEE WALL");
    expect(tag).not.toMatch(/<text[^>]*>LS36<\/text>/);
  });

  test("renders the corner return remainder as a visible cabinet face", () => {
    const html = renderCornerModel("B");
    const cornerHtml = segmentMarkup(html, "b-ls-return");

    expect(cornerHtml).toContain('data-corner-return-visible-face="true"');
    expect(cornerHtml).not.toContain('data-face="double-door"');
    expect(cornerHtml).not.toContain('data-face="single-door"');
  });

  test("hugs the sectioned profile against the mirrored corner side", () => {
    const html = renderCornerModel("B");
    const cornerHtml = segmentMarkup(html, "b-ls-return");

    // Wall B is a LEFT wall: the run mirrors, so its start-of-run corner
    // reads on the right and the 24″ section profile must hug that edge.
    const rect = cornerHtml.match(/<rect x="([^"]+)" y="[^"]+" width="([^"]+)"/);
    expect(rect).not.toBeNull();
    const right = Number(rect?.[1]) + Number(rect?.[2]);
    const profile = tagFor(
      cornerHtml,
      "path",
      'data-corner-return-profile="true"'
    );
    const start = profile.match(/d="M ([\d.]+) /);
    expect(start).not.toBeNull();
    expect(Math.abs(Number(start?.[1]) - right)).toBeLessThan(1);
  });

  test("sections the adjacent run over the hosting wall's corner cabinet", () => {
    const html = renderCornerModel("A");

    // Wall A hosts the LS36: the Wall B run crosses its picture plane at the
    // corner, so a base (24″) and upper (12″) side profile overlay the run.
    expect(html).toContain('data-elevation-layer="corner-side-profile"');
    expect(html).toContain('data-corner-side-profile="base"');
    expect(html).toContain('data-corner-side-profile="upper"');
    expect(html).toContain('data-corner-side-profile="counter"');
    // The secondary wall draws its section inside the gap, not as an overlay.
    expect(renderCornerModel("B")).not.toContain(
      'data-corner-side-profile="base"'
    );
  });

  test("keeps the host wall corner cabinet free of door swing linework", () => {
    const html = renderCornerModel("A");
    const cornerHtml = segmentMarkup(html, "a-corner-ls");

    expect(cornerHtml).not.toContain('data-face="corner-front"');
    expect(cornerHtml).not.toContain('data-face="double-door"');
    expect(cornerHtml).not.toContain('data-face="single-door"');
    expect(cornerHtml).not.toContain("data-display-label=");
  });

  test("splits the hosted base corner dimension into 24 inch depth and 12 inch remainder", () => {
    const cornerHtml = segmentMarkup(renderCornerModel("A"), "a-corner-ls");

    expect(cornerHtml).toContain('data-corner-breakdown="a-corner-ls"');
    expect(cornerHtml).toContain(">24″</text>");
    expect(cornerHtml).toContain(">12″</text>");
  });

  test("splits the upper cabinet beside a hosted corner into 12 inch depth and 24 inch remainder", () => {
    const cornerHtml = segmentMarkup(
      renderCornerModel("A", { includeUpperCorner: true }),
      "a-upper-corner-ls"
    );

    expect(cornerHtml).toContain(
      'data-corner-breakdown="a-upper-corner-ls"'
    );
    expect(cornerHtml).not.toContain('data-face="');
    expect(cornerHtml).toContain(">12″</text>");
    expect(cornerHtml).toContain(">24″</text>");
  });

  test("does not offer dead corner as a corner setup strategy", () => {
    expect(CORNER_STRATEGY_OPTIONS.map((option) => option.value)).toEqual([
      "lazySusan",
      "blindBase",
      "magicCorner",
      "blindCornerPullOut",
      "cornerPullOutShelves"
    ]);
  });

  test("allows corner reservation segments to open the editor", () => {
    expect(
      canOpenSegmentEditor({
        ...cabinet("blind-corner", 24 * 16, "gap"),
        label: "Blind corner",
        sourceCornerId: "TL"
      })
    ).toBe(true);
    expect(
      canOpenSegmentEditor({
        ...cabinet("corner-cabinet", 36 * 16),
        cabinetKind: "corner",
        sourceCornerId: "TL"
      })
    ).toBe(true);
    expect(canOpenSegmentEditor(cabinet("regular-gap", 24 * 16, "gap"))).toBe(
      false
    );
    expect(
      canOpenSegmentEditor(cabinet("window-opening", 30 * 16, "opening"))
    ).toBe(false);
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

  test("hides cabinet and appliance codes in the proposal elevation", () => {
    const html = render(
      elevationModel([
        {
          ...cabinet("corner-return", 12 * 16, "gap"),
          code: "#1",
          label: "#1",
          sourceCornerId: "TL"
        },
        { ...cabinet("range", 30 * 16, "appliance"), code: "RNG30", label: "RNG30" },
        { ...cabinet("dishwasher", 24 * 16, "appliance"), code: "DW24", label: "DW24" }
      ])
    );

    expect(html).not.toContain("data-display-label=");
    for (const code of ["#1", "RNG30", "DW24"]) {
      expect(html).not.toContain(code);
    }
  });

  test("keeps appliance reservations out of the width editor while retaining cabinet width controls", () => {
    const applianceHtml = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={elevationModel([
          {
            ...cabinet("range", 30 * 16, "appliance"),
            code: "RNG30",
            label: "RNG30"
          },
          {
            ...cabinet("dishwasher", 24 * 16, "appliance"),
            code: "DW24",
            label: "DW24"
          },
          {
            ...cabinet("corner-return", 12 * 16, "gap"),
            code: "#1",
            label: "#1",
            sourceCornerId: "TL"
          },
          cabinet("base-cabinet", 30 * 16)
        ])}
        selectedObjectId="range"
        canEdit={true}
        dispatch={() => {}}
        onSelect={() => {}}
      />
    );
    const applianceEditor = applianceHtml.slice(
      applianceHtml.indexOf('<div data-testid="segment-editor-card"')
    );
    const cabinetHtml = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={elevationModel([cabinet("base-cabinet", 30 * 16)])}
        selectedObjectId="base-cabinet"
        canEdit={true}
        dispatch={() => {}}
        onSelect={() => {}}
      />
    );
    const cabinetEditor = cabinetHtml.slice(
      cabinetHtml.indexOf('<div data-testid="segment-editor-card"')
    );

    expect(applianceEditor).toContain('data-testid="segment-editor-card"');
    expect(applianceEditor).not.toContain("WIDTH");
    expect(applianceEditor).not.toContain('aria-label="Custom width"');
    for (const code of ["#1", "RNG30", "DW24"]) {
      expect(applianceEditor).not.toContain(code);
    }
    expect(cabinetEditor).toContain("WIDTH");
    expect(cabinetEditor).toContain('aria-label="Custom width"');
  });

  test("keeps immutable corner cabinets out of width and nudge controls", () => {
    const html = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={elevationModel([
          {
            ...cabinet("corner-cabinet", 36 * 16),
            cabinetKind: "corner",
            label: "LS36",
            sourceCornerId: "TL"
          }
        ])}
        selectedObjectId="corner-cabinet"
        canEdit={true}
        dispatch={() => {}}
        onSelect={() => {}}
      />
    );
    const editor = html.slice(html.indexOf('<div data-testid="segment-editor-card"'));

    expect(editor).not.toContain("WIDTH");
    expect(editor).not.toContain('aria-label="Custom width"');
    expect(editor).not.toContain("NUDGE");
  });

  test("offers a re-center control on an anchored sink that has drifted off the window", () => {
    const model = elevationModel([
      cabinet("a-left", 30 * 16),
      {
        ...cabinet("a-sink", 30 * 16, "appliance"),
        label: "SB30",
        cabinetKind: "sink",
        anchored: true
      },
      cabinet("a-right-filler", 30 * 16, "filler")
    ]);
    model.walls[0].fixedPoints = [
      {
        id: "a-window",
        type: "window",
        label: "Window",
        sourceWall: "TOP",
        order: 0,
        positionRatio: 0.5,
        widthSixteenths: 30 * 16,
        offsetSixteenths: 20 * 16
      }
    ];
    const html = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={model}
        selectedObjectId="a-sink"
        canEdit={true}
        dispatch={() => {}}
        onSelect={() => {}}
      />
    );
    const editorCard = html.slice(
      html.indexOf('<div data-testid="segment-editor-card"')
    );

    expect(editorCard).toContain("WINDOW ALIGNMENT");
    expect(editorCard).toContain("Re-center under window");
  });

  test("shows fridge above/side controls when the fridge is selected", () => {
    const model = elevationModel([
      {
        ...cabinet("a-fridge", 36 * 16, "appliance"),
        label: "REF36",
        cabinetKind: "tall",
        sourceFixedPointId: "a-appliance-fridge"
      },
      cabinet("a-right", 30 * 16)
    ]);
    model.walls[0].fixedPoints = [
      {
        id: "a-appliance-fridge",
        type: "appliance",
        label: "Fridge",
        sourceWall: "TOP",
        order: 0,
        positionRatio: 0.1,
        symbol: "fridge"
      }
    ];
    const dispatched: unknown[] = [];
    const html = renderToStaticMarkup(
      <WallElevation
        wallId="A"
        model={model}
        selectedObjectId="a-fridge"
        canEdit={true}
        dispatch={(action) => dispatched.push(action)}
        onSelect={() => {}}
      />
    );
    const editorCard = html.slice(
      html.indexOf('<div data-testid="segment-editor-card"')
    );

    expect(editorCard).toContain("ABOVE FRIDGE");
    expect(editorCard).toContain("SIDE PANELS");
    // The above options and side options are rendered as chips.
    expect(editorCard).toContain("Wall cabinet");
    expect(editorCard).toContain("Both");
  });

  test("caps the fridge box below an upper unit so the unit above stays visible", () => {
    const fridge = {
      ...cabinet("a-fridge", 36 * 16, "appliance"),
      label: "REF36",
      cabinetKind: "tall" as const,
      sourceFixedPointId: "a-appliance-fridge"
    };
    const above: WallSegment = {
      id: "a-upper-above-fridge",
      wallId: "A",
      tier: "upper",
      kind: "cabinet",
      widthSixteenths: 36 * 16,
      label: "W36",
      cabinetKind: "upper",
      sourceFixedPointId: "a-appliance-fridge"
    };
    const boxFor = (segments: WallSegment[], id: string) => {
      const model = elevationModel(segments);
      model.walls[0].lengthSixteenths = 36 * 16;
      const html = renderToStaticMarkup(
        <WallElevation
          wallId="A"
          model={model}
          selectedObjectId={null}
          dispatch={() => {}}
          onSelect={() => {}}
        />
      );
      const group = html.slice(html.indexOf(`data-segment-id="${id}"`));
      const match = group.match(/<rect[^>]*\sy="([^"]+)"[^>]*\sheight="([^"]+)"/);
      expect(match).not.toBeNull();
      return { y: Number(match?.[1]), height: Number(match?.[2]) };
    };

    const uncapped = boxFor([fridge], "a-fridge");
    const capped = boxFor([above, fridge], "a-fridge");
    const upperBox = boxFor([above, fridge], "a-upper-above-fridge");

    // Alone, the fridge runs full height; with a unit above it starts exactly
    // at that unit's underside instead of painting over it.
    expect(capped.y).toBeGreaterThan(uncapped.y);
    expect(capped.y).toBeCloseTo(upperBox.y + upperBox.height, 5);
    expect(capped.y + capped.height).toBeCloseTo(uncapped.y + uncapped.height, 5);
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

  test("keeps corner hardware out of ordinary cabinet accessory editing", () => {
    expect(
      accessoryOptionsForSegment(cabinet("base-cabinet", 30 * 16)).map(
        (option) => option
      )
    ).toEqual(["trashPullout", "spicePullout"]);
    expect(
      accessoryOptionsForSegment({
        ...cabinet("corner-cabinet", 36 * 16),
        cabinetKind: "corner"
      })
    ).toEqual([
      "lazySusan",
      "magicCorner",
      "blindCornerPullOut",
      "cornerPullOutShelves"
    ]);
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

  test("draws a counter surface line without thickness and dimensions the 36 inch cabinet", () => {
    const html = render(elevationModel());

    expect(html).toContain('data-elevation-layer="countertop"');
    expect(html).toContain('data-countertop-band="0"');
    expect(tagFor(html, "line", 'data-countertop-band="0"')).toContain(
      'stroke-width="2"'
    );
    expect(html).not.toContain('data-countertop-band="0"><rect');
    const counter = tagFor(html, "text", 'data-height-label="counter"');
    expect(html.slice(html.indexOf(counter))).toContain("36″");
  });

  test("breaks the countertop at a freestanding range", () => {
    const model = elevationModel([
      cabinet("left-base", 30 * 16),
      {
        ...cabinet("mid-range", 30 * 16, "appliance"),
        label: "RNG30",
        sourceFixedPointId: "top-appliance-range"
      },
      cabinet("right-base", 30 * 16)
    ]);
    model.walls[0].fixedPoints = [
      {
        id: "top-appliance-range",
        type: "appliance",
        label: "range",
        sourceWall: "TOP",
        order: 1,
        positionRatio: 0.5,
        symbol: "range"
      }
    ];
    const html = render(model);

    // Two separate counter bands (left + right of the range), not one.
    expect(html).toContain('data-countertop-band="0"');
    expect(html).toContain('data-countertop-band="1"');
    expect(html).not.toContain('data-countertop-band="2"');
  });

  test("omits the redundant depth reference note", () => {
    const html = render(elevationModel());

    expect(html).not.toContain('data-elevation-layer="depth-note"');
    expect(html).not.toContain("BASE 24″ DEEP · UPPER 12″ DEEP");
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

/** L-shape: Wall A (TOP) hosts the lazy Susan, Wall B (LEFT) its return. */
function renderCornerModel(
  wallId: string,
  { includeUpperCorner = false }: { includeUpperCorner?: boolean } = {}
): string {
  const primaryBase = [
    {
      ...cabinet("a-corner-ls", 36 * 16),
      cabinetKind: "corner" as const,
      label: "LS36",
      sourceCornerId: "TL"
    },
    cabinet("a-b30", 30 * 16)
  ];
  const primary = includeUpperCorner
    ? [
        {
          ...cabinet("a-upper-corner-ls", 36 * 16),
          tier: "upper" as const,
          cabinetKind: "upper" as const,
          label: "W36"
        },
        ...primaryBase
      ]
    : primaryBase;
  const secondary = [
    {
      ...cabinet("b-ls-return", 36 * 16, "gap"),
      wallId: "B",
      label: "LS36 return",
      sourceCornerId: "TL"
    },
    { ...cabinet("b-b24", 24 * 16), wallId: "B" }
  ];
  const model: Round2Model = {
    ...elevationModel(primary),
    walls: [
      {
        ...elevationModel(primary).walls[0],
        lengthSixteenths: 66 * 16
      },
      {
        id: "B",
        label: "B",
        sourceWall: "LEFT",
        lengthSixteenths: secondary.reduce(
          (sum, segment) => sum + segment.widthSixteenths,
          0
        ),
        fixedPoints: [],
        notes: [],
        segments: secondary
      }
    ]
  };
  return renderToStaticMarkup(
    <WallElevation
      wallId={wallId}
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

function ceilingLineY(html: string): number {
  const match = html.match(
    /<line x1="70" y1="([\d.]+)" x2="570" y2="\1"[^>]*stroke-dasharray="7 5"/
  );
  expect(match).not.toBeNull();
  return Number(match?.[1]);
}

function cornerBreakdownLabelYs(markup: string): number[] {
  return [...markup.matchAll(/<text(?=[^>]*data-corner-breakdown-label)[^>]*\sy="([\d.]+)"[^>]*>/g)].map(
    (match) => Number(match[1])
  );
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

function referenceGuideSpan(tag: string): number {
  const match = tag.match(/M ([\d.]+) [\d.]+ V [\d.]+ M \1 [\d.]+ H ([\d.]+)/);
  expect(match).not.toBeNull();
  return Number(match?.[2]) - Number(match?.[1]);
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
