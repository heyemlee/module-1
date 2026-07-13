import type { Round1ReferenceSource } from "./round2-types";

/**
 * Demo Round 1 reference used by tests and by the handoff empty state when no
 * real Round 1 snapshot is available. The Round 2 workspace derives all walls,
 * cabinets, and drawings from this reference's `floorPlan` at lock time; there
 * are intentionally no hardcoded cabinet/measurement/sheet fixtures anymore.
 */
export const ROUND1_REFERENCE_FIXTURE: Round1ReferenceSource = {
  id: "round1-snapshot-mike-v3",
  generatedAt: "2026-06-30T18:24:00.000Z",
  complete: true,
  layoutLabel: "U-shape",
  styleLabel: "European frameless",
  colorLabel: "Natural White Oak",
  appliances: ["Sink", "Fridge", "Range", "Dishwasher"],
  confirmationCount: 2,
  floorPlan: {
    canvas: { w: 760, h: 560 },
    room: { x: 88, y: 58, w: 584, h: 444, thickness: 8 },
    baseCabinets: [
      { x: 106, y: 78, w: 112, h: 44, code: "B30", confirmationRequired: false, wall: "TOP" },
      { x: 218, y: 78, w: 130, h: 44, code: "SB36", confirmationRequired: false, wall: "TOP" },
      { x: 348, y: 78, w: 86, h: 44, code: "DW24", confirmationRequired: false, wall: "TOP" },
      { x: 106, y: 122, w: 44, h: 126, code: "REF36", confirmationRequired: false, wall: "LEFT" },
      { x: 610, y: 122, w: 44, h: 116, code: "RNG30", confirmationRequired: false, wall: "RIGHT" }
    ],
    wallCabinets: [],
    corners: [],
    wallCorners: [],
    appliances: [],
    clearanceZones: [],
    island: null,
    peninsula: null,
    peninsulaCabinets: [],
    window: { x: 310, y: 58, w: 112, h: 8, wall: "TOP" },
    door: null,
    markers: [],
    dims: [],
    confirmationCount: 2,
    layoutPreference: "U_SHAPE",
    scaleNote: "Round 1 rough layout"
  }
};
