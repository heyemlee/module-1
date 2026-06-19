import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import { mapRound1StateRow } from "./round1-postgres-repository";

describe("round1 postgres mappers", () => {
  test("maps editable Round 1 state from json rows", () => {
    // The stored form is validated through round1FormSchema on read, so the
    // fixture uses a full default form (a partial object would fail parsing).
    const showroomFormJson = JSON.parse(JSON.stringify(createDefaultShowroomForm()));
    const state = mapRound1StateRow({
      project_id: "p1",
      showroom_form_json: showroomFormJson,
      position_overrides_json: { sink: { wall: "TOP", center: 40 } },
      fixed_positions_confirmed: true,
      cabinet_fill_generated: false,
      updated_at: new Date("2026-06-19T00:00:00.000Z")
    });
    expect(state.projectId).toBe("p1");
    expect(state.positionOverrides).toEqual({ sink: { wall: "TOP", center: 40 } });
    expect(state.fixedPositionsConfirmed).toBe(true);
  });
});
