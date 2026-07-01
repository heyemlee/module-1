import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { buildRound1RenderingPrompt } from "./rendering-prompt";
import type { RenderingPromptPreferences } from "./rendering-prompt";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot, type Round1Snapshot } from "./snapshot";
import type { PositionOverrides } from "./floorplan/plan-geometry";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const europeanOak: CabinetColor = {
  id: "eu-oak",
  companyId: "company-1",
  cabinetStyle: "EUROPEAN_FRAMELESS",
  name: "European Oak",
  colorCode: null,
  swatchImageUrl: null,
  swatchHex: "#b98a58",
  hoverExampleImageUrl: null,
  promptDescription: "warm natural oak matte slab cabinet doors",
  active: true,
  sortOrder: 1,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z"
};

const americanWhite: CabinetColor = {
  id: "us-white",
  companyId: "company-1",
  cabinetStyle: "AMERICAN_FRAMED",
  name: "American White",
  colorCode: null,
  swatchImageUrl: null,
  swatchHex: "#f7f4ee",
  hoverExampleImageUrl: null,
  promptDescription: "soft painted white shaker cabinet doors",
  active: true,
  sortOrder: 2,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-19T00:00:00.000Z"
};

function buildPrompt(
  snapshot = buildSnapshot(),
  preferences: RenderingPromptPreferences = {
    cabinetStyle: "EUROPEAN_FRAMELESS" as const,
    color: europeanOak
  }
) {
  return buildRound1RenderingPrompt(snapshot, preferences);
}

function buildSnapshot(
  layoutPreference: ReturnType<
    typeof createDefaultShowroomForm
  >["layoutPreference"] = "L_SHAPE",
  configureForm?: (form: Round1FormInput) => void,
  positionOverrides: PositionOverrides = {}
): Round1Snapshot {
  const form = { ...createDefaultShowroomForm(), layoutPreference };
  configureForm?.(form);
  const { normalized, confirmationItems, readiness } =
    normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized,
    positionOverrides,
    preliminaryCabinets: estimate,
    confirmationItems: [...confirmationItems, ...estimate.confirmationItems],
    readiness,
    now: () => new Date("2026-06-17T00:00:00.000Z")
  });
}

