import { CABINET_STANDARDS } from "./cabinet-standards";
import {
  fridgeAboveHeightIntentKey,
  type Round2DesignIntent
} from "./design-intent";
import type {
  Round2HeightProfile,
  WallSegment
} from "./round2-model";

// Standard heights (sixteenths) for the wall cabinet / panel above a fridge —
// shorter than an ordinary upper because the fridge stands so tall.
export const FRIDGE_ABOVE_HEIGHT_OPTIONS =
  CABINET_STANDARDS.upper.refrigeratorHeightsSixteenths;

export const DEFAULT_FRIDGE_ABOVE_HEIGHT_SIXTEENTHS = 24 * 16;

// Keep both the above unit and the fridge beneath it usable.
const MIN_ABOVE_HEIGHT_SIXTEENTHS = 6 * 16;
const MIN_FRIDGE_HEIGHT_SIXTEENTHS = 24 * 16;

/** Floor-to-cabinet-top height a full tall unit spans, from the height profile. */
export function tallUnitSpanSixteenths(
  profile: Round2HeightProfile | null | undefined
): number | null {
  if (!profile) return null;
  return (
    profile.counterSixteenths +
    profile.backsplashSixteenths +
    profile.upperHeightSixteenths
  );
}

/** Clamp an above-fridge height so both it and the fridge stay usable. */
export function clampFridgeAboveHeight(
  heightSixteenths: number,
  profile: Round2HeightProfile | null | undefined
): number {
  const span = tallUnitSpanSixteenths(profile);
  const max =
    span == null
      ? heightSixteenths
      : Math.max(MIN_ABOVE_HEIGHT_SIXTEENTHS, span - MIN_FRIDGE_HEIGHT_SIXTEENTHS);
  return Math.min(Math.max(heightSixteenths, MIN_ABOVE_HEIGHT_SIXTEENTHS), max);
}

/**
 * Height (sixteenths) chosen for the unit above one fridge, defaulted and
 * clamped. Independent of whether an above unit is actually placed — callers
 * gate on {@link resolveFridgeAboveHeights}.
 */
export function fridgeAboveHeightSixteenths(
  fixedPointId: string,
  intent: Round2DesignIntent | undefined,
  profile: Round2HeightProfile | null | undefined
): number {
  const raw = intent?.answers[fridgeAboveHeightIntentKey(fixedPointId)];
  const value =
    typeof raw === "number" && raw > 0
      ? raw
      : DEFAULT_FRIDGE_ABOVE_HEIGHT_SIXTEENTHS;
  return clampFridgeAboveHeight(value, profile);
}

/**
 * Fridges that carry a wall cabinet / panel above the tall unit, mapped to the
 * above unit's resolved height. Only a fridge (a tall base unit) with an
 * occupied upper qualifies — a hood over a range shares the range fixed point
 * but is not tall, so it is excluded. Renderers use the map to render the above
 * unit at its height and cap the fridge box just beneath it.
 */
export function resolveFridgeAboveHeights(
  segments: readonly WallSegment[],
  intent: Round2DesignIntent | undefined,
  profile: Round2HeightProfile | null | undefined
): Map<string, number> {
  const tallFixedPoints = new Set<string>();
  for (const segment of segments) {
    if (segment.cabinetKind === "tall" && segment.sourceFixedPointId) {
      tallFixedPoints.add(segment.sourceFixedPointId);
    }
  }

  const heights = new Map<string, number>();
  for (const segment of segments) {
    if (segment.tier !== "upper") continue;
    if (segment.kind !== "cabinet" && segment.kind !== "panel") continue;
    const fixedPointId = segment.sourceFixedPointId;
    if (!fixedPointId || !tallFixedPoints.has(fixedPointId)) continue;
    heights.set(
      fixedPointId,
      fridgeAboveHeightSixteenths(fixedPointId, intent, profile)
    );
  }
  return heights;
}

/** Above-unit height for this segment's fridge, or null when it does not apply. */
export function fridgeAboveHeightForSegment(
  segment: WallSegment,
  heights: ReadonlyMap<string, number>
): number | null {
  const fixedPointId = segment.sourceFixedPointId;
  if (!fixedPointId) return null;
  return heights.get(fixedPointId) ?? null;
}

/** Whether this tall fridge box renders capped beneath its above unit. */
export function isCappedFridge(
  segment: WallSegment,
  heights: ReadonlyMap<string, number>
): boolean {
  return (
    segment.cabinetKind === "tall" &&
    fridgeAboveHeightForSegment(segment, heights) != null
  );
}

/** Whether this upper segment is the unit sitting above a fridge. */
export function isFridgeAboveUnit(
  segment: WallSegment,
  heights: ReadonlyMap<string, number>
): boolean {
  return (
    segment.tier === "upper" &&
    (segment.kind === "cabinet" || segment.kind === "panel") &&
    fridgeAboveHeightForSegment(segment, heights) != null
  );
}
