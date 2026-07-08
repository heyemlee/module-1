import type { FloorPlan } from "@/features/round1/floorplan/plan-geometry";
import type {
  CabinetKind,
  MeasurementKey,
  Round2HeightProfile,
  Round2Model,
  WallId,
  WallSegmentFront
} from "./model/round2-model";
import type { FillerPlacement, NudgeDirection } from "./model/adjustments";
import type {
  DesignIntentKey,
  DesignIntentValue,
  Round2DesignIntent
} from "./model/design-intent";

export type Round2DemoRole = "SALES" | "DESIGNER";
export type Round2Task = "MEASUREMENT" | "PROPOSAL" | "DRAWINGS";
export type MeasurementStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REMEASURE_REQUESTED";
export type ProposalStatus = "READY" | "NEEDS_DECISION" | "STALE";
export type DrawingStatus = "DRAFT" | "REVIEW_READY" | "REVIEWED" | "STALE";
export type DrawingSheetId = string;

export type {
  DesignIntentKey,
  DesignIntentValue,
  MeasurementKey,
  Round2DesignIntent,
  Round2HeightProfile,
  Round2Model,
  WallId,
  WallSegmentFront
};

export type Round2Measurements = Record<MeasurementKey, number | null>;

/**
 * Feedback for the elevation: which filler absorbed the last cabinet width
 * change, so the UI can pulse it instead of moving remainder space silently.
 */
export type Round2AbsorbedChange = {
  segmentId: string;
  deltaSixteenths: number;
  /** Monotonic counter so repeat absorptions retrigger the pulse animation. */
  token: number;
};

export type Round2PrototypeState = {
  referenceLocked: boolean;
  referenceVersion: number;
  referenceSnapshotId: string | null;
  reference: Round1ReferenceSource | null;
  model: Round2Model | null;
  role: Round2DemoRole;
  task: Round2Task;
  measurementVersion: number;
  measurementStatus: MeasurementStatus;
  measurements: Round2Measurements;
  designIntent: Round2DesignIntent;
  proposalVersion: number;
  proposalStatus: ProposalStatus;
  drawingVersion: number;
  drawingStatus: DrawingStatus;
  selectedWall: WallId | null;
  selectedObjectId: string | null;
  lastAbsorbed: Round2AbsorbedChange | null;
  issueObjectId: string | null;
  activeMeasurementKey: MeasurementKey | null;
  activeSheet: DrawingSheetId;
  drawingZoom: number;
};

export type Round2PrototypeAction =
  | { type: "RESTORE_DRAFT"; state: Round2PrototypeState }
  | { type: "LOCK_REFERENCE"; reference: Round1ReferenceSource }
  | { type: "REPLACE_REFERENCE"; reference: Round1ReferenceSource }
  | { type: "OPEN_REFERENCE_HANDOFF" }
  | { type: "SET_ROLE"; role: Round2DemoRole }
  | { type: "SET_TASK"; task: Round2Task }
  | {
      type: "EDIT_MEASUREMENT";
      field: MeasurementKey;
      value: number | null;
    }
  | { type: "SET_ACTIVE_MEASUREMENT"; field: MeasurementKey }
  | {
      type: "SET_DESIGN_INTENT";
      key: DesignIntentKey;
      value: DesignIntentValue;
    }
  | { type: "SUBMIT_MEASUREMENT" }
  | { type: "REQUEST_REMEASURE"; objectId: string }
  | { type: "SUBMIT_NEW_MEASUREMENT" }
  | { type: "SELECT_WALL"; wall: WallId }
  | { type: "SELECT_OBJECT"; objectId: string; wall: WallId }
  | { type: "STEP_CABINET_WIDTH"; objectId: string; widthSixteenths: number }
  | { type: "NUDGE_GROUP"; objectId: string; direction: NudgeDirection }
  | { type: "SET_FILLER_PLACEMENT"; objectId: string; placement: FillerPlacement }
  | { type: "SET_SEGMENT_KIND"; objectId: string; cabinetKind: CabinetKind }
  | { type: "SET_SEGMENT_FRONT"; objectId: string; front: WallSegmentFront }
  | { type: "SET_HEIGHT_PROFILE"; profile: Partial<Round2HeightProfile> }
  | { type: "RESOLVE_DESIGN_DECISION" }
  | { type: "SET_SHEET"; sheet: DrawingSheetId }
  | { type: "SET_DRAWING_ZOOM"; zoom: number }
  | { type: "MARK_REVIEWED" };

export type Round1ReferenceSource = {
  id: string;
  generatedAt: string;
  complete: boolean;
  layoutLabel: string;
  styleLabel: string;
  colorLabel: string;
  appliances: readonly string[];
  confirmationCount: number;
  floorPlan: FloorPlan;
};
