import type { FloorPlan } from "@/features/round1/floorplan/plan-geometry";

export type Round2DemoRole = "SALES" | "DESIGNER";
export type Round2Task = "MEASUREMENT" | "PROPOSAL" | "DRAWINGS";
export type MeasurementStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REMEASURE_REQUESTED";
export type ProposalStatus = "READY" | "NEEDS_DECISION" | "STALE";
export type DrawingStatus = "DRAFT" | "REVIEW_READY" | "REVIEWED" | "STALE";
export type WallId = "A" | "B" | "C";
export type DrawingSheetId = "A1" | "A2" | "A3" | "A4" | "S1";

export type Round2Measurements = {
  wallA: number;
  wallB: number;
  wallC: number;
  ceiling: number;
  windowWidth: number;
  windowOffset: number;
};

export type Round2PrototypeState = {
  referenceLocked: boolean;
  referenceVersion: number;
  referenceSnapshotId: string | null;
  role: Round2DemoRole;
  task: Round2Task;
  measurementVersion: number;
  measurementStatus: MeasurementStatus;
  measurements: Round2Measurements;
  proposalVersion: number;
  proposalStatus: ProposalStatus;
  drawingVersion: number;
  drawingStatus: DrawingStatus;
  selectedWall: WallId;
  selectedObjectId: string | null;
  issueObjectId: string | null;
  sinkBaseWidth: 30 | 33 | 36;
  cabinetOffsets: Record<string, { x: number; y: number }>;
  activeSheet: DrawingSheetId;
  drawingZoom: number;
};

export type Round2PrototypeAction =
  | { type: "LOCK_REFERENCE"; snapshotId: string }
  | { type: "REPLACE_REFERENCE"; snapshotId: string }
  | { type: "OPEN_REFERENCE_HANDOFF" }
  | { type: "SET_ROLE"; role: Round2DemoRole }
  | { type: "SET_TASK"; task: Round2Task }
  | {
      type: "EDIT_MEASUREMENT";
      field: keyof Round2Measurements;
      value: number;
    }
  | { type: "SUBMIT_MEASUREMENT" }
  | { type: "REQUEST_REMEASURE"; objectId: string }
  | { type: "SUBMIT_NEW_MEASUREMENT" }
  | { type: "SELECT_WALL"; wall: WallId }
  | { type: "SELECT_OBJECT"; objectId: string; wall: WallId }
  | {
      type: "SET_CABINET_OFFSET";
      objectId: string;
      x: number;
      y: number;
    }
  | { type: "SET_SINK_WIDTH"; width: 30 | 33 | 36 }
  | { type: "RESOLVE_DESIGN_DECISION" }
  | { type: "SET_SHEET"; sheet: DrawingSheetId }
  | { type: "SET_DRAWING_ZOOM"; zoom: number }
  | { type: "MARK_REVIEWED" };

export type Round2Cabinet = {
  id: string;
  wall: WallId;
  code: string;
  width: number;
  kind: "base" | "upper" | "sink" | "appliance" | "filler" | "tall";
  label: string;
};

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
