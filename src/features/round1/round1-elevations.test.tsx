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
  Round1ElevationLightbox,
  Round1PerspectiveLightbox
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

  test("renders a leading item as the first thumbnail in the same row", () => {
    const scenes = buildScenes();
    const html = renderToStaticMarkup(
      <Round1ElevationStrip
        scenes={scenes}
        onOpen={() => {}}
        leading={<button aria-label="Open 3D structure reference">3D</button>}
      />
    );
    expect(html).toContain("Open 3D structure reference");
    // Leading sits before the wall thumbnails in the same strip.
    expect(html.indexOf("Open 3D structure reference")).toBeLessThan(
      html.search(/Open [^"]+ rough elevation/)
    );
  });

  test("renders the leading item even with no wall scenes", () => {
    const html = renderToStaticMarkup(
      <Round1ElevationStrip
        scenes={[]}
        onOpen={() => {}}
        leading={<button aria-label="Open 3D structure reference">3D</button>}
      />
    );
    expect(html).toContain("Open 3D structure reference");
  });
});

describe("Round1PerspectiveLightbox", () => {
  test("renders the 3D-reference chrome and its child content", () => {
    const html = renderToStaticMarkup(
      <Round1PerspectiveLightbox onClose={() => {}}>
        <svg data-testid="persp-svg" />
      </Round1PerspectiveLightbox>
    );
    expect(html).toContain("3D STRUCTURE REFERENCE");
    expect(html).toContain("SALES ESTIMATE · NOT FOR PRODUCTION");
    expect(html).toContain("Close 3D structure reference");
    expect(html).toContain("persp-svg");
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
