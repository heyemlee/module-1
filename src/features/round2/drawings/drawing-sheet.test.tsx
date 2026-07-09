import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  FloorPlan,
  Wall
} from "@/features/round1/floorplan/plan-geometry";
import type { Round2Model, WallSegment } from "../model/round2-model";
import { ROUND1_REFERENCE_FIXTURE } from "../round2-fixtures";
import { autofillRound2Model } from "../model/autofill";
import { deriveWallsFromRound1 } from "../model/derive-walls";
import { initializeMeasurements } from "../model/round2-model";
import { CabinetSchedule } from "./cabinet-schedule";
import { DrawingSheet, drawingSheetsForModel } from "./drawing-sheet";

describe("Round 2 drawing sheets", () => {
  test("renders A1 from the proposal model", () => {
    const model = submittedModel();
    const firstBase = model.walls[0].segments.find(
      (segment) => segment.tier === "base" && segment.kind === "cabinet"
    )!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={drawingSheetsForModel(model)[0]}
        model={model}
        measurementVersion={3}
        proposalVersion={2}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
      />
    );

    expect(html).toContain("MEASUREMENT v3");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain('data-drawing-layer="dimensions"');
    expect(html).toContain('data-drawing-layer="cabinet-numbers"');
    expect(html).toContain(firstBase.code);
    expect(html).toContain("TEST7.1 · KITCHEN REMODEL");
    expect(html).not.toContain("MIKE · MAIN KITCHEN");
  });

  test("renders wall elevation dimensions and matching cabinet ids", () => {
    const model = submittedModel();
    const sheet = drawingSheetsForModel(model).find((item) => item.id === "A2")!;
    const firstUpper = model.walls[0].segments.find(
      (segment) => segment.tier === "upper" && segment.kind === "cabinet"
    )!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={sheet}
        model={model}
        measurementVersion={3}
        proposalVersion={2}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
      />
    );

    expect(html).toContain("WALL A ELEVATION");
    expect(html).toContain("96″");
    expect(html).toContain(firstUpper.code);
    expect(html).toContain('data-drawing-layer="cabinet-boundaries"');
    expect(html).not.toContain("A2 · WALL A ELEVATION");
    expect(html).not.toContain("ROUND 2 VISUAL PROTOTYPE");
  });

  test("mirrors left-wall elevation sheets so the upper corner reads on the right", () => {
    const top = simpleWallModel("TOP");
    const left = simpleWallModel("LEFT");
    const topHtml = renderToStaticMarkup(
      <DrawingSheet
        sheet={{ id: "A2", label: "Wall A elevation", wallId: "A" }}
        model={top}
        measurementVersion={1}
        proposalVersion={1}
        customerName="Test"
        projectName="Kitchen"
      />
    );
    const leftHtml = renderToStaticMarkup(
      <DrawingSheet
        sheet={{ id: "A2", label: "Wall A elevation", wallId: "A" }}
        model={left}
        measurementVersion={1}
        proposalVersion={1}
        customerName="Test"
        projectName="Kitchen"
      />
    );

    expect(textX(topHtml, "near-start")).toBeLessThan(
      textX(topHtml, "near-end")
    );
    expect(textX(leftHtml, "near-start")).toBeGreaterThan(
      textX(leftHtml, "near-end")
    );
  });

  test("keeps elevation labels compact for openings, tall placeholders, and fillers", () => {
    const model = submittedModel(ROUND1_REFERENCE_FIXTURE.floorPlan, 148 * 16);
    const wall = model.walls[0];
    const filler = wall.segments.find((segment) => segment.kind === "filler")!;
    const opening = {
      id: "a-window-opening",
      wallId: wall.id,
      tier: "upper" as const,
      kind: "opening" as const,
      widthSixteenths: 36 * 16,
      label: "Window",
      sourceFixedPointId: "a-window"
    };
    const tallPlaceholder = {
      id: "a-tall-placeholder",
      wallId: wall.id,
      tier: "full" as const,
      kind: "cabinet" as const,
      widthSixteenths: 24 * 16,
      label: "Tall unit",
      cabinetKind: "tall" as const
    };
    wall.segments = [opening, tallPlaceholder, ...wall.segments];
    wall.fixedPoints = [
      ...wall.fixedPoints,
      {
        id: "a-window",
        type: "window",
        label: "Window",
        sourceWall: wall.sourceWall,
        order: 0,
        positionRatio: 0
      }
    ];
    const sheet = drawingSheetsForModel(model).find((item) => item.id === "A2")!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={sheet}
        model={model}
        measurementVersion={1}
        proposalVersion={1}
        customerName="Test"
        projectName="Kitchen"
      />
    );

    expect(html).toContain('data-glyph="window"');
    expect(html).not.toContain('data-segment-id="a-window-opening"');
    expect(html).not.toContain('data-segment-id="a-tall-placeholder"');
    expect(html).not.toMatch(/<text[^>]*>Window<\/text>/);
    expect(html).not.toMatch(/<text[^>]*>Tall unit<\/text>/);
    expect(html).toMatch(
      new RegExp(
        `data-segment-id="${filler.id}"[^>]*fill="#696969"[^>]*font-size="10"`
      )
    );
  });

  test("draws appliance identities on the wall elevation", () => {
    const model = submittedModel({
      ...planFor("ONE_WALL", ["TOP"]),
      appliances: [
        appliance("fridge", 110),
        appliance("sink", 340),
        appliance("dishwasher", 430),
        appliance("range", 520)
      ]
    }, 220 * 16);
    const sheet = drawingSheetsForModel(model).find((item) => item.id === "A2")!;
    const html = renderToStaticMarkup(
      <DrawingSheet
        sheet={sheet}
        model={model}
        measurementVersion={1}
        proposalVersion={1}
        customerName="Test"
        projectName="Kitchen"
      />
    );

    for (const role of ["fridge", "sink", "dishwasher", "range"]) {
      expect(html).toContain(`data-appliance-role="${role}"`);
      expect(html).toContain(`data-role-tag="${role}"`);
    }
    // Default hood style is a cabinet insert projected above the range.
    expect(html).toContain('data-appliance-role="hood"');
    // The fridge is a tall unit, so it carries its own overall height dimension.
    expect(html).toContain('data-drawing-layer="tall-height"');
  });

  test("creates elevation sheets from actual wall count", () => {
    const galley = submittedModel(planFor("GALLEY", ["TOP", "BOTTOM"]));
    expect(drawingSheetsForModel(galley).map((sheet) => sheet.id)).toEqual([
      "A1",
      "A2",
      "A3",
      "S1"
    ]);
  });

  test("renders S1 schedule from model segments including fillers", () => {
    // 148″ walls leave a sub-tier remainder, so autofill emits fillers.
    const model = submittedModel(ROUND1_REFERENCE_FIXTURE.floorPlan, 148 * 16);
    const filler = model.walls[0].segments.find(
      (segment) => segment.kind === "filler"
    )!;
    expect(filler).toBeDefined();
    const html = renderToStaticMarkup(
      <CabinetSchedule
        model={model}
        customerName="Test7.1"
        projectName="Kitchen Remodel"
        measurementVersion={3}
        proposalVersion={2}
      />
    );

    expect(html).toContain("S1 · CABINET SCHEDULE");
    expect(html).toContain("Test7.1");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain(filler.code);
    expect(html).toContain("Filler panel / scribe");
    expect(html).not.toContain("Fixture proposal");
  });
});

