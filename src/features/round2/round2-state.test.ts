import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  intentUnlocked,
  openIntentCount,
  proposalUnlocked,
  reduceRound2Prototype
} from "./round2-state";
import { ROUND1_REFERENCE_FIXTURE } from "./round2-fixtures";
import {
  hasBlockingDecisions,
  initializeMeasurements
} from "./model/round2-model";
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

    // Submitting hands off to design intent; the proposal is still ungenerated
    // and therefore still gated.
    const submitted = reduceRound2Prototype(completeMeasurements(locked), {
      type: "SUBMIT_MEASUREMENT"
    });
    expect(submitted.task).toBe("INTENT");
    expect(intentUnlocked(submitted)).toBe(true);
    expect(proposalUnlocked(submitted)).toBe(false);
    expect(
      reduceRound2Prototype(submitted, { type: "SET_TASK", task: "PROPOSAL" })
        .task
    ).toBe("INTENT");

    const generated = reduceRound2Prototype(submitted, {
      type: "GENERATE_PROPOSAL"
    });
    expect(proposalUnlocked(generated)).toBe(true);
    expect(generated.task).toBe("PROPOSAL");

    const advanced = reduceRound2Prototype(generated, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });
    expect(advanced.task).toBe("PROPOSAL");
  });

  test("gates design intent until the room is fully measured", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const clearedKey = Object.keys(locked.measurements)[0];
    const incomplete = reduceRound2Prototype(locked, {
      type: "EDIT_MEASUREMENT",
      field: clearedKey,
      value: null
    });

    expect(intentUnlocked(incomplete)).toBe(false);
    expect(
      reduceRound2Prototype(incomplete, { type: "SET_TASK", task: "INTENT" })
        .task
    ).toBe("MEASUREMENT");

    const complete = completeMeasurements(locked);
    expect(intentUnlocked(complete)).toBe(true);
    expect(
      reduceRound2Prototype(complete, { type: "SET_TASK", task: "INTENT" }).task
    ).toBe("INTENT");

    // Once a proposal exists, intent stays reachable even if a measurement is
    // cleared again — revising intent must not depend on that.
    const generated = submitComplete(createRound2PrototypeState("SALES"));
    const cleared = reduceRound2Prototype(generated, {
      type: "EDIT_MEASUREMENT",
      field: clearedKey,
      value: null
    });
    expect(intentUnlocked(cleared)).toBe(true);
  });

  test("clears a prior cabinet selection when opening the proposal", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = reduceRound2Prototype(submitted, {
      type: "SELECT_OBJECT",
      objectId: "demo-cabinet",
      wall: "A"
    });
    const measurement = reduceRound2Prototype(selected, {
      type: "SET_TASK",
      task: "MEASUREMENT"
    });
    const reopened = reduceRound2Prototype(measurement, {
      type: "SET_TASK",
      task: "PROPOSAL"
    });

    expect(reopened.selectedObjectId).toBeNull();
  });

  test("does not restore a cabinet editor when reopening a saved proposal", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const restored = reduceRound2Prototype(submitted, {
      type: "RESTORE_DRAFT",
      state: { ...submitted, selectedObjectId: "previous-cabinet" }
    });

    expect(restored.selectedObjectId).toBeNull();
  });

  test("requires complete dynamic measurements before submit hands off to intent", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    // The layout pre-fills every field, so clear a required one to recreate the
    // incomplete state the submit gate must reject.
    const clearedKey = Object.keys(locked.measurements)[0];
    const incomplete = reduceRound2Prototype(locked, {
      type: "EDIT_MEASUREMENT",
      field: clearedKey,
      value: null
    });
    const blocked = reduceRound2Prototype(incomplete, {
      type: "SUBMIT_MEASUREMENT"
    });

    expect(blocked.measurementStatus).toBe("DRAFT");
    expect(blocked.model?.walls[0].segments).toHaveLength(0);

    const completed = completeMeasurements(locked);
    const submitted = reduceRound2Prototype(completed, {
      type: "SUBMIT_MEASUREMENT"
    });

    // Submit closes the measurement and opens design intent. It deliberately
    // builds nothing: the intent answers shape the segments.
    expect(submitted.measurementStatus).toBe("SUBMITTED");
    expect(submitted.task).toBe("INTENT");
    expect(submitted.proposalStatus).toBe("STALE");
    expect(submitted.drawingStatus).toBe("STALE");
    expect(submitted.model?.walls[0].segments).toHaveLength(0);
    expect(submitted.selectedObjectId).toBeNull();

    const generated = reduceRound2Prototype(submitted, {
      type: "GENERATE_PROPOSAL"
    });

    expect(generated.task).toBe("PROPOSAL");
    expect(generated.proposalStatus).toBe("NEEDS_DECISION");
    expect(generated.drawingStatus).toBe("REVIEW_READY");
    expect(generated.model?.walls[0].segments.length).toBeGreaterThan(0);
    expect(
      generated.model?.decisionItems.some((item) =>
        item.title.includes("Confirmation required")
      )
    ).toBe(true);
  });

  test("initializes design-intent defaults without treating them as confirmed", () => {
    const locked = lock(createRound2PrototypeState("SALES"));

    expect(Object.keys(locked.designIntent.answers).length).toBeGreaterThan(0);
    expect(locked.designIntent.answers["hood.style"]).toBe("cabinetInsert");
    expect(locked.designIntent.answers["hardware.style"]).toBeUndefined();
    expect(locked.designIntent.confirmedKeys).toEqual([]);
  });

  test("confirms a design-intent answer when a chip is selected", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const updated = reduceRound2Prototype(locked, {
      type: "SET_DESIGN_INTENT",
      key: "hood.style",
      value: "chimney"
    });

    expect(updated.designIntent.answers["hood.style"]).toBe("chimney");
    expect(updated.designIntent.confirmedKeys).toEqual(["hood.style"]);
  });

  test("selecting an option in the measurement checklist does not confirm it", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const drafted = reduceRound2Prototype(locked, {
      type: "SET_DESIGN_INTENT",
      key: "hood.style",
      value: "chimney",
      confirm: false
    });

    expect(drafted.designIntent.answers["hood.style"]).toBe("chimney");
    expect(drafted.designIntent.confirmedKeys).toEqual([]);

    const confirmed = reduceRound2Prototype(drafted, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["hood.style"]
    });

    // Confirming settles the question without touching the value.
    expect(confirmed.designIntent.answers["hood.style"]).toBe("chimney");
    expect(confirmed.designIntent.confirmedKeys).toEqual(["hood.style"]);
  });

  test("counts unconfirmed intent groups for the stage chip", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const total = openIntentCount(locked);
    expect(total).toBeGreaterThan(0);

    const hood = reduceRound2Prototype(locked, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["hood.style"]
    });
    expect(openIntentCount(hood)).toBe(total - 1);

    // The merged upper-height pair is one group: confirming half of it does not
    // move the count.
    const half = reduceRound2Prototype(hood, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["uppers.termination"]
    });
    expect(openIntentCount(half)).toBe(total - 1);

    const whole = reduceRound2Prototype(half, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["uppers.moulding"]
    });
    expect(openIntentCount(whole)).toBe(total - 2);
  });

  test("changing a confirmed answer from the checklist reopens it", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const confirmed = reduceRound2Prototype(locked, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["hood.style", "trash.location"]
    });
    const reopened = reduceRound2Prototype(confirmed, {
      type: "SET_DESIGN_INTENT",
      key: "hood.style",
      value: "chimney",
      confirm: false
    });

    expect(reopened.designIntent.confirmedKeys).toEqual(["trash.location"]);
  });

  test("confirming an intent retires its decision without a new proposal version", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    expect(
      submitted.model?.decisionItems.some(
        (item) => item.id === "decision-intent-hood.style"
      )
    ).toBe(true);

    const confirmed = reduceRound2Prototype(submitted, {
      type: "CONFIRM_DESIGN_INTENT",
      keys: ["hood.style"]
    });

    expect(
      confirmed.model?.decisionItems.some(
        (item) => item.id === "decision-intent-hood.style"
      )
    ).toBe(false);
    // Nothing geometric moved, so the proposal is neither re-versioned nor
    // marked stale.
    expect(confirmed.proposalVersion).toBe(submitted.proposalVersion);
    expect(confirmed.drawingStatus).toBe(submitted.drawingStatus);
    expect(confirmed.model?.walls).toEqual(submitted.model?.walls);
  });

  test("adopting a relocked basis resets design intent to fresh defaults", () => {
    const locked = reduceRound2Prototype(
      lock(createRound2PrototypeState("SALES")),
      {
        type: "SET_DESIGN_INTENT",
        key: "hood.style",
        value: "chimney"
      }
    );
    const replaced = reduceRound2Prototype(locked, {
      type: "ADOPT_BASIS",
      reference: referenceWithId("fresh-layout"),
      version: 2
    });

    expect(replaced.designIntent.answers["hood.style"]).toBe("cabinetInsert");
    expect(replaced.designIntent.confirmedKeys).toEqual([]);
  });

  test("generates without intent confirmation and removes confirmed defaults from decisions", () => {
    const locked = lock(createRound2PrototypeState("SALES"));
    const confirmed = reduceRound2Prototype(locked, {
      type: "SET_DESIGN_INTENT",
      key: "hood.style",
      value: "cabinetInsert"
    });
    const submitted = reduceRound2Prototype(completeMeasurements(confirmed), {
      type: "SUBMIT_MEASUREMENT"
    });
    const generated = reduceRound2Prototype(submitted, {
      type: "GENERATE_PROPOSAL"
    });

    // Unconfirmed intent never blocks generation; it rides along as decisions.
    expect(generated.task).toBe("PROPOSAL");
    expect(
      generated.model?.decisionItems.some(
        (item) => item.id === "decision-intent-hood.style"
      )
    ).toBe(false);
    expect(generated.model?.decisionItems.length).toBeGreaterThan(0);
  });

  test("keeps unconfirmed intent decisions after a proposal adjustment", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const adjusted = reduceRound2Prototype(submitted, {
      type: "STEP_CABINET_WIDTH",
      objectId: selected.id,
      widthSixteenths: 30 * 16
    });

    expect(
      adjusted.model?.decisionItems.some((item) =>
        item.id.startsWith("decision-intent-")
      )
    ).toBe(true);
    expect(adjusted.proposalStatus).toBe("NEEDS_DECISION");
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
      widthSixteenths: 30 * 16
    });
    const segment = segmentById(adjusted, selected.id);
    const wall = adjusted.model!.walls.find((item) => item.id === selected.wallId)!;
    const baseTotal = wall.segments
      .filter((item) => item.tier === selected.tier)
      .reduce((sum, item) => sum + item.widthSixteenths, 0);

    expect(segment?.widthSixteenths).toBe(30 * 16);
    expect(baseTotal).toBe(wall.lengthSixteenths);
    expect(adjusted.proposalVersion).toBe(submitted.proposalVersion + 1);
  });

  test("blocks Round 2 tasks until a design basis is adopted", () => {
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

  test("adopting a relocked basis invalidates downstream output", () => {
    const locked = lock(createRound2PrototypeState("DESIGNER"));
    const nextReference = referenceWithId("snapshot-2");
    const replaced = reduceRound2Prototype(locked, {
      type: "ADOPT_BASIS",
      reference: nextReference,
      version: 2
    });

    expect(replaced.referenceVersion).toBe(2);
    expect(replaced.referenceSnapshotId).toBe("snapshot-2");
    expect(replaced.measurementStatus).toBe("DRAFT");
    expect(replaced.proposalStatus).toBe("STALE");
    expect(replaced.drawingStatus).toBe("STALE");
    // Measurements re-initialize from the newly adopted reference: field
    // measurement opens pre-filled with the Round 1 layout presets (wall
    // lengths, opening sizes) rather than blank.
    expect(replaced.measurements).toEqual(
      initializeMeasurements(replaced.model!)
    );
    expect(
      Object.values(replaced.measurements).some((value) => value != null)
    ).toBe(true);
  });

  test("rejects a non-standard appliance width", () => {
    const seeded = reduceRound2Prototype(
      withFridgeFixedPoint(
        submitComplete(createRound2PrototypeState("DESIGNER"))
      ),
      {
        type: "SET_DESIGN_INTENT",
        key: `fridge.${FRIDGE_FIXED_POINT_ID}.above`,
        value: "wallCabinet"
      }
    );
    const fridge = seeded.model!.walls
      .flatMap((wall) => wall.segments)
      .find(
        (segment) =>
          segment.kind === "appliance" &&
          segment.sourceFixedPointId === FRIDGE_FIXED_POINT_ID
      )!;

    const invalid = reduceRound2Prototype(seeded, {
      type: "SET_APPLIANCE_WIDTH",
      objectId: fridge.id,
      widthSixteenths: 33 * 16
    });

    expect(invalid).toBe(seeded);
  });

  test("ignores appliance width edits from a non-designer or on a cabinet", () => {
    const seeded = reduceRound2Prototype(
      withFridgeFixedPoint(
        submitComplete(createRound2PrototypeState("DESIGNER"))
      ),
      {
        type: "SET_DESIGN_INTENT",
        key: `fridge.${FRIDGE_FIXED_POINT_ID}.above`,
        value: "wallCabinet"
      }
    );
    const fridge = seeded.model!.walls
      .flatMap((wall) => wall.segments)
      .find(
        (segment) =>
          segment.kind === "appliance" &&
          segment.sourceFixedPointId === FRIDGE_FIXED_POINT_ID
      )!;

    // A sales viewer cannot resize appliances.
    const salesState: Round2PrototypeState = { ...seeded, role: "SALES" };
    const asSales = reduceRound2Prototype(salesState, {
      type: "SET_APPLIANCE_WIDTH",
      objectId: fridge.id,
      widthSixteenths: 30 * 16
    });
    expect(asSales).toBe(salesState);

    // A cabinet id is not an appliance, so the action is a no-op.
    const cabinet = seeded.model!.walls
      .flatMap((wall) => wall.segments)
      .find((segment) => segment.kind === "cabinet")!;
    const noop = reduceRound2Prototype(seeded, {
      type: "SET_APPLIANCE_WIDTH",
      objectId: cabinet.id,
      widthSixteenths: 30 * 16
    });
    expect(noop).toBe(seeded);
  });

  test("stores a front exception and marks the drawings stale", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const adjusted = reduceRound2Prototype(submitted, {
      type: "SET_SEGMENT_FRONT",
      objectId: selected.id,
      front: { doorCount: 1, hardware: "fingerPull" }
    });
    const segment = segmentById(adjusted, selected.id);

    expect(segment?.front).toEqual({ doorCount: 1, hardware: "fingerPull" });
    expect(segment?.widthSixteenths).toBe(selected.widthSixteenths);
    expect(adjusted.drawingStatus).toBe("STALE");
    expect(adjusted.proposalVersion).toBe(submitted.proposalVersion + 1);
  });

  test("regenerates proposal geometry when a submitted corner strategy changes", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    expect(
      submitted.model?.walls
        .flatMap((wall) => wall.segments)
        .some(
          (segment) =>
            segment.sourceCornerId === "TL" &&
            segment.cabinetKind === "corner" &&
            segment.label.startsWith("LS")
        )
    ).toBe(true);

    const adjusted = reduceRound2Prototype(submitted, {
      type: "SET_DESIGN_INTENT",
      key: "corner.TL.strategy",
      value: "blindBase"
    });

    expect(adjusted.measurementStatus).toBe("SUBMITTED");
    expect(adjusted.designIntent.answers["corner.TL.strategy"]).toBe(
      "blindBase"
    );
    expect(
      adjusted.model?.walls
        .flatMap((wall) => wall.segments)
        .some(
          (segment) =>
            segment.sourceCornerId === "TL" &&
            segment.cabinetKind === "corner" &&
            segment.label.startsWith("BB")
        )
    ).toBe(true);
    expect(
      adjusted.model?.walls
        .flatMap((wall) => wall.segments)
        .some(
          (segment) =>
            segment.sourceCornerId === "TL" &&
            segment.kind === "gap" &&
            segment.label === "Blind corner"
        )
    ).toBe(true);
    expect(adjusted.drawingStatus).toBe("STALE");
    expect(adjusted.proposalVersion).toBe(submitted.proposalVersion + 1);
  });

  test("regenerates the fridge surround live and keeps the fridge selected", () => {
    const withFridge = withFridgeFixedPoint(
      submitComplete(createRound2PrototypeState("DESIGNER"))
    );
    const key = `fridge.${FRIDGE_FIXED_POINT_ID}.above`;

    const adjusted = reduceRound2Prototype(withFridge, {
      type: "SET_DESIGN_INTENT",
      key,
      value: "wallCabinet"
    });

    const fridgeSegment = adjusted.model?.walls
      .flatMap((wall) => wall.segments)
      .find(
        (segment) =>
          segment.kind === "appliance" &&
          segment.sourceFixedPointId === FRIDGE_FIXED_POINT_ID
      );

    expect(adjusted.measurementStatus).toBe("SUBMITTED");
    expect(adjusted.designIntent.answers[key]).toBe("wallCabinet");
    expect(fridgeSegment).toBeDefined();
    // A wall cabinet now sits directly above the fridge tall unit.
    expect(hasUpperCabinetAboveFridge(adjusted)).toBe(true);
    // Selection stays on the fridge rather than jumping to the first cabinet.
    expect(adjusted.selectedObjectId).toBe(fridgeSegment?.id);
    expect(adjusted.proposalVersion).toBe(withFridge.proposalVersion + 1);
  });

  test("still regenerates the fridge surround after an unrelated intent change", () => {
    const withFridge = withFridgeFixedPoint(
      submitComplete(createRound2PrototypeState("DESIGNER"))
    );
    // A non-live intent edit (hood style, trash location, …) stales the generated
    // proposal but must leave field measurement alone — design intent is its own
    // stage and no longer reopens the measurement.
    const staled = reduceRound2Prototype(withFridge, {
      type: "SET_DESIGN_INTENT",
      key: "hood.style",
      value: "chimney"
    });
    expect(staled.measurementStatus).toBe("SUBMITTED");
    expect(staled.proposalStatus).toBe("STALE");

    const adjusted = reduceRound2Prototype(staled, {
      type: "SET_DESIGN_INTENT",
      key: `fridge.${FRIDGE_FIXED_POINT_ID}.above`,
      value: "wallCabinet"
    });

    expect(hasUpperCabinetAboveFridge(adjusted)).toBe(true);
    // The live regen must not fake a submit either way.
    expect(adjusted.measurementStatus).toBe("SUBMITTED");
  });

  test("steps the global height profile and keeps the selection", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    expect(submitted.model?.heightProfile).not.toBeNull();

    const adjusted = reduceRound2Prototype(submitted, {
      type: "SET_HEIGHT_PROFILE",
      profile: { upperHeightSixteenths: 30 * 16 }
    });

    expect(adjusted.model?.heightProfile?.upperHeightSixteenths).toBe(30 * 16);
    expect(adjusted.selectedObjectId).toBe(submitted.selectedObjectId);
    expect(adjusted.drawingStatus).toBe("STALE");

    const sales = reduceRound2Prototype(
      { ...submitted, role: "SALES" },
      { type: "SET_HEIGHT_PROFILE", profile: { upperHeightSixteenths: 30 * 16 } }
    );
    expect(sales.model?.heightProfile?.upperHeightSixteenths).not.toBe(30 * 16);
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

  test("records which filler absorbed a width step and clears it on selection", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const shrunk = reduceRound2Prototype(submitted, {
      type: "STEP_CABINET_WIDTH",
      objectId: selected.id,
      widthSixteenths: selected.widthSixteenths - 16
    });

    expect(shrunk.lastAbsorbed).not.toBeNull();
    expect(shrunk.lastAbsorbed?.segmentId).not.toBe(selected.id);
    expect(shrunk.lastAbsorbed?.deltaSixteenths).toBe(16);
    const absorber = segmentById(shrunk, shrunk.lastAbsorbed!.segmentId);
    expect(absorber?.kind).toBe("filler");

    const reselected = reduceRound2Prototype(shrunk, {
      type: "SELECT_WALL",
      wall: selected.wallId
    });
    expect(reselected.lastAbsorbed).toBeNull();
  });

  test("repositions remainder space with SET_FILLER_PLACEMENT and keeps runs closed", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const shrunk = reduceRound2Prototype(submitted, {
      type: "STEP_CABINET_WIDTH",
      objectId: selected.id,
      widthSixteenths: selected.widthSixteenths - 16
    });
    const fillerId = shrunk.lastAbsorbed!.segmentId;

    const placed = reduceRound2Prototype(shrunk, {
      type: "SET_FILLER_PLACEMENT",
      objectId: fillerId,
      placement: "split"
    });
    const wall = placed.model!.walls.find(
      (item) => item.id === selected.wallId
    )!;
    const tierTotal = wall.segments
      .filter((item) => item.tier === selected.tier)
      .reduce((sum, item) => sum + item.widthSixteenths, 0);

    expect(tierTotal).toBe(wall.lengthSixteenths);
    expect(placed.proposalVersion).toBe(shrunk.proposalVersion + 1);
    expect(placed.lastAbsorbed).toBeNull();
  });

  test("hard-gates a blocking overflow: cannot resolve or reach drawings", () => {
    const submitted = submitComplete(createRound2PrototypeState("DESIGNER"));
    const selected = firstResizableSegment(submitted);
    const overflowed = reduceRound2Prototype(submitted, {
      type: "STEP_CABINET_WIDTH",
      objectId: selected.id,
      widthSixteenths: 400 * 16 // far beyond the wall length
    });

    expect(hasBlockingDecisions(overflowed.model)).toBe(true);
    expect(overflowed.model!.decisionItems).toContainEqual(
      expect.objectContaining({
        severity: "blocking",
        title: "Wall A filler overdrawn"
      })
    );
    expect(overflowed.proposalStatus).toBe("NEEDS_DECISION");

    // "Resolve decision" cannot acknowledge a blocking geometry error.
    const resolved = reduceRound2Prototype(overflowed, {
      type: "RESOLVE_DESIGN_DECISION"
    });
    expect(resolved.proposalStatus).toBe("NEEDS_DECISION");

    // The drawings tab stays locked while the overflow is unresolved.
    const nav = reduceRound2Prototype(overflowed, {
      type: "SET_TASK",
      task: "DRAWINGS"
    });
    expect(nav.task).toBe(overflowed.task);
    expect(nav.task).not.toBe("DRAWINGS");
  });
});

