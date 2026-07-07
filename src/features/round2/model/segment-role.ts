import { CABINET_STANDARDS } from "./cabinet-standards";
import type { Round2Wall, WallSegment } from "./round2-model";

// Semantic identity of a segment for appliance-specific elevation fronts.
// Resolution is data-driven: the Round 1 fixed point the segment was reserved
// for (via sourceFixedPointId → symbol) is authoritative, with the standards
// label prefix as a fallback for segments that lost their fixed point (manual
// SET_SEGMENT_KIND edits). Rendering only — never feeds geometry.

export type SegmentRole =
  | "sink"
  | "dishwasher"
  | "range"
  | "fridge"
  | "oven"
  | "microwave"
  | "hood";

const BASE_SYMBOL_ROLES: Partial<Record<string, SegmentRole>> = {
  sink: "sink",
  dishwasher: "dishwasher",
  range: "range",
  fridge: "fridge",
  oven: "oven",
  microwave: "microwave",
  hood: "hood"
};

/** Short tag drawn beside the cabinet number so identity reads at a glance. */
export const SEGMENT_ROLE_TAGS: Record<SegmentRole, string> = {
  sink: "SINK",
  dishwasher: "DW",
  range: "RANGE",
  fridge: "FRIDGE",
  oven: "OVEN",
  microwave: "MICRO",
  hood: "HOOD"
};

export function resolveSegmentRole(
  segment: WallSegment,
  wall: Pick<Round2Wall, "fixedPoints"> | null | undefined
): SegmentRole | null {
  const symbol = wall?.fixedPoints.find(
    (point) => point.id === segment.sourceFixedPointId
  )?.symbol;

  if (segment.tier === "upper") {
    // Upper projection: the hood follows the range (see autofill
    // deriveUpperTier). The fridge is a full-height unit with a gap above, so
    // there is no fridge upper to tag.
    if (segment.kind !== "cabinet") return null;
    if (symbol === "range" || segment.label.startsWith("HD")) return "hood";
    return null;
  }

  if (segment.kind !== "appliance") return null;
  if (segment.cabinetKind === "sink") return "sink";
  const symbolRole = symbol ? BASE_SYMBOL_ROLES[symbol] : undefined;
  if (symbolRole) return symbolRole;

  const appliances = CABINET_STANDARDS.appliances;
  if (segment.label.startsWith(appliances.sinkBase.labelPrefix)) return "sink";
  if (segment.label.startsWith(appliances.dishwasher.labelPrefix)) {
    return "dishwasher";
  }
  if (segment.label.startsWith(appliances.range.labelPrefix)) return "range";
  if (segment.label.startsWith(appliances.refrigerator.labelPrefix)) {
    return "fridge";
  }
  return null;
}