function submittedModel(
  floorPlan: FloorPlan = ROUND1_REFERENCE_FIXTURE.floorPlan,
  wallLengthSixteenths = 150 * 16
) {
  const model = deriveWallsFromRound1(floorPlan);
  const measurements = Object.fromEntries(
    Object.keys(initializeMeasurements(model)).map((key) => [
      key,
      key === "room.ceiling"
        ? 96 * 16
        : key.endsWith(".width")
          ? 36 * 16
          : key.endsWith(".offset")
            ? 24 * 16
            : wallLengthSixteenths
    ])
  );
  return autofillRound2Model(model, measurements);
}

function appliance(
  symbol: "fridge" | "sink" | "dishwasher" | "range",
  x: number
) {
  return {
    x,
    y: 78,
    w: 40,
    h: 40,
    key: symbol,
    label: symbol,
    symbol,
    wall: "TOP" as const
  };
}

function simpleWallModel(sourceWall: Wall): Round2Model {
  const segments: WallSegment[] = [
    {
      id: "near-start",
      wallId: "A",
      tier: "base",
      kind: "cabinet",
      widthSixteenths: 30 * 16,
      label: "START",
      cabinetKind: "base",
      code: "#1"
    },
    {
      id: "near-end",
      wallId: "A",
      tier: "base",
      kind: "cabinet",
      widthSixteenths: 30 * 16,
      label: "END",
      cabinetKind: "base",
      code: "#2"
    }
  ];
  return {
    ceilingHeightSixteenths: 96 * 16,
    heightProfile: {
      counterSixteenths: 36 * 16,
      backsplashSixteenths: 18 * 16,
      upperHeightSixteenths: 36 * 16,
      mouldingSixteenths: 3 * 16
    },
    decisionItems: [],
    walls: [
      {
        id: "A",
        label: "A",
        sourceWall,
        lengthSixteenths: 60 * 16,
        fixedPoints: [],
        notes: [],
        segments
      }
    ]
  };
}

function textX(html: string, segmentId: string): number {
  const tag = html.match(
    new RegExp(`<text(?=[^>]*data-segment-id="${segmentId}")[^>]*>`)
  );
  expect(tag).not.toBeNull();
  const x = tag?.[0].match(/\sx="([^"]+)"/);
  expect(x).not.toBeNull();
  return Number(x?.[1]);
}

function planFor(layoutPreference: string, walls: Wall[]): FloorPlan {
  return {
    ...ROUND1_REFERENCE_FIXTURE.floorPlan,
    layoutPreference,
    baseCabinets: walls.map((wall, index) => ({
      x: 100 + index * 40,
      y: 100,
      w: 40,
      h: 24,
      code: `B${index}`,
      confirmationRequired: false,
      wall
    })),
    wallCabinets: [],
    appliances: [],
    window: null,
    door: null,
    markers: []
  };
}
