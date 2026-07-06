import { autofillRound2Model } from "./model/autofill";
import {
  moveFillerEnd,
  nudgeGroup,
  setHeightProfile,
  setSegmentFront,
  setSegmentKind,
  stepCabinetWidth
} from "./model/adjustments";
import { deriveWallsFromRound1 } from "./model/derive-walls";
import {
  buildIntentConfirmationDecisions,
  initializeDesignIntent,
  setDesignIntentAnswer
} from "./model/design-intent";
import {
  applyMeasurementsToModel,
  initializeMeasurements,
  measurementsComplete,
  requiredMeasurementKeys,
  type Round2Model,
  type WallId
} from "./model/round2-model";
import type {
  Round1ReferenceSource,
  Round2DemoRole,
  Round2Measurements,
  Round2PrototypeAction,
  Round2PrototypeState
} from "./round2-types";

export function createRound2PrototypeState(
  role: Round2DemoRole
): Round2PrototypeState {
  return {
    referenceLocked: false,
    referenceVersion: 0,
    referenceSnapshotId: null,
    reference: null,
    model: null,
    role,
    task: role === "SALES" ? "MEASUREMENT" : "PROPOSAL",
    measurementVersion: 1,
    measurementStatus: "DRAFT",
    measurements: {},
    designIntent: { answers: {}, confirmedKeys: [] },
    proposalVersion: 1,
    proposalStatus: "STALE",
    drawingVersion: 1,
    drawingStatus: "STALE",
    selectedWall: null,
    selectedObjectId: null,
    issueObjectId: null,
    activeMeasurementKey: null,
    activeSheet: "A1",
    drawingZoom: 1
  };
}

