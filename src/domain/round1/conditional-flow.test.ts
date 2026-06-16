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
});
