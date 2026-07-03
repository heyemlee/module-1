import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  proposalUnlocked,
  reduceRound2Prototype
} from "./round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "./round2-fixtures";
import type {
  Round1ReferenceSource,
  Round2PrototypeState
} from "./round2-types";

describe("Round 2 prototype state", () => {
  test("defaults Sales to measurement and Designer to proposal", () => {
    expect(createRound2PrototypeState("SALES").task).toBe("MEASUREMENT");
    expect(createRound2PrototypeState("DESIGNER").task).toBe("PROPOSAL");
  });

  test("keeps field measurement editable and resubmittable after submit", () => {
    const state = lock(createRound2PrototypeState("DESIGNER"));
    const field = Object.keys(state.measurements)[0];
    const draftEdit = reduceRound2Prototype(state, {
      type: "EDIT_MEASUREMENT",
      field,
      value: 2304
    });
    expect(draftEdit.measurements[field]).toBe(2304);

    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    expect(submitted.measurementStatus).toBe("SUBMITTED");

    const submittedEdit = reduceRound2Prototype(submitted, {
      type: "EDIT_MEASUREMENT",
      field,
      value: 2400
    });
    // Editing after submit is allowed; it reverts the stage to draft and marks
    // the downstream proposal stale until it is resubmitted.
    expect(submittedEdit.measurements[field]).toBe(2400);
    expect(submittedEdit.measurementStatus).toBe("DRAFT");
    expect(submittedEdit.proposalStatus).toBe("STALE");
  });

  test("gates proposal and drawings until measurement is submitted", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    expect(proposalUnlocked(locked)).toBe(false);

    const blocked = reduceRound2Prototype(locked, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });
    expect(blocked.task).toBe("MEASUREMENT");

    const submitted = reduceRound2Prototype(completeMeasurements(locked), {
      type: "SUBMIT_MEASUREMENT"
    });
    expect(proposalUnlocked(submitted)).toBe(true);

    const advanced = reduceRound2Prototype(submitted, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });
    expect(advanced.task).toBe("PROPOSAL");
  });

  test("requires complete dynamic measurements before submit autofills proposal model", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const blocked = reduceRound2Prototype(locked, {
      type: "SUBMIT_MEASUREMENT"
    });

    expect(blocked.measurementStatus).toBe("DRAFT");
    expect(blocked.model?.walls[0].segments).toHaveLength(0);

    const completed = completeMeasurements(locked);
    const submitted = reduceRound2Prototype(completed, {
      type: "SUBMIT_MEASUREMENT"
    });

    expect(submitted.measurementStatus).toBe("SUBMITTED");
    expect(submitted.proposalStatus).toBe("READY");
    expect(submitted.drawingStatus).toBe("REVIEW_READY");
    expect(submitted.model?.walls[0].segments.length).toBeGreaterThan(0);
    expect(submitted.selectedObjectId).toBeTruthy();
  });

  test("remeasure blocks review and a new version makes outputs stale", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const requested = reduceRound2Prototype(submitted, {
      type: "REQUEST_REMEASURE",
      objectId: submitted.selectedObjectId ?? "wall-a"
    });
    expect(requested.measurementStatus).toBe("REMEASURE_REQUESTED");
    expect(requested.proposalStatus).toBe("NEEDS_DECISION");

    const resubmitted = reduceRound2Prototype(requested, {
      type: "SUBMIT_NEW_MEASUREMENT"
    });
    expect(resubmitted.measurementVersion).toBe(2);
    expect(resubmitted.proposalStatus).toBe("STALE");
    expect(resubmitted.drawingStatus).toBe("STALE");
  });

  test("does not approve drawings while a design decision remains", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const first = firstResizableSegment(submitted);
    const withDecision = reduceRound2Prototype(submitted, {
      type: "NUDGE_GROUP",
      objectId: first.id,
      direction: "left"
    });
    expect(withDecision.proposalStatus).toBe("NEEDS_DECISION");

    const blocked = reduceRound2Prototype(withDecision, {
      type: "MARK_REVIEWED"
    });
    expect(blocked.drawingStatus).toBe("STALE");

    const resolved = reduceRound2Prototype(withDecision, {
      type: "RESOLVE_DESIGN_DECISION"
    });
    const reviewed = reduceRound2Prototype(resolved, {
      type: "MARK_REVIEWED"
    });
    expect(reviewed.drawingStatus).toBe("STALE");
  });

  test("steps a cabinet width and keeps the same wall run closed", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const adjusted = reduceRound2Prototype(submitted, {
      type: "STEP_CABINET_WIDTH",
      objectId: selected.id,
      widthSixteenths: 33 * 16
    });
    const segment = segmentById(adjusted, selected.id);
    const wall = adjusted.model!.walls.find((item) => item.id === selected.wallId)!;
    const baseTotal = wall.segments
      .filter((item) => item.tier === selected.tier)
      .reduce((sum, item) => sum + item.widthSixteenths, 0);

    expect(segment?.widthSixteenths).toBe(33 * 16);
    expect(baseTotal).toBe(wall.lengthSixteenths);
    expect(adjusted.proposalVersion).toBe(submitted.proposalVersion + 1);
  });

  test("blocks Round 2 tasks until a Round 1 reference is locked", () => {
    const initial = createRound2PrototypeState("SALES");
    expect(initial.referenceLocked).toBe(false);

    const blocked = reduceRound2Prototype(initial, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });
    expect(blocked.task).toBe("MEASUREMENT");

    const locked = lock(initial);
    expect(locked.referenceLocked).toBe(true);
    expect(locked.referenceVersion).toBe(1);
    expect(locked.referenceSnapshotId).toBe(ROUND1_REFERENCE_FIXTURE.id);
    expect(locked.model?.walls.map((wall) => wall.label)).toEqual([
      "A",
      "B",
      "C"
    ]);
  });

  test("locking opens field measurement first, even for a Designer", () => {
    const designer = createRound2PrototypeState("DESIGNER");
    expect(designer.task).toBe("PROPOSAL");

    const locked = lock(designer);
    expect(locked.task).toBe("MEASUREMENT");
  });

  test("replacing the Round 1 reference invalidates downstream output", () => {
    const locked = lock(createRound2PrototypeState("DESIGNER"));
    const nextReference = referenceWithId("snapshot-2");
    const replaced = reduceRound2Prototype(locked, {
      type: "REPLACE_REFERENCE",
      reference: nextReference
    });

    expect(replaced.referenceVersion).toBe(2);
    expect(replaced.referenceSnapshotId).toBe("snapshot-2");
    expect(replaced.measurementStatus).toBe("DRAFT");
    expect(replaced.proposalStatus).toBe("STALE");
    expect(replaced.drawingStatus).toBe("STALE");
    expect(Object.values(replaced.measurements).every((value) => value == null)).toBe(
      true
    );
  });

  test("can reopen the Round 1 handoff before relocking another snapshot", () => {
    const locked = lock(createRound2PrototypeState("DESIGNER"));
    const reopened = reduceRound2Prototype(locked, {
      type: "OPEN_REFERENCE_HANDOFF"
    });

    expect(reopened.referenceLocked).toBe(false);
    expect(reopened.referenceVersion).toBe(1);
    expect(reopened.referenceSnapshotId).toBe(ROUND1_REFERENCE_FIXTURE.id);
  });

  test("nudges a selected segment by redistributing filler", () => {
    const initial = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(initial);
    const adjusted = reduceRound2Prototype(initial, {
      type: "NUDGE_GROUP",
      objectId: selected.id,
      direction: "right"
    });
    const wall = adjusted.model!.walls.find((item) => item.id === selected.wallId)!;
    const tierTotal = wall.segments
      .filter((item) => item.tier === selected.tier)
      .reduce((sum, item) => sum + item.widthSixteenths, 0);

    expect(tierTotal).toBe(wall.lengthSixteenths);
    expect(adjusted.proposalVersion).toBe(initial.proposalVersion + 1);
    expect(adjusted.selectedObjectId).toBe(selected.id);
  });
});

