import { describe, expect, test } from "vitest";
import { buildRound1LayoutPrompt, normalizeRound1Form } from "./index";

describe("Round 1 layout prompt generation", () => {
  test("builds a sales-estimate-only prompt from normalized JSON without production codes", () => {
    const { normalized } = normalizeRound1Form({
      room: {
        length: 144,
        width: 120,
        dimensionsKnown: true,
        ceilingHeight: null,
        obstacles: []
      },
      openings: {
        doors: {
          status: "YES",
          items: [{ location: "NEAR_ENTRANCE", width: null }]
        },
        windows: {
          status: "YES",
          items: [{ relation: "BEHIND_SINK", width: null }]
        }
      },
      mep: {
        water: { relation: "NEAR_SINK", movable: "UNKNOWN" },
        gas: { relation: "NEAR_RANGE", movable: "UNKNOWN" },
        electric: { relation: "NEAR_FRIDGE", movable: "UNKNOWN" },
        vent: { relation: "ABOVE_RANGE", movable: "UNKNOWN" }
      },
      layoutPreference: "L_SHAPE",
      fixtures: {
        sink: { size: 33, type: "UNKNOWN", relation: "UNDER_WINDOW" },
        range: {
          size: 30,
          fuel: "GAS",
          fixedLocation: "UNKNOWN",
          relation: "NEAR_RANGE"
        },
        fridge: { size: 36, type: "UNKNOWN", relation: "NEAR_ENTRANCE" },
        dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
        hood: { relation: "ABOVE_RANGE" }
      },
      layoutSensitiveCabinets: {
        cornerCabinet: { preferredType: "LAZY_SUSAN" },
        ovenMicrowave: {
          configuration: "RANGE_INCLUDES_OVEN",
          relation: "NEAR_RANGE"
        },
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
          microwaveOvenCombo: { status: "UNKNOWN", relation: "UNKNOWN" }
        },
        island: { requested: false, functions: [] }
      }
    });

    const prompt = buildRound1LayoutPrompt(normalized);

    expect(prompt).toContain("Round 1 customer confirmation");
    expect(prompt).toContain("sales-estimate-only, not production data");
    expect(prompt).toContain("Kitchen shape: L_SHAPE");
    expect(prompt).toContain('Rough room dimensions: 144" by 120"');
    // The model draws only the empty shell; appliances/cabinets/text are overlaid.
    expect(prompt).toContain("Do not draw any appliances");
    expect(prompt).toContain("Do not draw any cabinets");
    expect(prompt).toContain("Do not add any text");
    expect(prompt).toContain("Leave the interior empty so the app can overlay");
    // It must not instruct the model to render fixtures or production codes.
    expect(prompt).not.toContain("Place sink");
    expect(prompt).not.toMatch(/\b[BTW]\d{6}\b/);
  });

  test("forbids drawing openings that the intake says do not exist", () => {
    const { normalized } = normalizeRound1Form({
      room: {
        length: 120,
        width: 96,
        dimensionsKnown: true,
        ceilingHeight: 96,
        obstacles: []
      },
      openings: {
        doors: { status: "YES", items: [{ location: "FRONT_SIDE", width: 36 }] },
        windows: { status: "NO", items: [] }
      },
      mep: {
        water: { relation: "NEAR_SINK", movable: "NO" },
        gas: { relation: "NEAR_RANGE", movable: "NO" },
        electric: { relation: "NEAR_FRIDGE", movable: "NO" },
        vent: { relation: "ABOVE_RANGE", movable: "NO" }
      },
      layoutPreference: "ONE_WALL",
      fixtures: {
        sink: { size: 30, type: "UNKNOWN", relation: "ON_MAIN_RUN" },
        range: {
          size: 30,
          fuel: "GAS",
          fixedLocation: "YES",
          relation: "ON_MAIN_RUN"
        },
        fridge: { size: 36, type: "UNKNOWN", relation: "ON_MAIN_RUN" },
        dishwasher: { status: "NONE", size: null, relation: "NOT_APPLICABLE" },
        hood: { relation: "ABOVE_RANGE" }
      },
      layoutSensitiveCabinets: {
        cornerCabinet: { preferredType: "NO_PREFERENCE" },
        ovenMicrowave: { configuration: "RANGE_INCLUDES_OVEN", relation: "ON_MAIN_RUN" },
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
          microwaveOvenCombo: { status: "UNKNOWN", relation: "UNKNOWN" }
        },
        island: { requested: false, functions: [] }
      }
    });

    const prompt = buildRound1LayoutPrompt(normalized);

    expect(prompt).toContain("Do not draw any window.");
    expect(prompt).toContain("Include door openings where appropriate");
  });
});
