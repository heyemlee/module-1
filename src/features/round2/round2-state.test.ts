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

  test("does not approve drawings while a design decision remains", () => {
    const state = createRound2PrototypeState("DESIGNER");
    const blocked = reduceRound2Prototype(state, { type: "MARK_REVIEWED" });
    expect(blocked.drawingStatus).toBe("REVIEW_READY");

    const resolved = reduceRound2Prototype(state, {
      type: "RESOLVE_DESIGN_DECISION"
    });
    const reviewed = reduceRound2Prototype(resolved, {
      type: "MARK_REVIEWED"
    });
    expect(reviewed.drawingStatus).toBe("REVIEWED");
  });

  test("applies a constrained sink-cabinet width adjustment", () => {
    const adjusted = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "SET_SINK_WIDTH", width: 33 }
    );
    expect(adjusted.sinkBaseWidth).toBe(33);
    expect(adjusted.proposalStatus).toBe("NEEDS_DECISION");
  });

  test("blocks Round 2 tasks until a Round 1 reference is locked", () => {
    const initial = createRound2PrototypeState("SALES");
    expect(initial.referenceLocked).toBe(false);

    const blocked = reduceRound2Prototype(initial, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });
    expect(blocked.task).toBe("MEASUREMENT");

    const locked = reduceRound2Prototype(initial, {
      type: "LOCK_REFERENCE",
      snapshotId: "snapshot-1"
    });
    expect(locked.referenceLocked).toBe(true);
    expect(locked.referenceVersion).toBe(1);
    expect(locked.referenceSnapshotId).toBe("snapshot-1");
  });

  test("replacing the Round 1 reference invalidates downstream output", () => {
    const locked = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "LOCK_REFERENCE", snapshotId: "snapshot-1" }
    );
    const replaced = reduceRound2Prototype(locked, {
      type: "REPLACE_REFERENCE",
      snapshotId: "snapshot-2"
    });

    expect(replaced.referenceVersion).toBe(2);
    expect(replaced.referenceSnapshotId).toBe("snapshot-2");
    expect(replaced.proposalStatus).toBe("STALE");
    expect(replaced.drawingStatus).toBe("STALE");
  });

  test("can reopen the Round 1 handoff before relocking another snapshot", () => {
    const locked = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "LOCK_REFERENCE", snapshotId: "snapshot-1" }
    );
    const reopened = reduceRound2Prototype(locked, {
      type: "OPEN_REFERENCE_HANDOFF"
    });

    expect(reopened.referenceLocked).toBe(false);
    expect(reopened.referenceVersion).toBe(1);
    expect(reopened.referenceSnapshotId).toBe("snapshot-1");
  });

  test("stores precise cabinet offsets as a new proposal version", () => {
    const initial = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "LOCK_REFERENCE", snapshotId: "snapshot-1" }
    );
    const adjusted = reduceRound2Prototype(initial, {
      type: "SET_CABINET_OFFSET",
      objectId: "a-03",
      x: 2.5,
      y: 0
    });

    expect(adjusted.cabinetOffsets["a-03"]).toEqual({ x: 2.5, y: 0 });
    expect(adjusted.proposalVersion).toBe(initial.proposalVersion + 1);
    expect(adjusted.proposalStatus).toBe("NEEDS_DECISION");
  });
});