describe("buildRound1RenderingPrompt", () => {
  test("asks for a realistic concept that defers placement to the reference image", () => {
    const prompt = buildPrompt();

    expect(prompt).toContain("concept rendering");
    expect(prompt).toContain("authoritative spatial reference");
    expect(prompt).toContain("Kitchen shape:");
  });

  test("marks the output as a non-authoritative sales concept with no on-image text", () => {
    const prompt = buildPrompt();

    expect(prompt).toContain("sales-estimate concept image only");
    expect(prompt.toLowerCase()).toContain("not a production drawing");
    expect(prompt).toContain(
      "Do not draw dimension lines, measurements, cabinet codes, labels"
    );
  });

  test("uses European frameless style language and the selected color prompt description", () => {
    const prompt = buildPrompt(buildSnapshot(), {
      cabinetStyle: "EUROPEAN_FRAMELESS",
      color: europeanOak
    });

    expect(prompt).toContain("California Bay Area");
    expect(prompt).toContain("single-family house");
    expect(prompt).toContain("modern frameless European-style cabinetry");
    expect(prompt).toContain("warm natural oak matte slab cabinet doors");
    expect(prompt).not.toContain("medium-tone wood grain");
    expect(prompt).toContain("American residential appliances");
  });

  test("uses American framed style language and the selected color prompt description", () => {
    const prompt = buildPrompt(buildSnapshot(), {
      cabinetStyle: "AMERICAN_FRAMED",
      color: americanWhite
    });

    expect(prompt).toContain("American framed cabinetry");
    expect(prompt).toContain("soft painted white shaker cabinet doors");
    expect(prompt).not.toContain("modern frameless European-style cabinetry");
  });

  test("relays the deterministic cabinet counts instead of inventing them", () => {
    const snapshot = buildSnapshot();
    const baseCount = snapshot.preliminaryCabinets.cabinets.filter(
      (cabinet) => cabinet.kind === "BASE"
    ).length;
    const wallCount = snapshot.preliminaryCabinets.cabinets.filter(
      (cabinet) => cabinet.kind === "WALL"
    ).length;

    const prompt = buildPrompt(snapshot);

    expect(prompt).toContain(`approximately ${baseCount} base cabinet`);
    expect(prompt).toContain(`${wallCount} wall cabinet`);
  });

  test("uses an architectural camera that keeps complete runs inside the frame", () => {
    const prompt = buildPrompt();

    expect(prompt).toContain("corrected verticals");
    expect(prompt).toContain(
      "Keep every required cabinet run fully inside the frame"
    );
    expect(prompt).toContain("Do not use a fisheye lens");
  });

  test.each([
    ["ONE_WALL", "complete run"],
    ["LEFT_L_SHAPE", "open front-right side"],
    ["RIGHT_L_SHAPE", "open front-left side"],
    ["U_SHAPE", "all three cabinet runs"],
    ["PENINSULA", "peninsula attachment point"]
  ] as const)("uses the complete-layout camera for %s", (layout, phrase) => {
    const prompt = buildPrompt(buildSnapshot(layout));
    expect(prompt).toContain(phrase);
  });

  test("shows both parallel galley runs from one open-end viewpoint", () => {
    const prompt = buildPrompt(buildSnapshot("GALLEY"));

    expect(prompt).toContain("open end of the galley aisle");
    expect(prompt).toContain("both opposing parallel cabinet runs on the left and right walls");
    expect(prompt).toContain("On the right wall");
    expect(prompt).not.toContain("front wall behind the camera");
    expect(prompt).not.toContain("behind the viewpoint");
  });

  test("renders a peninsula as connected base cabinetry rather than an island", () => {
    const prompt = buildPrompt(buildSnapshot("PENINSULA"));

    expect(prompt).toContain(
      "The peninsula MUST be physically connected to the left wall cabinetry without any gaps"
    );
    expect(prompt).toContain(
      "Include the continuous peninsula cabinet run shown in the reference image; it is physically connected to the left wall cabinetry without any gaps or walkways, extending horizontally into the room and sharing a single continuous countertop."
    );
    expect(prompt).toContain(
      "On the left wall, from nearest the camera to the far end: the peninsula anchor point (where the peninsula connects to the left wall cabinetry), followed by a refrigerator, set within continuous base and wall cabinetry towards the far end."
    );
  });

  test("walks the layout wall by wall from the deterministic geometry", () => {
    const prompt = buildPrompt();

    expect(prompt).toContain("- Reference 1 controls the camera and 3D massing");
    // Sink and range are clustered on the back run in the default L-shape.
    expect(prompt).toContain("a sink");
    expect(prompt).toContain("a freestanding range (burners with an oven below) with a hood above it");
  });

  test("summarizes rough cooking appliance presence for concept rendering", () => {
    const snapshot = buildSnapshot();
    snapshot.showroomForm.layoutSensitiveCabinets.cookingAppliances = {
      range: { status: "NO", relation: "NOT_APPLICABLE" },
      cooktop: { status: "YES", relation: "BACK_SIDE" },
      wallOven: { status: "YES", relation: "LEFT_SIDE" },
      microwaveOvenCombo: { status: "YES", relation: "RIGHT_SIDE" }
    };

    const prompt = buildPrompt(snapshot);

    expect(prompt).toContain("Cooking appliances:");
    expect(prompt).toContain("built-in cooktop (burners only, no oven");
    expect(prompt).toContain("no oven — DO NOT draw an oven door under it) on the back wall");
    expect(prompt).toContain("wall oven on the left wall");
    expect(prompt).toContain("microwave on the right wall");
  });

  test("describes a stacked wall oven and microwave tower without conflicting rough placement", () => {
    const snapshot = buildSnapshot("L_SHAPE", (form) => {
      form.layoutSensitiveCabinets.ovenMicrowave = {
        configuration: "WALL_OVEN_MICROWAVE_STACK",
        relation: "UNKNOWN"
      };
      form.layoutSensitiveCabinets.cookingAppliances = {
        range: { status: "YES", relation: "BACK_SIDE" },
        cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      };
    });

    const prompt = buildPrompt(snapshot);

    expect(prompt).toContain(
      "Oven / microwave: a stacked wall oven and microwave tower in one tall appliance cabinet."
    );
    expect(prompt).not.toContain("wall oven on an unconfirmed wall");
    expect(prompt).not.toContain(
      "microwave on an unconfirmed wall"
    );
  });

  test("describes separate wall oven and microwave locations without conflicting rough placement", () => {
    const snapshot = buildSnapshot("L_SHAPE", (form) => {
      form.layoutSensitiveCabinets.ovenMicrowave = {
        configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
        relation: "UNKNOWN"
      };
      form.layoutSensitiveCabinets.cookingAppliances = {
        range: { status: "YES", relation: "BACK_SIDE" },
        cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      };
    });

    const prompt = buildPrompt(snapshot);

    expect(prompt).toContain(
      "Oven / microwave: a wall oven and a separate microwave location."
    );
    const wallWalkthrough = prompt
      .split("\n")
      .filter((line) => line.startsWith("On the "))
      .join(" ");
    expect(wallWalkthrough).toContain("a wall oven");
    expect(wallWalkthrough).toContain("a microwave");
    expect(wallWalkthrough.match(/a wall oven/g) ?? []).toHaveLength(1);
    expect(wallWalkthrough).not.toContain("a wall oven and a wall oven");
    expect(prompt).not.toContain("wall oven on an unconfirmed wall");
    expect(prompt).not.toContain(
      "microwave on an unconfirmed wall"
    );
  });

  test.each([
    ["PENINSULA", { onPeninsula: true, position: 120 }, "peninsula"],
    ["ISLAND", { onIsland: true, position: 120 }, "island"]
  ] as const)(
    "renders a standalone %s microwave under-counter without inventing a tall cabinet",
    (layout, override, surface) => {
      const snapshot = buildSnapshot(
        layout,
        (form) => {
          form.layoutSensitiveCabinets.ovenMicrowave = {
            configuration: "MICROWAVE_DRAWER",
            relation: surface === "island" ? "ON_ISLAND" : "UNKNOWN"
          };
          form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = {
            status: "YES",
            relation: surface === "island" ? "ON_ISLAND" : "UNKNOWN"
          };
          if (layout === "ISLAND") {
            form.layoutSensitiveCabinets.island = {
              status: "YES",
              requested: true,
              functions: []
            };
          }
        },
        { microwaveOvenCombo: override }
      );

      const prompt = buildPrompt(snapshot);

      expect(prompt).toContain("under-counter");
      expect(prompt).toContain(`${surface} base cabinet`);
      expect(prompt).toContain("Do not add a tall cabinet");
      const wallWalkthrough = prompt
        .split("\n")
        .filter((line) => line.startsWith("On the ") && !line.includes("island") && !line.includes("peninsula"))
        .join(" ");
      expect(wallWalkthrough).not.toContain("a microwave");
      expect(prompt).toContain(
        layout === "PENINSULA" ? "On the peninsula: a microwave." : "On the island: a microwave."
      );
    }
  );

  test("keeps a wall oven and microwave stack in one tall cabinet", () => {
    const prompt = buildPrompt(
      buildSnapshot("U_SHAPE", (form) => {
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
      })
    );

    expect(prompt).toContain(
      "microwave above the wall oven in one tall appliance cabinet"
    );
    expect(prompt).not.toContain("island base cabinet");
    expect(prompt).not.toContain("peninsula base cabinet");
  });

  test.each([
    [
      "UPPER_CABINET_MICROWAVE",
      "integrated into an upper wall cabinet"
    ],
    [
      "COUNTERTOP_MICROWAVE",
      "freestanding countertop microwave"
    ]
  ] as const)("preserves %s placement", (configuration, phrase) => {
    const prompt = buildPrompt(
      buildSnapshot("LEFT_L_SHAPE", (form) => {
        form.layoutSensitiveCabinets.ovenMicrowave = {
          configuration,
          relation: "UNKNOWN"
        };
        form.layoutSensitiveCabinets.cookingAppliances.microwaveOvenCombo = {
          status: "YES",
          relation: "UNKNOWN"
        };
      })
    );

    expect(prompt).toContain(phrase);
  });

  test("names the corner cabinet and forbids dropping it", () => {
    const prompt = buildPrompt();

    expect(prompt).toContain("Corner cabinetry:");
    expect(prompt).toContain("back-left corner");
    expect(prompt).toContain("Do not omit the corner cabinet");
  });

  test("constrains the front-wall door behind the camera", () => {
    const prompt = buildPrompt();

    // Default door is on the front wall (behind the camera).
    expect(prompt).toContain("The entry door is on the front wall behind the camera");
    expect(prompt).toContain("must NOT appear on the back, left, or right walls");
  });

  test("renders an open passage as a cased opening, not a swinging door", () => {
    const prompt = buildPrompt(
      buildSnapshot("U_SHAPE", (form) => {
        form.openings.doors = {
          status: "YES",
          items: [{ location: "LEFT_SIDE", kind: "OPEN_PASSAGE", width: null }]
        };
      })
    );

    expect(prompt).toContain("open passage");
    expect(prompt).toContain("no swinging door leaf");
  });

  test("keeps a galley right-wall (originally bottom) fridge visible on its actual run", () => {
    const prompt = buildPrompt(buildSnapshot("GALLEY"));
    const rightWall = prompt
      .split("\n")
      .find((line) => line.startsWith("On the right wall"));

    expect(rightWall).toBeDefined();
    expect(rightWall ?? "").toContain("a refrigerator");
    expect(prompt).not.toContain("behind the viewpoint");
  });

  test("is deterministic for the same snapshot", () => {
    const snapshot = buildSnapshot();
    expect(buildPrompt(snapshot)).toBe(buildPrompt(snapshot));
  });
});