export function reduceRound2Prototype(
  state: Round2PrototypeState,
  action: Round2PrototypeAction
): Round2PrototypeState {
  switch (action.type) {
    case "LOCK_REFERENCE":
      return lockReference(state, action.reference, 1);
    case "REPLACE_REFERENCE":
      return lockReference(state, action.reference, state.referenceVersion + 1);
    case "OPEN_REFERENCE_HANDOFF":
      return { ...state, referenceLocked: false };
    case "SET_ROLE":
      // Switching the demo "view as" role must not jump the user into a stage,
      // and never into a stage that is still gated (proposal before submit).
      return { ...state, role: action.role };
    case "SET_TASK":
      if (!state.referenceLocked) return state;
      if (
        (action.task === "PROPOSAL" || action.task === "DRAWINGS") &&
        !proposalUnlocked(state)
      ) {
        return state;
      }
      return { ...state, task: action.task };
    case "EDIT_MEASUREMENT":
      // Field measurement stays editable for whoever is on the step, including
      // after a submit: editing reverts the stage to DRAFT and marks the
      // downstream proposal/drawings stale until it is submitted again.
      if (!state.model) return state;
      return updateMeasurements(state, {
        ...state.measurements,
        [action.field]: action.value
      }, action.field);
    case "SET_ACTIVE_MEASUREMENT":
      return { ...state, activeMeasurementKey: action.field };
    case "SET_DESIGN_INTENT":
      if (!state.model) return state;
      return {
        ...state,
        designIntent: setDesignIntentAnswer(
          state.designIntent,
          action.key,
          action.value
        ),
        measurementStatus: "DRAFT",
        proposalStatus:
          state.measurementStatus === "SUBMITTED"
            ? "STALE"
            : state.proposalStatus,
        drawingStatus:
          state.measurementStatus === "SUBMITTED"
            ? "STALE"
            : state.drawingStatus
      };
    case "SUBMIT_MEASUREMENT":
      return submitMeasurement(state, false);
    case "REQUEST_REMEASURE":
      return {
        ...state,
        measurementStatus: "REMEASURE_REQUESTED",
        proposalStatus: "NEEDS_DECISION",
        issueObjectId: action.objectId
      };
    case "SUBMIT_NEW_MEASUREMENT":
      return submitMeasurement(state, true);
    case "SELECT_WALL":
      return { ...state, selectedWall: action.wall };
    case "SELECT_OBJECT":
      return {
        ...state,
        selectedWall: action.wall,
        selectedObjectId: action.objectId
      };
    case "STEP_CABINET_WIDTH":
      return applyProposalAdjustment(
        state,
        (model) =>
          stepCabinetWidth(model, action.objectId, action.widthSixteenths),
        action.objectId
      );
    case "NUDGE_GROUP":
      return applyProposalAdjustment(
        state,
        (model) => nudgeGroup(model, action.objectId, action.direction),
        action.objectId
      );
    case "MOVE_FILLER_END":
      return applyProposalAdjustment(
        state,
        (model) => moveFillerEnd(model, action.objectId, action.end),
        action.objectId
      );
    case "SET_SEGMENT_KIND":
      return applyProposalAdjustment(
        state,
        (model) =>
          setSegmentKind(model, action.objectId, action.cabinetKind),
        action.objectId
      );
    case "SET_SEGMENT_FRONT":
      return applyProposalAdjustment(
        state,
        (model) => setSegmentFront(model, action.objectId, action.front),
        action.objectId
      );
    case "SET_HEIGHT_PROFILE":
      // Global height chain: no object selection involved.
      return applyProposalAdjustment(
        state,
        (model) => setHeightProfile(model, action.profile),
        null
      );
    case "RESOLVE_DESIGN_DECISION":
      return { ...state, proposalStatus: "READY", issueObjectId: null };
    case "SET_SHEET":
      return { ...state, activeSheet: action.sheet };
    case "SET_DRAWING_ZOOM":
      return {
        ...state,
        drawingZoom: Math.min(1.5, Math.max(0.75, action.zoom))
      };
    case "MARK_REVIEWED":
      return state.proposalStatus === "READY" && state.drawingStatus !== "STALE"
        ? { ...state, drawingStatus: "REVIEWED" }
        : state;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * The proposal and drawings stages are gated until field measurement has been
 * submitted at least once — that submit is what autofills the wall segments the
 * downstream stages render. Editing measurements afterwards keeps them unlocked
 * (segments persist, just marked stale) so the user can move back and forth.
 */
export function proposalUnlocked(state: Round2PrototypeState): boolean {
  return (
    !!state.model && state.model.walls.some((wall) => wall.segments.length > 0)
  );
}

function lockReference(
  state: Round2PrototypeState,
  reference: Round1ReferenceSource,
  referenceVersion: number
): Round2PrototypeState {
  const model = deriveWallsFromRound1(reference.floorPlan);
  const measurements = initializeMeasurements(model);
  const selectedWall = model.walls[0]?.id ?? null;
  const activeMeasurementKey = requiredMeasurementKeys(model)[0] ?? null;

  return {
    ...state,
    referenceLocked: true,
    referenceVersion,
    referenceSnapshotId: reference.id,
    reference,
    model,
    // Locking always opens the field-measurement stage first, for both roles:
    // the proposal/drawings are derived from measurements, so there is nothing
    // meaningful to show on the proposal tab until measurements are submitted.
    task: "MEASUREMENT",
    measurements,
    designIntent: initializeDesignIntent(model),
    measurementStatus: "DRAFT",
    proposalStatus: "STALE",
    drawingStatus: "STALE",
    selectedWall,
    selectedObjectId: null,
    issueObjectId: null,
    activeMeasurementKey
  };
}

function updateMeasurements(
  state: Round2PrototypeState,
  measurements: Round2Measurements,
  activeMeasurementKey: string | null
): Round2PrototypeState {
  if (!state.model) return state;
  const measuredModel = applyMeasurementsToModel(state.model, measurements);
  return {
    ...state,
    model: measuredModel,
    measurements,
    measurementStatus: "DRAFT",
    proposalStatus:
      state.measurementStatus === "SUBMITTED" ? "STALE" : state.proposalStatus,
    drawingStatus:
      state.measurementStatus === "SUBMITTED" ? "STALE" : state.drawingStatus,
    activeMeasurementKey
  };
}

function submitMeasurement(
  state: Round2PrototypeState,
  newVersion: boolean
): Round2PrototypeState {
  if (!state.model || !measurementsComplete(state.model, state.measurements)) {
    return state;
  }

  const model = autofillRound2Model(
    state.model,
    state.measurements,
    state.designIntent
  );
  const firstSelectable = firstSelectableSegment(model);
  const proposalStatus =
    model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY";

  return {
    ...state,
    model,
    task: "PROPOSAL",
    measurementVersion: newVersion
      ? state.measurementVersion + 1
      : state.measurementVersion,
    measurementStatus: "SUBMITTED",
    proposalVersion: state.proposalVersion + 1,
    proposalStatus: newVersion ? "STALE" : proposalStatus,
    drawingStatus: newVersion ? "STALE" : "REVIEW_READY",
    selectedWall: firstSelectable?.wallId ?? state.selectedWall,
    selectedObjectId: firstSelectable?.id ?? state.selectedObjectId,
    issueObjectId: model.decisionItems[0]?.objectId ?? null
  };
}

function firstSelectableSegment(
  model: Round2Model
): { id: string; wallId: WallId } | null {
  for (const wall of model.walls) {
    const segment = wall.segments.find(
      (item) => item.kind !== "gap" && item.kind !== "opening"
    );
    if (segment) return { id: segment.id, wallId: wall.id };
  }
  return null;
}

function applyProposalAdjustment(
  state: Round2PrototypeState,
  adjust: (model: Round2Model) => Round2Model,
  selectedObjectId: string | null
): Round2PrototypeState {
  if (!state.model || state.role !== "DESIGNER") return state;

  const adjustedModel = adjust(state.model);
  if (adjustedModel === state.model) return state;
  const model = {
    ...adjustedModel,
    decisionItems: [
      ...adjustedModel.decisionItems.filter(
        (item) => !item.id.startsWith("decision-intent-")
      ),
      ...buildIntentConfirmationDecisions(
        adjustedModel,
        state.designIntent,
        state.measurements
      )
    ]
  };
  const selectedSegment = selectedObjectId
    ? firstSegmentById(model, selectedObjectId)
    : null;
  const proposalStatus =
    model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY";

  return {
    ...state,
    model,
    proposalVersion: state.proposalVersion + 1,
    proposalStatus,
    drawingStatus: "STALE",
    selectedWall: selectedSegment?.wallId ?? state.selectedWall,
    selectedObjectId: selectedObjectId ?? state.selectedObjectId,
    issueObjectId: model.decisionItems[0]?.objectId ?? null
  };
}

function firstSegmentById(
  model: Round2Model,
  segmentId: string
): { id: string; wallId: WallId } | null {
  for (const wall of model.walls) {
    const segment = wall.segments.find((item) => item.id === segmentId);
    if (segment) return { id: segment.id, wallId: wall.id };
  }
  return null;
}
