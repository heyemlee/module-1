import { autofillRound2Model } from "./model/autofill";
import {
  moveFillerEnd,
  nudgeGroup,
  setSegmentKind,
  stepCabinetWidth
} from "./model/adjustments";
import { deriveWallsFromRound1 } from "./model/derive-walls";
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
      return {
        ...state,
        role: action.role,
        task: action.role === "SALES" ? "MEASUREMENT" : "PROPOSAL"
      };
    case "SET_TASK":
      return state.referenceLocked ? { ...state, task: action.task } : state;
    case "EDIT_MEASUREMENT":
      if (
        !state.model ||
        (state.role === "DESIGNER" && state.measurementStatus !== "DRAFT")
      ) {
        return state;
      }
      return updateMeasurements(state, {
        ...state.measurements,
        [action.field]: action.value
      }, action.field);
    case "SET_ACTIVE_MEASUREMENT":
      return { ...state, activeMeasurementKey: action.field };
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
    measurements,
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

  const model = autofillRound2Model(state.model, state.measurements);
  const firstSelectable = firstSelectableSegment(model);
  const proposalStatus =
    model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY";

  return {
    ...state,
    model,
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
  selectedObjectId: string
): Round2PrototypeState {
  if (!state.model || state.role !== "DESIGNER") return state;

  const model = adjust(state.model);
  if (model === state.model) return state;
  const selectedSegment = firstSegmentById(model, selectedObjectId);
  const proposalStatus =
    model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY";

  return {
    ...state,
    model,
    proposalVersion: state.proposalVersion + 1,
    proposalStatus,
    drawingStatus: "STALE",
    selectedWall: selectedSegment?.wallId ?? state.selectedWall,
    selectedObjectId,
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
