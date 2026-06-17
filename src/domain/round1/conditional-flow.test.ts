import { describe, expect, test } from "vitest";
import { normalizeRound1Form } from "./index";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";

describe("Round 1 conditional intake flow", () => {
  test("removes under-window sink dependency when windows are explicitly absent", () => {
    const form = createDefaultShowroomForm();

    const result = normalizeRound1Form({
      ...form,
      openings: {
        ...form.openings,
        windows: { status: "NO", items: [] }
      },
      fixtures: {
        ...form.fixtures,
        sink: { ...form.fixtures.sink, relation: "UNDER_WINDOW" }
      }
    });

    expect(result.normalized.openings.windows).toMatchObject({
      status: "NO",
      items: []
    });
    expect(result.normalized.fixtures).toMatchObject({
      sink: { relation: "UNKNOWN" }
    });
    expect(result.confirmationItems.map((item) => item.code)).toContain(
      "SINK_UNDER_WINDOW_BUT_NO_WINDOW"
    );
  });

  test("does not ask dishwasher size or position when dishwasher is absent", () => {
    const form = createDefaultShowroomForm();

    const result = normalizeRound1Form({
      ...form,
      fixtures: {
        ...form.fixtures,
        dishwasher: {
          status: "NONE",
          size: null,
          relation: "UNKNOWN"
        }
      }
    });

    expect(result.confirmationItems.map((item) => item.code)).not.toContain(
      "MISSING_APPLIANCE_DIMENSION"
    );
    expect(result.normalized.fixtures).toMatchObject({
      dishwasher: { status: "NONE", size: null, relation: "NOT_APPLICABLE" }
    });
  });

  test("flags unknown window status without asking for impossible window details", () => {
    const form = createDefaultShowroomForm();

    const result = normalizeRound1Form({
      ...form,
      openings: {
        ...form.openings,
        windows: { status: "UNKNOWN", items: [] }
      }
    });

    expect(result.confirmationItems.map((item) => item.code)).toContain(
      "UNKNOWN_WINDOW_STATUS"
    );
    expect(result.confirmationItems.map((item) => item.code)).not.toContain(
      "MISSING_WINDOW_WIDTH"
    );
  });

  test("does not emit hidden first-phase width or MEP movability confirmation codes", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form({
      ...form,
      openings: {
        doors: {
          status: "YES",
          items: [{ location: "FRONT_SIDE", width: null }]
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
      }
    });

    const codes = result.confirmationItems.map((item) => item.code);
    expect(codes).not.toContain("MISSING_DOOR_WIDTH");
    expect(codes).not.toContain("MISSING_WINDOW_WIDTH");
    expect(codes).not.toContain("UNKNOWN_MEP_MOVABILITY");
  });

  test("does not require detailed corner cabinet selection for Round 1 corner layouts", () => {
    const form = createDefaultShowroomForm();
    const result = normalizeRound1Form({
      ...form,
      layoutPreference: "U_SHAPE_ISLAND",
      layoutSensitiveCabinets: {
        ...form.layoutSensitiveCabinets,
        cornerCabinet: { preferredType: "NO_PREFERENCE" }
      }
    });

    expect(result.confirmationItems.map((item) => item.code)).not.toContain(
      "CORNER_CABINET_UNCONFIRMED"
    );
    expect(result.normalized.layoutSensitiveCabinets.cornerCabinet).toMatchObject({
      preferredType: "NO_PREFERENCE",
      confirmationRequired: false
    });
  });
});
