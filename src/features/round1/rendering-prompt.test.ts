import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import { buildRound1RenderingPrompt } from "./rendering-prompt";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot, type Round1Snapshot } from "./snapshot";

function buildSnapshot(
  layoutPreference: ReturnType<
    typeof createDefaultShowroomForm
  >["layoutPreference"] = "L_SHAPE",
  configureForm?: (form: Round1FormInput) => void
): Round1Snapshot {
  const form = { ...createDefaultShowroomForm(), layoutPreference };
  configureForm?.(form);
  const { normalized, confirmationItems, readiness } =
    normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildRound1Snapshot({
    showroomForm: form,
    normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [...confirmationItems, ...estimate.confirmationItems],
    readiness,
    now: () => new Date("2026-06-17T00:00:00.000Z")
  });
}

describe("buildRound1RenderingPrompt", () => {
  test("asks for a realistic concept that defers placement to the reference image", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("concept rendering");
    expect(prompt).toContain("authoritative spatial reference");
    expect(prompt).toContain("Kitchen shape:");
  });

  test("marks the output as a non-authoritative sales concept with no on-image text", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("sales-estimate concept image only");
    expect(prompt.toLowerCase()).toContain("not a production drawing");
    expect(prompt).toContain(
      "Do not draw dimension lines, measurements, cabinet codes, labels"
    );
  });

  test("anchors the rendering style to Bay Area single-family homes with modern frameless wood cabinetry", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("California Bay Area");
    expect(prompt).toContain("single-family house");
    expect(prompt).toContain("modern frameless European-style cabinetry");
    expect(prompt).toContain("medium-tone wood grain");
    expect(prompt).toContain("American residential appliances");
  });

  test("relays the deterministic cabinet counts instead of inventing them", () => {
    const snapshot = buildSnapshot();
    const baseCount = snapshot.preliminaryCabinets.cabinets.filter(
      (cabinet) => cabinet.kind === "BASE"
    ).length;
    const wallCount = snapshot.preliminaryCabinets.cabinets.filter(
      (cabinet) => cabinet.kind === "WALL"
    ).length;

    const prompt = buildRound1RenderingPrompt(snapshot);

    expect(prompt).toContain(`approximately ${baseCount} base cabinet`);
    expect(prompt).toContain(`${wallCount} wall cabinet`);
  });

  test("fixes a one-point camera viewpoint", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("one-point perspective");
    expect(prompt).toContain("looking straight at the back wall");
    expect(prompt).toContain("front wall is behind the camera");
  });

  test("walks the layout wall by wall from the deterministic geometry", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("On the back wall, from left to right:");
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

    const prompt = buildRound1RenderingPrompt(snapshot);

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

    const prompt = buildRound1RenderingPrompt(snapshot);

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

    const prompt = buildRound1RenderingPrompt(snapshot);

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

  test("names the corner cabinet and forbids dropping it", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("Corner cabinetry:");
    expect(prompt).toContain("back-left corner");
    expect(prompt).toContain("Do not omit the corner cabinet");
  });

  test("constrains the front-wall door behind the camera", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    // Default door is on the front wall (behind the camera).
    expect(prompt).toContain("The entry door is on the front wall behind the camera");
    expect(prompt).toContain("must NOT appear on the back, left, or right walls");
  });

  test("renders an open passage as a cased opening, not a swinging door", () => {
    const prompt = buildRound1RenderingPrompt(
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

  test("keeps a front-wall fridge behind the camera", () => {
    // A galley puts the default front-side fridge on the front (BOTTOM) wall.
    const prompt = buildRound1RenderingPrompt(buildSnapshot("GALLEY"));
    expect(prompt).toContain("behind the viewpoint");
  });

  test("is deterministic for the same snapshot", () => {
    const snapshot = buildSnapshot();
    expect(buildRound1RenderingPrompt(snapshot)).toBe(
      buildRound1RenderingPrompt(snapshot)
    );
  });
});