function lock(state: Round2PrototypeState): Round2PrototypeState {
  return reduceRound2Prototype(state, {
    type: "ADOPT_BASIS",
    reference: ROUND1_REFERENCE_FIXTURE,
    version: 1
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

/**
 * Walks a fresh state all the way to a generated proposal. Submitting the
 * measurement now only hands off to the design-intent stage, so reaching the
 * proposal takes the stage's own exit as well.
 */
function submitComplete(state: Round2PrototypeState): Round2PrototypeState {
  const submitted = reduceRound2Prototype(
    completeMeasurements(lock(state)),
    { type: "SUBMIT_MEASUREMENT" }
  );
  return reduceRound2Prototype(submitted, { type: "GENERATE_PROPOSAL" });
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

const FRIDGE_FIXED_POINT_ID = "state-test-fridge";

/**
 * The reference fixture carries no fridge, so add one to the first wall; the
 * next autofill run (triggered by the intent edit under test) places the tall
 * unit for it.
 */
function withFridgeFixedPoint(
  state: Round2PrototypeState
): Round2PrototypeState {
  return {
    ...state,
    model: state.model && {
      ...state.model,
      walls: state.model.walls.map((wall, index) =>
        index === 0
          ? {
              ...wall,
              fixedPoints: [
                ...wall.fixedPoints,
                {
                  id: FRIDGE_FIXED_POINT_ID,
                  type: "appliance",
                  label: "Fridge",
                  sourceWall: wall.sourceWall,
                  order: 99,
                  positionRatio: 0.05,
                  symbol: "fridge",
                  widthSixteenths: 36 * 16
                }
              ]
            }
          : wall
      )
    }
  };
}

function hasUpperCabinetAboveFridge(state: Round2PrototypeState): boolean {
  return Boolean(
    state.model?.walls
      .flatMap((wall) => wall.segments)
      .some(
        (segment) =>
          segment.tier === "upper" &&
          segment.kind === "cabinet" &&
          segment.sourceFixedPointId === FRIDGE_FIXED_POINT_ID
      )
  );
}

function firstResizableSegment(state: Round2PrototypeState) {
  const segment = state.model?.walls
    .flatMap((wall) => wall.segments)
    .find(
      (item) =>
        item.tier === "base" &&
        item.kind === "cabinet" &&
        item.cabinetKind !== "corner" &&
        item.sourceCornerId == null
    );
  if (!segment) throw new Error("Expected a resizable base segment");
  return segment;
}

function segmentById(state: Round2PrototypeState, id: string) {
  return state.model?.walls
    .flatMap((wall) => wall.segments)
    .find((segment) => segment.id === id);
}