function lock(state: Round2PrototypeState): Round2PrototypeState {
  return reduceRound2Prototype(state, {
    type: "LOCK_REFERENCE",
    reference: ROUND1_REFERENCE_FIXTURE
  });
}

function completeMeasurements(
  state: Round2PrototypeState
): Round2PrototypeState {
  return {
    ...state,
    measurements: Object.fromEntries(
      Object.keys(state.measurements).map((key) => [key, valueForKey(key)])
    ),
    model: state.model
      ? {
          ...state.model,
          walls: state.model.walls.map((wall) => ({
            ...wall,
            lengthSixteenths: valueForKey(`wall.${wall.id}.length`),
            fixedPoints: wall.fixedPoints.map((point) => ({
              ...point,
              widthSixteenths: valueForKey(`opening.${point.id}.width`),
              offsetSixteenths: valueForKey(`opening.${point.id}.offset`)
            }))
          })),
          ceilingHeightSixteenths: valueForKey("room.ceiling")
        }
      : null
  };
}

function submitComplete(state: Round2PrototypeState): Round2PrototypeState {
  return reduceRound2Prototype(completeMeasurements(lock(state)), {
    type: "SUBMIT_MEASUREMENT"
  });
}

function valueForKey(key: string): number {
  if (key === "room.ceiling") return 96 * 16;
  if (key.endsWith(".width")) return 36 * 16;
  if (key.endsWith(".offset")) return 42 * 16;
  return 150 * 16;
}

function referenceWithId(id: string): Round1ReferenceSource {
  return { ...ROUND1_REFERENCE_FIXTURE, id };
}

function firstResizableSegment(state: Round2PrototypeState) {
  const segment = state.model?.walls
    .flatMap((wall) => wall.segments)
    .find(
      (item) =>
        item.tier === "base" &&
        item.kind === "cabinet"
    );
  if (!segment) throw new Error("Expected a resizable base segment");
  return segment;
}

function segmentById(state: Round2PrototypeState, id: string) {
  return state.model?.walls
    .flatMap((wall) => wall.segments)
    .find((segment) => segment.id === id);
}
