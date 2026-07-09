import { autofillRound2Model } from "./model/autofill";
import {
  nudgeGroup,
  setFillerPlacement,
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
  hasBlockingDecisions,
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
    lastAbsorbed: null,
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
    case "RESTORE_DRAFT":
      // Drafts saved before the absorb-feedback field existed lack it.
      return normalizeRestoredState({
        ...action.state,
        lastAbsorbed: action.state.lastAbsorbed ?? null
      });
    case "ADOPT_BASIS":
      return lockReference(state, action.reference, action.version);
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
      // A blocking decision means the geometry is invalid; the drawings are a
      // projection of that geometry, so they stay locked until it is fixed.
      if (action.task === "DRAWINGS" && hasBlockingDecisions(state.model)) {
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
      {
        const designIntent = setDesignIntentAnswer(
          state.designIntent,
          action.key,
          action.value
        );
        if (
          state.measurementStatus === "SUBMITTED" &&
          action.key.startsWith("corner.")
        ) {
          return regenerateSubmittedProposalFromIntent(
            state,
            designIntent,
            action.key
          );
        }
        return {
          ...state,
          designIntent,
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
      }
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
      return { ...state, selectedWall: action.wall, lastAbsorbed: null };
    case "SELECT_OBJECT":
      return {
        ...state,
        selectedWall: action.wall,
        selectedObjectId: action.objectId,
        lastAbsorbed: null
      };
    case "STEP_CABINET_WIDTH": {
      const before = state.model;
      const next = applyProposalAdjustment(
        state,
        (model) =>
          stepCabinetWidth(model, action.objectId, action.widthSixteenths),
        action.objectId
      );
      if (next === state || !before || !next.model) return next;
      const absorbed = findAbsorbedFiller(before, next.model, action.objectId);
      return {
        ...next,
        lastAbsorbed: absorbed
          ? { ...absorbed, token: (state.lastAbsorbed?.token ?? 0) + 1 }
          : null
      };
    }
    case "NUDGE_GROUP":
      return applyProposalAdjustment(
        state,
        (model) => nudgeGroup(model, action.objectId, action.direction),
        action.objectId
      );
    case "SET_FILLER_PLACEMENT":
      return applyProposalAdjustment(
        state,
        (model) =>
          setFillerPlacement(model, action.objectId, action.placement),
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
      // Only advisory decisions (confirmations, sub-minimum fillers) can be
      // acknowledged. Blocking geometry errors can't be waived away — the
      // designer has to edit or request a remeasure.
      if (hasBlockingDecisions(state.model)) return state;
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

function normalizeRestoredState(
  state: Round2PrototypeState
): Round2PrototypeState {
  const designIntent = migrateCornerIntentDefaults(state.designIntent);
  const intentChanged = designIntent !== state.designIntent;
  const hasDeadCornerSegments = modelHasDeadCornerSegments(state.model);
  if (!intentChanged && !hasDeadCornerSegments) return state;

  if (!state.model || !state.model.walls.some((wall) => wall.segments.length > 0)) {
    return { ...state, designIntent };
  }

  const model = autofillRound2Model(state.model, state.measurements, designIntent);
  const selected =
    (state.selectedObjectId
      ? firstSegmentById(model, state.selectedObjectId)
      : null) ?? firstSelectableSegment(model);

  return {
    ...state,
    designIntent,
    model,
    proposalStatus: model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY",
    drawingStatus:
      state.drawingStatus === "REVIEWED" ? "REVIEW_READY" : state.drawingStatus,
    selectedWall: selected?.wallId ?? state.selectedWall,
    selectedObjectId: selected?.id ?? state.selectedObjectId,
    issueObjectId: model.decisionItems[0]?.objectId ?? null
  };
}

function migrateCornerIntentDefaults(
  designIntent: Round2PrototypeState["designIntent"]
): Round2PrototypeState["designIntent"] {
  let changed = false;
  const answers = Object.fromEntries(
    Object.entries(designIntent.answers).map(([key, value]) => {
      if (key.startsWith("corner.") && String(value) === "deadCorner") {
        changed = true;
        return [key, "lazySusan"];
      }
      return [key, value];
    })
  ) as Round2PrototypeState["designIntent"]["answers"];

  return changed ? { ...designIntent, answers } : designIntent;
}

function modelHasDeadCornerSegments(model: Round2Model | null): boolean {
  return Boolean(
    model?.walls.some((wall) =>
      wall.segments.some(
        (segment) => segment.label.trim().toLowerCase() === "dead corner"
      )
    )
  );
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

function regenerateSubmittedProposalFromIntent(
  state: Round2PrototypeState,
  designIntent: Round2PrototypeState["designIntent"],
  changedKey: string
): Round2PrototypeState {
  if (!state.model) return state;

  const model = autofillRound2Model(state.model, state.measurements, designIntent);
  const selectedSegment =
    firstSegmentForCornerIntent(model, changedKey) ?? firstSelectableSegment(model);
  const proposalStatus =
    model.decisionItems.length > 0 ? "NEEDS_DECISION" : "READY";

  return {
    ...state,
    designIntent,
    model,
    measurementStatus: "SUBMITTED",
    proposalVersion: state.proposalVersion + 1,
    proposalStatus,
    drawingStatus: "STALE",
    selectedWall: selectedSegment?.wallId ?? state.selectedWall,
    selectedObjectId: selectedSegment?.id ?? state.selectedObjectId,
    lastAbsorbed: null,
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

function firstSegmentForCornerIntent(
  model: Round2Model,
  intentKey: string
): { id: string; wallId: WallId } | null {
  const match = /^corner\.([^.]+)\.strategy$/.exec(intentKey);
  const cornerId = match?.[1];
  if (!cornerId) return null;
  for (const wall of model.walls) {
    const segment = wall.segments.find(
      (item) => item.sourceCornerId === cornerId
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
    lastAbsorbed: null,
    issueObjectId: model.decisionItems[0]?.objectId ?? null
  };
}

/**
 * Finds the filler whose width the last cabinet resize was absorbed into, so
 * the elevation can pulse it. Fillers that vanished (absorbed down to zero)
 * have nothing left to highlight and return null.
 */
function findAbsorbedFiller(
  before: Round2Model,
  after: Round2Model,
  targetId: string
): { segmentId: string; deltaSixteenths: number } | null {
  const beforeWidths = new Map<string, number>();
  for (const wall of before.walls) {
    for (const segment of wall.segments) {
      beforeWidths.set(segment.id, segment.widthSixteenths);
    }
  }
  for (const wall of after.walls) {
    for (const segment of wall.segments) {
      if (segment.kind !== "filler" || segment.id === targetId) continue;
      const previous = beforeWidths.get(segment.id) ?? 0;
      if (segment.widthSixteenths !== previous) {
        return {
          segmentId: segment.id,
          deltaSixteenths: segment.widthSixteenths - previous
        };
      }
    }
  }
  return null;
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
