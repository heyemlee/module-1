import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildFloorPlan } from "./floorplan/plan-geometry";
import { buildElevationScene } from "./elevations/elevation-scene";
import {
  Round1ElevationStrip,
  Round1ElevationLightbox
} from "./showroom-intake-panels";

function buildScenes() {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  const plan = buildFloorPlan(
    result.normalized,
    estimate.cabinets,
    result.confirmationItems.length + estimate.confirmationItems.length,
    {}
  );
  return buildElevationScene(plan);
}

describe("Round1ElevationStrip", () => {
  test("renders a labelled thumbnail per wall scene", () => {
    const scenes = buildScenes();
    expect(scenes.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      <Round1ElevationStrip scenes={scenes} onOpen={() => {}} />
    );

    const buttons = html.match(/Open [^"]+ rough elevation/g) ?? [];
    expect(buttons).toHaveLength(scenes.length);
    expect(html).toContain("Back Wall");
    // The thumbnail embeds the real elevation drawing, not placeholder boxes.
    expect(html).toContain("data-elevation-item");
  });

  test("renders nothing without scenes", () => {
    expect(
      renderToStaticMarkup(<Round1ElevationStrip scenes={[]} onOpen={() => {}} />)
    ).toBe("");
  });
});

describe("Round1ElevationLightbox", () => {
  test("stamps the rough-elevation chrome and zero-padded index", () => {
    const scenes = buildScenes();
    const html = renderToStaticMarkup(
      <Round1ElevationLightbox
        scenes={scenes}
        index={0}
        onClose={() => {}}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("ROUGH ELEVATION");
    expect(html).toContain(scenes[0].title);
    expect(html).toContain(`01 / ${String(scenes.length).padStart(2, "0")}`);
    expect(html).toContain("SALES ESTIMATE · NOT FOR PRODUCTION");
    if (scenes.length > 1) {
      expect(html).toContain("Previous wall");
      expect(html).toContain("Next wall");
    }
  });
});
