import type {
  DrawingStatus,
  MeasurementStatus,
  ProposalStatus,
  Round2DemoRole,
  Round2PrototypeState,
  Round2Task
} from "./round2-types";

const ROUND2_DRAFT_VERSION = 1;

type Round2DraftEnvelope = {
  version: typeof ROUND2_DRAFT_VERSION;
  savedAt: string;
  state: Round2PrototypeState;
};

const ROLES: readonly Round2DemoRole[] = ["SALES", "DESIGNER"];
const TASKS: readonly Round2Task[] = ["MEASUREMENT", "PROPOSAL", "DRAWINGS"];
const MEASUREMENT_STATUSES: readonly MeasurementStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "REMEASURE_REQUESTED"
];
const PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  "READY",
  "NEEDS_DECISION",
  "STALE"
];
const DRAWING_STATUSES: readonly DrawingStatus[] = [
  "DRAFT",
  "REVIEW_READY",
  "REVIEWED",
  "STALE"
];

export function round2DraftStorageKey(projectId: string): string {
  return `abcabinet.round2.draft.${encodeURIComponent(projectId)}.v1`;
}

export function browserRound2DraftStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadRound2Draft(
  storage: Storage,
  projectId: string
): Round2PrototypeState | null {
  const raw = storage.getItem(round2DraftStorageKey(projectId));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRound2DraftEnvelope(parsed)) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

export function saveRound2Draft(
  storage: Storage,
  projectId: string,
  state: Round2PrototypeState
): boolean {
  const payload: Round2DraftEnvelope = {
    version: ROUND2_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
    state
  };

  try {
    storage.setItem(round2DraftStorageKey(projectId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function isRound2DraftEnvelope(value: unknown): value is Round2DraftEnvelope {
  return (
    isRecord(value) &&
    value.version === ROUND2_DRAFT_VERSION &&
    typeof value.savedAt === "string" &&
    isRound2PrototypeState(value.state)
  );
}

function isRound2PrototypeState(value: unknown): value is Round2PrototypeState {
  if (!isRecord(value)) return false;

  return (
    typeof value.referenceLocked === "boolean" &&
    typeof value.referenceVersion === "number" &&
    isNullableString(value.referenceSnapshotId) &&
    (isRecord(value.reference) || value.reference === null) &&
    (isRecord(value.model) || value.model === null) &&
    includes(ROLES, value.role) &&
    includes(TASKS, value.task) &&
    typeof value.measurementVersion === "number" &&
    includes(MEASUREMENT_STATUSES, value.measurementStatus) &&
    isRecord(value.measurements) &&
    isRecord(value.designIntent) &&
    typeof value.proposalVersion === "number" &&
    includes(PROPOSAL_STATUSES, value.proposalStatus) &&
    typeof value.drawingVersion === "number" &&
    includes(DRAWING_STATUSES, value.drawingStatus) &&
    isNullableString(value.selectedWall) &&
    isNullableString(value.selectedObjectId) &&
    isNullableString(value.issueObjectId) &&
    isNullableString(value.activeMeasurementKey) &&
    typeof value.activeSheet === "string" &&
    typeof value.drawingZoom === "number"
  );
}

function includes<T extends string>(
  options: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}
