import { CABINET_STANDARDS } from "./cabinet-standards";
import type {
  Round2FixedPoint,
  Round2HeightProfile,
  WallSegment
} from "./round2-model";

// The upper cabinet over a windowless sink is a linked module of the sink
// base: autofill gives it the sink cabinet's exact width and column (so it is
// always horizontally centered on the sink), its top stays aligned with the
// rest of the upper run, and its bottom is raised so the counter-to-cabinet
// clearance lands in the approved 24–30″ band.

/** Height of the dedicated upper cabinet over a windowless sink. */
export function sinkUpperHeightSixteenths(
  profile: Round2HeightProfile
): number {
  const span =
    profile.backsplashSixteenths + profile.upperHeightSixteenths;
  const height =
    span - CABINET_STANDARDS.sinkUpper.clearancePreferredSixteenths;
  // Never taller than the run it hangs in; a run that already clears the
  // preferred band (deep backsplash) keeps the ordinary upper height.
  return Math.max(0, Math.min(height, profile.upperHeightSixteenths));
}

/**
 * Upper segments that are the module over a windowless sink, mapped to their
 * resolved height. Only an upper cabinet reserved for a sink fixed point
 * qualifies — the sink base itself and ordinary uppers are excluded.
 */
export function resolveSinkUpperHeights(
  segments: readonly WallSegment[],
  fixedPoints: readonly Round2FixedPoint[],
  profile: Round2HeightProfile | null | undefined
): Map<string, number> {
  const heights = new Map<string, number>();
  if (!profile) return heights;

  const sinkIds = new Set(
    fixedPoints
      .filter((point) => point.type === "appliance" && point.symbol === "sink")
      .map((point) => point.id)
  );
  for (const segment of segments) {
    if (segment.tier !== "upper" || segment.kind !== "cabinet") continue;
    if (
      segment.sourceFixedPointId == null ||
      !sinkIds.has(segment.sourceFixedPointId)
    ) {
      continue;
    }
    heights.set(segment.id, sinkUpperHeightSixteenths(profile));
  }
  return heights;
}
