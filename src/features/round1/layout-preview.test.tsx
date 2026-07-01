import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { createDefaultCabinetRuns, createDefaultShowroomForm } from "./showroom-intake-data";
import { buildFloorPlan } from "./floorplan/plan-geometry";
import { LayoutPreview, overrideFromPointer } from "./layout-preview";

describe("LayoutPreview", () => {
  function staticApplianceLabelPattern(label: string) {
    return new RegExp(
      `class="fill-slate-900 text-\\[11px\\] font-bold"[^>]*>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</text>`
    );
  }

  function renderPreview({
    cabinets,
    previewStage,
    form = createDefaultShowroomForm()
  }: {
    cabinets?: ReturnType<typeof generatePreliminaryCabinetList>["cabinets"];
    previewStage?: "room" | "openings" | "layout" | "appliances" | "adjust";
    form?: Round1FormInput;
  } = {}) {
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    return renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={cabinets ?? estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
        previewStage={previewStage}
      />
    );
  }

  test("room stage shows only the room shell", () => {
    const html = renderPreview({ previewStage: "room" });

    expect(html).not.toContain('data-opening-symbol="');
    expect(html).not.toContain('data-layout-guide="');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("openings stage shows door and window without appliances or cabinets", () => {
    const html = renderPreview({ previewStage: "openings" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-opening-symbol="door"');
    expect(html).not.toContain('data-layout-guide="');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
  });

  test("layout stage shows layout guides without appliances or cabinets", () => {
    const html = renderPreview({ previewStage: "layout" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-opening-symbol="door"');
    expect(html).toContain('data-layout-guide="wall"');
    expect(html).not.toContain('data-appliance-symbol="');
    expect(html).not.toContain('data-base-cabinet="');
  });

  test("connects the peninsula guide directly to the left layout guide", () => {
    const form = createDefaultShowroomForm();
    form.layoutPreference = "PENINSULA";

    const html = renderPreview({ form, previewStage: "layout" });
    const leftGuide = html.match(
      /data-layout-wall="LEFT" x="([^"]+)" y="[^"]+" width="([^"]+)"/
    );
    const peninsulaGuide = html.match(
      /data-layout-guide="peninsula"[^>]*><rect x="([^"]+)"/
    );

    expect(leftGuide).not.toBeNull();
    expect(peninsulaGuide).not.toBeNull();
    expect(Number(peninsulaGuide![1])).toBeCloseTo(
      Number(leftGuide![1]) + Number(leftGuide![2]),
      5
    );
  });

  test("appliances stage adds appliances but still hides cabinets", () => {
    const html = renderPreview({ previewStage: "appliances" });

    expect(html).toContain('data-opening-symbol="window"');
    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("cabinet shapes render only when cabinet data is generated", () => {
    const html = renderPreview({ cabinets: [], previewStage: "adjust" });

    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
  });

  test("renders peninsula base cabinets instead of an empty peninsula box", () => {
    const form = createDefaultShowroomForm();
    form.layoutPreference = "PENINSULA";

    const html = renderPreview({ form, previewStage: "adjust" });
    const peninsulaCabinetCount = (
      html.match(/data-peninsula-cabinet="/g) ?? []
    ).length;

    expect(peninsulaCabinetCount).toBeGreaterThan(1);
    expect(html).not.toContain(">Peninsula<");
  });

  test("accepts parent-owned position overrides and change handler props", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{ fridge: { wall: "TOP", position: 140 } }}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain("Kitchen floor plan editor");
  });

  test("renders dishwasher as an integrated base-cabinet panel", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain('data-appliance-symbol="dishwasher"');
    expect(html).toContain('data-dishwasher-panel="true"');
  });

  test("referenceMode strips labels and chrome but keeps geometry", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        // Forced on by referenceMode even though this is false.
        showPositionObjects={false}
        referenceMode
      />
    );

    // No text labels.
    expect(html).not.toContain(">window<");
    expect(html).not.toContain(">door<");
    expect(html).not.toContain(">Island<");
    // No header chrome (the "Round 1" badge text only survives in the SVG
    // aria-label, which is not rasterized into the image).
    expect(html).not.toContain("Top-Down Layout Plan");
    expect(html).not.toContain("Show MEP");
    expect(html).not.toContain(">Print");
    // No hover/drag chrome (sky halo, grab-dots).
    expect(html).not.toContain('stroke="#c56a16"');
    expect(html).not.toContain('fill="#334155"');
    // Geometry retained: appliances drawn (forced on) and the SVG viewBox intact.
    expect(html).toContain('data-appliance-symbol="sink"');
    expect(html).toContain('viewBox="0 0 760 560"');
  });

  test("default render keeps the labels and chrome that referenceMode strips", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain(">window<");
    expect(html).toContain(">door<");
    expect(html).not.toContain('stroke="#c56a16"');
    expect(html).toContain('stroke="var(--studio-action)"');
  });

  test("renders an open passage without door leaf or swing arc", () => {
    const form = createDefaultShowroomForm();
    form.openings.doors.items = [
      { location: "LEFT_SIDE", kind: "OPEN_PASSAGE", width: null }
    ];

    const html = renderPreview({ form });

    expect(html).toContain('data-opening-symbol="door"');
    expect(html).toContain(">opening<");
    expect(html).not.toContain(">door<");
    expect(html).not.toContain('stroke="#2563eb"');
  });

  test("excludes microwave/oven combo and wall oven static labels", () => {
    const form = createDefaultShowroomForm();
    form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = { status: "YES", relation: "RIGHT_SIDE" };
    form.layoutSensitiveCabinets.cookingAppliances.wallOven = { status: "YES", relation: "LEFT_SIDE" };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain("Microwave");
    expect(html).not.toContain("Microwave / oven combo");
    expect(html).toContain("Wall oven");
    expect(html).not.toMatch(
      staticApplianceLabelPattern("Microwave")
    );
    expect(html).not.toMatch(staticApplianceLabelPattern("Wall oven"));
  });

  test("excludes stacked wall oven and microwave static label", () => {
    const form = createDefaultShowroomForm();
    form.layoutSensitiveCabinets.ovenMicrowave = {
      configuration: "WALL_OVEN_MICROWAVE_STACK",
      relation: "UNKNOWN"
    };
    form.layoutSensitiveCabinets.cookingAppliances.wallOven = {
      status: "YES",
      relation: "UNKNOWN"
    };
    form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = {
      status: "YES",
      relation: "UNKNOWN"
    };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

    const html = renderToStaticMarkup(
      <LayoutPreview
        normalized={result.normalized}
        cabinets={estimate.cabinets}
        confirmationItems={result.confirmationItems}
        positionOverrides={{}}
        onPositionOverridesChange={() => {}}
        highlightDraggableItems={false}
        showPositionObjects={true}
      />
    );

    expect(html).toContain('data-appliance-symbol="oven"');
    expect(html).toContain("Wall oven + microwave stack");
    expect(html).not.toMatch(
      staticApplianceLabelPattern("Wall oven + microwave stack")
    );
  });

  test("uses Studio canvas semantics for draggable position objects", () => {
    const html = renderPreview({ previewStage: "adjust" });

    expect(html).toContain('data-canvas-theme="studio"');
    expect(html).toContain('data-drag-state="idle"');
    expect(html).toContain('aria-label="Kitchen floor plan editor"');
  });

  test("treats an island as a drop target for a standalone microwave", () => {
    const form = createDefaultShowroomForm();
    form.layoutPreference = "ISLAND";
    form.layoutSensitiveCabinets.island = {
      status: "YES",
      requested: true,
      functions: []
    };
    form.layoutSensitiveCabinets.ovenMicrowave = {
      configuration: "MICROWAVE_DRAWER",
      relation: "ON_ISLAND"
    };
    form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = {
      status: "YES",
      relation: "ON_ISLAND"
    };
    const result = normalizeRound1Form(form);
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
    const plan = buildFloorPlan(result.normalized, estimate.cabinets);
    const island = plan.island!;

    expect(
      overrideFromPointer(
        plan,
        "microwaveOvenCombo",
        {
          x: island.x + island.w / 2,
          y: island.y + island.h / 2
        },
        0
      )
    ).toMatchObject({ onIsland: true });
  });

});
