import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "./round2-state";

describe("Round 2 prototype state", () => {
  test("defaults Sales to measurement and Designer to proposal", () => {
    expect(createRound2PrototypeState("SALES").task).toBe("MEASUREMENT");
    expect(createRound2PrototypeState("DESIGNER").task).toBe("PROPOSAL");
  });

  test("keeps submitted measurements read only for Designer", () => {
    const state = createRound2PrototypeState("DESIGNER");
    const next = reduceRound2Prototype(state, {
      type: "EDIT_MEASUREMENT",
      field: "wallA",
      value: 2304
    });
    expect(next.measurements.wallA).toBe(state.measurements.wallA);
  });

  test("remeasure blocks review and a new version makes outputs stale", () => {
    const requested = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "REQUEST_REMEASURE", objectId: "wall-a" }
    );
    expect(requested.measurementStatus).toBe("REMEASURE_REQUESTED");
    expect(requested.proposalStatus).toBe("NEEDS_DECISION");

    const resubmitted = reduceRound2Prototype(requested, {
      type: "SUBMIT_NEW_MEASUREMENT"
    });
    expect(resubmitted.measurementVersion).toBe(4);
    expect(resubmitted.proposalStatus).toBe("STALE");
    expect(resubmitted.drawingStatus).toBe("STALE");
  });
});
