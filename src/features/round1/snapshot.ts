import type {
  Cabinet,
  ConfirmationItem,
  PreliminaryCabinetEstimate,
  Round1FormInput,
  Round1Normalized,
  Round1Readiness
} from "@/domain/round1";
import {
  buildFloorPlan,
  type FloorPlan,
  type PositionOverrides
} from "./floorplan/plan-geometry";

/**
 * Authoritative Round 1 sales snapshot.
 *
 * This is the single source of truth for Module 1 sales data, frozen at the
 * moment the user runs `Generate Cabinet Fill`. Before that action, form values
 * and drag state are draft UI state only and must not be treated as a complete
 * Round 1 output.
 *
 * It stays sales-confirmation-level: no Module 2 detail (exact corner cabinet
 * type, final filler placement, production dimensions, install data, or quote
 * data). The embedded floor plan geometry is a faithful record of what was
 * shown; the captured inputs (`normalized`, `preliminaryCabinets`,
 * `positionOverrides`) are also enough to rebuild it deterministically via
 * `buildFloorPlan`.
 */
export const ROUND1_SNAPSHOT_SCHEMA_VERSION = 1;

export type Round1Snapshot = {
  schemaVersion: typeof ROUND1_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;

  /** Gating flags. Both are always true for a valid snapshot. */
  fixedPositionsConfirmed: true;
  cabinetFillGenerated: true;

  /** Round 1 metadata flags. Never production-ready, never exact. */
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";

  /** Captured inputs. */
  showroomForm: Round1FormInput;
  normalized: Round1Normalized;
  positionOverrides: PositionOverrides;

  /** Derived sales data. */
  preliminaryCabinets: PreliminaryCabinetEstimate;
  confirmationItems: ConfirmationItem[];
  readiness: Round1Readiness;

  /**
   * Deterministic floor plan geometry. Faithful record of the rendered plan and
   * the spatial input for a future `Generate Rendering` step.
   */
  floorPlan: FloorPlan;
};

export type BuildRound1SnapshotInput = {
  showroomForm: Round1FormInput;
  normalized: Round1Normalized;
  positionOverrides: PositionOverrides;
  preliminaryCabinets: PreliminaryCabinetEstimate;
  confirmationItems: ConfirmationItem[];
  readiness: Round1Readiness;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
};

/**
 * Builds the authoritative Round 1 snapshot. Pure and deterministic apart from
 * `generatedAt`, which uses the injectable `now` clock. The embedded floor plan
 * is rebuilt from the captured inputs so the snapshot matches exactly what the
 * deterministic renderer drew.
 */
export function buildRound1Snapshot(
  input: BuildRound1SnapshotInput
): Round1Snapshot {
  const now = input.now ?? (() => new Date());

  const floorPlan = buildFloorPlan(
    input.normalized,
    input.preliminaryCabinets.cabinets,
    input.confirmationItems.length,
    input.positionOverrides
  );

  return {
    schemaVersion: ROUND1_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: now().toISOString(),
    fixedPositionsConfirmed: true,
    cabinetFillGenerated: true,
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH",
    showroomForm: input.showroomForm,
    normalized: input.normalized,
    positionOverrides: input.positionOverrides,
    preliminaryCabinets: input.preliminaryCabinets,
    confirmationItems: input.confirmationItems,
    readiness: input.readiness,
    floorPlan
  };
}

export type Round1SnapshotSummary = {
  totalCabinets: number;
  baseCabinets: number;
  wallCabinets: number;
  tallCabinets: number;
  confirmationCount: number;
  estimatedFillerWidth: number;
};

/** Compact, customer-friendly counts for a snapshot status panel. */
export function summarizeRound1Snapshot(
  snapshot: Round1Snapshot
): Round1SnapshotSummary {
  const cabinets = snapshot.preliminaryCabinets.cabinets;
  const countKind = (kind: Cabinet["kind"]) =>
    cabinets.filter((cabinet) => cabinet.kind === kind).length;

  return {
    totalCabinets: cabinets.length,
    baseCabinets: countKind("BASE"),
    wallCabinets: countKind("WALL"),
    tallCabinets: countKind("TALL"),
    confirmationCount: snapshot.confirmationItems.length,
    estimatedFillerWidth: snapshot.preliminaryCabinets.estimatedFillerWidth
  };
}