// Phase 1 of docs/ai-eval-plan.md: a deterministic golden matrix over the
// representative layouts. Pins each shape's prompt language and guarantees the
// non-authoritative safety markers survive for EVERY shape (not just the
// default), so a prompt edit can't silently break one layout or drop the
// sales-concept boundary. Free regression net; no image model called.
describe("golden layout-phrase matrix", () => {
  const LAYOUTS: Array<[Round1FormInput["layoutPreference"], string]> = [
    ["ONE_WALL", "single-wall (one-wall) kitchen"],
    ["GALLEY", "galley kitchen with two parallel runs"],
    ["LEFT_L_SHAPE", "left L-shaped kitchen"],
    ["RIGHT_L_SHAPE", "right L-shaped kitchen"],
    ["U_SHAPE", "U-shaped kitchen"],
    ["PENINSULA", "kitchen with a continuous peninsula extending from the left wall"],
    ["ISLAND", "kitchen with a central island"]
  ];

  for (const [layout, phrase] of LAYOUTS) {
    test(`${layout}: right shape language + safety markers intact`, () => {
      const prompt = buildPrompt(buildSnapshot(layout));
      expect(prompt).toContain(phrase);
      expect(prompt).toContain("sales-estimate concept image only");
      expect(prompt.toLowerCase()).toContain("not a production drawing");
    });
  }
});
