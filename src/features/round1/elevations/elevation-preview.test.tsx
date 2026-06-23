import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "../showroom-intake-data";
import { buildFloorPlan } from "../floorplan/plan-geometry";
import { ElevationPreview } from "./elevation-preview";

function renderElevation(form = createDefaultShowroomForm()) {
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  const plan = buildFloorPlan(
    result.normalized,
    estimate.cabinets,
    result.confirmationItems.length + estimate.confirmationItems.length,
    {}
  );
  return renderToStaticMarkup(<ElevationPreview plan={plan} />);
}

describe("ElevationPreview", () => {
  test("renders the rough elevations section with wall labels", () => {
    const html = renderElevation();

    expect(html).toContain("Rough Wall Elevations");
    expect(html).toContain("Back Wall");
    expect(html).toContain("Left Wall");
    expect(html).toContain("Round 1 rough elevation - not for production");
  });

  test("uses accent styling for openings and keeps cabinet linework neutral", () => {
    const html = renderElevation();

    expect(html).toContain('data-elevation-opening="window"');
    expect(html).toContain('stroke="#c56a16"');
    expect(html).toContain('data-elevation-item="baseCabinet"');
    expect(html).toContain('stroke="#1f2937"');
  });

  test("renders coarse appliance symbols without production details", () => {
    const html = renderElevation();

    expect(html).toContain('data-elevation-appliance="sink"');
    expect(html).toContain('data-elevation-appliance="fridge"');
    expect(html).toContain('data-elevation-appliance="range"');
    expect(html).not.toContain("B36");
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
    expect(html).not.toContain("34 1/2");
    expect(html).not.toContain("14 1/4");
  });

  test("draws a selected cooktop as a cooktop, not a range with an oven", () => {
    const base = createDefaultShowroomForm();
    const html = renderElevation({
      ...base,
      layoutSensitiveCabinets: {
        ...base.layoutSensitiveCabinets,
        cookingAppliances: {
          ...base.layoutSensitiveCabinets.cookingAppliances,
          range: { status: "NO", relation: "NOT_APPLICABLE" },
          cooktop: { status: "YES", relation: "BACK_SIDE" }
        }
      }
    });

    expect(html).toContain('data-elevation-appliance="cooktop"');
    expect(html).not.toContain('data-elevation-appliance="range"');
  });
});
