import { ROUND2_MEASUREMENT_FIXTURE } from "./round2-fixtures";
import type {
  Round2DemoRole,
  Round2PrototypeAction,
  Round2PrototypeState
} from "./round2-types";

export function createRound2PrototypeState(
  role: Round2DemoRole
): Round2PrototypeState {
  return {
    role,
    task: role === "SALES" ? "MEASUREMENT" : "PROPOSAL",
    measurementVersion: 3,
    measurementStatus: "SUBMITTED",
    measurements: { ...ROUND2_MEASUREMENT_FIXTURE },
    proposalVersion: 2,
    proposalStatus: "NEEDS_DECISION",
    drawingVersion: 1,
    drawingStatus: "REVIEW_READY",
    selectedWall: "A",
    selectedObjectId: "a-03",
    issueObjectId: "a-03",
    activeSheet: "A1",
    drawingZoom: 1
  };
}

export function reduceRound2Prototype(
  state: Round2PrototypeState,
  action: Round2PrototypeAction
): Round2PrototypeState {
  switch (action.type) {
    case "SET_ROLE":
      return {
        ...state,
        role: action.role,
        task: action.role === "SALES" ? "MEASUREMENT" : "PROPOSAL"
      };
    case "SET_TASK":
      return { ...state, task: action.task };
    case "EDIT_MEASUREMENT":
      return state.role === "DESIGNER"
        ? state
        : {
            ...state,
            measurementStatus: "DRAFT",
            measurements: {
              ...state.measurements,
              [action.field]: action.value
            }
          };
    case "SUBMIT_MEASUREMENT":
      return { ...state, measurementStatus: "SUBMITTED" };
    case "REQUEST_REMEASURE":
      return {
        ...state,
        measurementStatus: "REMEASURE_REQUESTED",
        proposalStatus: "NEEDS_DECISION",
        issueObjectId: action.objectId
      };
    case "SUBMIT_NEW_MEASUREMENT":
      return {
        ...state,
        measurementVersion: state.measurementVersion + 1,
        measurementStatus: "SUBMITTED",
        proposalStatus: "STALE",
        drawingStatus: "STALE"
      };
    case "SELECT_WALL":
      return { ...state, selectedWall: action.wall };
    case "SELECT_OBJECT":
      return {
        ...state,
        selectedWall: action.wall,
        selectedObjectId: action.objectId
      };
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
      return state.proposalStatus === "READY"
        ? { ...state, drawingStatus: "REVIEWED" }
        : state;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
