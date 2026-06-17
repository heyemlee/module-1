import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import { buildRound1RenderingPrompt } from "./rendering-prompt";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot, type Round1Snapshot } from "./snapshot";

function buildSnapshot(): Round1Snapshot {
  const form = createDefaultShowroomForm();
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
    expect(prompt).toContain("a range/cooktop with a hood above it");
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
    expect(prompt).toContain("cooktop on the back wall");
    expect(prompt).toContain("wall oven on the left wall");
    expect(prompt).toContain("microwave / oven combo on the right wall");
  });

  test("names the corner cabinet and forbids dropping it", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    expect(prompt).toContain("Corner cabinetry:");
    expect(prompt).toContain("back-left corner");
    expect(prompt).toContain("Do not omit the corner cabinet");
  });

  test("constrains the door to its wall and keeps the front-wall fridge behind the camera", () => {
    const prompt = buildRound1RenderingPrompt(buildSnapshot());

    // Default door is on the front wall (behind the camera).
    expect(prompt).toContain("The entry door is on the front wall behind the camera");
    expect(prompt).toContain("must NOT appear on the back, left, or right walls");
    // Default fridge is on the front wall too.
    expect(prompt).toContain("behind the viewpoint");
  });

  test("is deterministic for the same snapshot", () => {
    const snapshot = buildSnapshot();
    expect(buildRound1RenderingPrompt(snapshot)).toBe(
      buildRound1RenderingPrompt(snapshot)
    );
  });
});
