import { CABINET_STANDARDS } from "./cabinet-standards";
import {
  type CabinetKind,
  type FrontAccessory,
  type Round2DecisionItem,
  type Round2HeightProfile,
  type Round2Model,
  type Round2Wall,
  type SegmentTier,
  type WallId,
  type WallSegment,
  type WallSegmentFront,
  formatSixteenths,
  sinkCenteringOffsetSixteenths
} from "./round2-model";

export type NudgeDirection = "left" | "right";
export type FillerPlacement = "start" | "end" | "split";

export function removeFiller(model: Round2Model, segmentId: string): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || context.segment.kind !== "filler") return model;
  const segments = context.wall.segments.map((segment) =>
    segment.id === segmentId
      ? { ...segment, kind: "gap" as const, intentionalGap: true, label: "Open gap" }
      : segment
  );
  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function restoreFiller(model: Round2Model, segmentId: string): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || context.segment.kind !== "gap" || !context.segment.intentionalGap) {
    return model;
  }
  const segments = context.wall.segments.map((segment) =>
    segment.id === segmentId
      ? {
          ...segment,
          kind: "filler" as const,
          intentionalGap: undefined,
          label: `F${Math.round(segment.widthSixteenths / 16)}`
        }
      : segment
  );
  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function standardWidthOptionsSixteenths(): number[] {
  return [...CABINET_STANDARDS.base.widthsSixteenths];
}

// The chips offer standard tiers; the width-chain input also takes custom
// values, but never below the 9″ ordinary-cabinet minimum. The delta is
// absorbed by a same-tier filler, so the chain stays closed either way.
export function stepCabinetWidth(
  model: Round2Model,
  segmentId: string,
  targetWidthSixteenths: number
): Round2Model {
  if (
    !Number.isInteger(targetWidthSixteenths) ||
    targetWidthSixteenths < CABINET_STANDARDS.base.widthsSixteenths[0]
  ) {
    return model;
  }

  const context = findSegmentContext(model, segmentId);
  if (!context || !canAdjustCabinetWidth(context.segment)) return model;

  const delta = targetWidthSixteenths - context.segment.widthSixteenths;
  if (delta === 0) return model;

  const segments = [...context.wall.segments];
  const targetIndex = segments.findIndex((segment) => segment.id === segmentId);
  const absorberIndex = ensureAbsorberFiller(
    segments,
    context.segment,
    targetIndex,
    delta
  );

  segments[targetIndex] = withWidth(
    segments[targetIndex],
    targetWidthSixteenths
  );
  segments[absorberIndex] = withWidth(
    segments[absorberIndex],
    segments[absorberIndex].widthSixteenths - delta
  );

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function nudgeGroup(
  model: Round2Model,
  segmentId: string,
  direction: NudgeDirection,
  amountSixteenths = 1
): Round2Model {
  const sign = direction === "left" ? -1 : 1;
  // Deliberately nudging the sink itself is a choice to break window centering,
  // so its anchor is released — it stops constraining its neighbors and no
  // longer reports an off-center decision.
  return slideGroup(model, segmentId, sign * amountSixteenths, true);
}

/**
 * Re-aligns an anchored sink back under its wall's window after an edit (or a
 * remeasure) nudged it off center, sliding it as one group and keeping the
 * anchor intact. No-op unless the segment is an anchored sink that has drifted.
 */
export function recenterSink(
  model: Round2Model,
  segmentId: string
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || !context.segment.anchored) return model;
  const offset = sinkCenteringOffsetSixteenths(context.wall, context.segment);
  if (!offset) return model;
  return slideGroup(model, segmentId, offset, false, true);
}

/**
 * Moves a cabinet/appliance group by transferring width between its flanking
 * fillers. A positive delta slides the group toward the wall end. `releaseAnchor`
 * clears an anchored segment's alignment intent when the move is user-driven.
 */
function slideGroup(
  model: Round2Model,
  segmentId: string,
  deltaSixteenths: number,
  releaseAnchor: boolean,
  allowAnchoredSink = false
): Round2Model {
  if (deltaSixteenths === 0) return model;
  const context = findSegmentContext(model, segmentId);
  // Fillers are computed remainder space: they reposition via
  // setFillerPlacement, never slide. Only cabinet/appliance groups slide.
  if (
    !context ||
    (!canSlideGroup(context.segment) &&
      !(allowAnchoredSink && isAnchoredSink(context.segment)))
  ) {
    return model;
  }

  const segments = [...context.wall.segments];
  let targetIndex = segments.findIndex((segment) => segment.id === segmentId);
  const left = ensureSideFiller(segments, targetIndex, context.segment.tier, "left");
  targetIndex = segments.findIndex((segment) => segment.id === segmentId);
  const right = ensureSideFiller(segments, targetIndex, context.segment.tier, "right");

  segments[left] = withWidth(
    segments[left],
    segments[left].widthSixteenths + deltaSixteenths
  );
  segments[right] = withWidth(
    segments[right],
    segments[right].widthSixteenths - deltaSixteenths
  );

  if (releaseAnchor && context.segment.anchored) {
    const anchorIndex = segments.findIndex((segment) => segment.id === segmentId);
    segments[anchorIndex] = { ...segments[anchorIndex], anchored: false };
  }

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

/**
 * Fillers are remainder space, so their width is never set directly. This
 * repositions the remainder within its zone instead: all fillers of the zone
 * merge into one at the zone start or end, or split evenly across both ends.
 */
export function setFillerPlacement(
  model: Round2Model,
  segmentId: string,
  placement: FillerPlacement
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || context.segment.kind !== "filler") return model;

  const tier = context.segment.tier;
  const source = context.wall.segments;
  const currentIndex = source.findIndex((segment) => segment.id === segmentId);
  const bounds = zoneBounds(source, currentIndex, tier);
  const isZoneFiller = (segment: WallSegment, index: number) =>
    segment.kind === "filler" &&
    segment.tier === tier &&
    index > bounds.left &&
    index < bounds.right;

  const zoneFillers = source.filter(isZoneFiller);
  const totalWidth = zoneFillers.reduce(
    (sum, segment) => sum + segment.widthSixteenths,
    0
  );
  if (totalWidth <= 0) return model;

  // Rebuild the run without the zone fillers, remembering where the zone's
  // same-tier run starts and ends so the remainder can be reinserted there.
  const remaining: WallSegment[] = [];
  let insertStart = -1;
  let insertEnd = -1;
  source.forEach((segment, index) => {
    if (isZoneFiller(segment, index)) return;
    const inZoneSameTier =
      segment.tier === tier && index > bounds.left && index < bounds.right;
    if (inZoneSameTier && insertStart === -1) insertStart = remaining.length;
    remaining.push(segment);
    if (inZoneSameTier) insertEnd = remaining.length;
  });
  if (insertStart === -1) {
    // Zone holds nothing but the fillers themselves: placement is moot.
    insertStart = Math.min(currentIndex, remaining.length);
    insertEnd = insertStart;
  }

  const template =
    zoneFillers.find((segment) => segment.id === segmentId) ?? zoneFillers[0];
  const makeFiller = (id: string, widthSixteenths: number): WallSegment =>
    withLabel({ ...template, id, widthSixteenths });

  const segments = [...remaining];
  if (placement === "start") {
    segments.splice(insertStart, 0, makeFiller(template.id, totalWidth));
  } else if (placement === "end") {
    segments.splice(insertEnd, 0, makeFiller(template.id, totalWidth));
  } else {
    const startWidth = Math.ceil(totalWidth / 2);
    // Insert at the end first so the start index stays valid.
    segments.splice(
      insertEnd,
      0,
      makeFiller(`${template.id}-split`, totalWidth - startWidth)
    );
    segments.splice(insertStart, 0, makeFiller(template.id, startWidth));
  }

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function setSegmentKind(
  model: Round2Model,
  segmentId: string,
  cabinetKind: CabinetKind
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || !canAdjustCabinetWidth(context.segment)) return model;
  if (context.segment.kind === "appliance") return model;
  if (cabinetKind === "sink") return model;
  if (context.segment.tier === "upper" && cabinetKind !== "upper") return model;
  if (context.segment.tier === "base" && cabinetKind === "upper") return model;

  const segments = context.wall.segments.map((segment) =>
    segment.id === segmentId
      ? withLabel({
          ...segment,
          cabinetKind,
          kind: "cabinet"
        })
      : segment
  );

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

/**
 * Stores a front-configuration exception on a segment. Pure face change: no
 * widths move, so the dimension chain and decisions are untouched.
 */
export function setSegmentFront(
  model: Round2Model,
  segmentId: string,
  front: WallSegmentFront
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context) return model;

  const segments = context.wall.segments.map((segment) =>
    segment.id === segmentId
      ? {
          ...segment,
          front: sanitizeSegmentFront(segment, { ...segment.front, ...front })
        }
      : segment
  );
  return replaceWallSegments(model, context.wall.id, segments);
}

function sanitizeSegmentFront(
  segment: WallSegment,
  front: WallSegmentFront
): WallSegmentFront {
  if (!front.accessories) return front;
  return {
    ...front,
    accessories: front.accessories.filter((accessory) =>
      allowedAccessoriesForSegment(segment).includes(accessory)
    )
  };
}

function allowedAccessoriesForSegment(segment: WallSegment): FrontAccessory[] {
  if (segment.cabinetKind === "corner") {
    return [
      "lazySusan",
      "magicCorner",
      "blindCornerPullOut",
      "cornerPullOutShelves"
    ];
  }
  return ["trashPullout", "spicePullout"];
}

/**
 * Updates the global height chain. One change re-renders every wall
 * elevation; the ceiling check runs with the other model decisions.
 */
export function setHeightProfile(
  model: Round2Model,
  patch: Partial<Round2HeightProfile>
): Round2Model {
  if (!model.heightProfile) return model;
  return updateModelDecisions({
    ...model,
    heightProfile: { ...model.heightProfile, ...patch }
  });
}

export function heightProfileTotal(profile: Round2HeightProfile): number {
  return (
    profile.counterSixteenths +
    profile.backsplashSixteenths +
    profile.upperHeightSixteenths +
    profile.mouldingSixteenths
  );
}

export function updateModelDecisions(model: Round2Model): Round2Model {
  const decisionItems: Round2DecisionItem[] = [];

  if (
    model.heightProfile &&
    model.ceilingHeightSixteenths != null &&
    heightProfileTotal(model.heightProfile) > model.ceilingHeightSixteenths
  ) {
    const wallId = model.walls[0]?.id ?? "A";
    decisionItems.push({
      id: "decision-height-chain-overflow",
      objectId: wallId,
      wallId,
      severity: "blocking",
      title: "Height chain exceeds the ceiling",
      body: `Counter, backsplash, uppers and moulding total ${formatSixteenths(heightProfileTotal(model.heightProfile))} against a ${formatSixteenths(model.ceilingHeightSixteenths)} ceiling. Step the upper height or moulding down.`
    });
  }

  for (const wall of model.walls) {
    for (const segment of wall.segments) {
      if (!segment.anchored) continue;
      const offset = sinkCenteringOffsetSixteenths(wall, segment);
      if (offset == null || offset === 0) continue;
      decisionItems.push({
        id: `decision-${segment.id}-off-center`,
        objectId: segment.id,
        wallId: wall.id,
        severity: "warning",
        title: `Wall ${wall.label} sink off window center`,
        body: `${segment.code ?? segment.label} sits ${formatSixteenths(Math.abs(offset))} ${offset > 0 ? "left of" : "right of"} the window center. Re-center it or accept the offset.`
      });
    }

    for (const segment of wall.segments) {
      if (segment.kind !== "filler") continue;
      if (segment.widthSixteenths < 0) {
        decisionItems.push({
          id: `decision-${segment.id}-negative`,
          objectId: segment.id,
          wallId: wall.id,
          severity: "blocking",
          title: `Wall ${wall.label} filler overdrawn`,
          body: `${segment.code ?? segment.label} is ${formatSixteenths(segment.widthSixteenths)}. Select a smaller cabinet width or request remeasure.`
        });
      } else if (
        segment.widthSixteenths > 0 &&
        segment.widthSixteenths < CABINET_STANDARDS.filler.minSixteenths
      ) {
        decisionItems.push({
          id: `decision-${segment.id}-minimum`,
          objectId: segment.id,
          wallId: wall.id,
          severity: "warning",
          title: `Wall ${wall.label} filler below minimum`,
          body: `${segment.code ?? segment.label} is narrower than ${formatSixteenths(CABINET_STANDARDS.filler.minSixteenths)}. Request a design decision or remeasure.`
        });
      } else if (
        segment.widthSixteenths > CABINET_STANDARDS.filler.maxSixteenths
      ) {
        decisionItems.push({
          id: `decision-${segment.id}-maximum`,
          objectId: segment.id,
          wallId: wall.id,
          severity: "warning",
          title: `Wall ${wall.label} filler exceeds maximum`,
          body: `${segment.code ?? segment.label} is wider than ${formatSixteenths(CABINET_STANDARDS.filler.maxSixteenths)}. Select a larger cabinet width or request a design decision.`
        });
      }
    }

    for (const tier of ["upper", "base"] as const) {
      const tierSegments = wall.segments.filter(
        (segment) => segment.tier === tier
      );
      if (tierSegments.length === 0 || wall.lengthSixteenths == null) continue;
      const total = tierSegments.reduce(
        (sum, segment) => sum + segment.widthSixteenths,
        0
      );
      if (total !== wall.lengthSixteenths) {
        decisionItems.push({
          id: `decision-${wall.id}-${tier}-closure`,
          objectId: wall.id,
          wallId: wall.id,
          severity: "blocking",
          title: `Wall ${wall.label} ${tier} run is not closed`,
          body: `${formatSixteenths(total)} of segments must equal ${formatSixteenths(wall.lengthSixteenths)}.`
        });
      }
    }
  }

  return { ...model, decisionItems };
}

export function wallTierTotal(
  wall: Round2Wall,
  tier: Extract<SegmentTier, "upper" | "base">
): number {
  return wall.segments
    .filter((segment) => segment.tier === tier)
    .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
}

function findSegmentContext(
  model: Round2Model,
  segmentId: string
): { wall: Round2Wall; segment: WallSegment } | null {
  for (const wall of model.walls) {
    const segment = wall.segments.find((item) => item.id === segmentId);
    if (segment) return { wall, segment };
  }
  return null;
}

function replaceWallSegments(
  model: Round2Model,
  wallId: WallId,
  segments: WallSegment[]
): Round2Model {
  return {
    ...model,
    walls: model.walls.map((wall) =>
      wall.id === wallId
        ? {
            ...wall,
            segments: segments.filter(
              (segment) =>
                !(segment.kind === "filler" && segment.widthSixteenths === 0)
            )
          }
        : wall
    )
  };
}

function canAdjustCabinetWidth(segment: WallSegment): boolean {
  return isOrdinaryCabinet(segment);
}

function canSlideGroup(segment: WallSegment): boolean {
  return isOrdinaryCabinet(segment);
}

function isAnchoredSink(segment: WallSegment): boolean {
  return (
    segment.kind === "appliance" &&
    segment.cabinetKind === "sink" &&
    segment.anchored === true
  );
}

function isOrdinaryCabinet(segment: WallSegment): boolean {
  return (
    segment.kind === "cabinet" &&
    segment.cabinetKind !== "corner" &&
    segment.sourceCornerId == null
  );
}

function ensureAbsorberFiller(
  segments: WallSegment[],
  target: WallSegment,
  targetIndex: number,
  delta: number
): number {
  const nearest = nearestFillerIndex(
    segments,
    target.tier,
    targetIndex,
    delta
  );
  if (nearest !== -1) return nearest;

  const id = `${target.id}-adj-filler`;
  if (segments[targetIndex + 1]?.id === id) return targetIndex + 1;

  segments.splice(targetIndex + 1, 0, {
    id,
    wallId: target.wallId,
    tier: target.tier,
    kind: "filler",
    widthSixteenths: 0,
    label: "Adjustment filler",
    code: `F${target.wallId}${target.tier === "upper" ? "U" : "B"}`
  });
  return targetIndex + 1;
}

/**
 * True where width redistribution must stop: fixed appliances, openings,
 * finished panels, corner gaps, and anchored segments. Appliances and panels
 * are reservation geometry, so a cabinet edit cannot transfer filler through
 * them or push a filler outside a run-end panel.
 */
function isZoneBoundary(segment: WallSegment): boolean {
  return (
    segment.kind === "appliance" ||
    segment.kind === "opening" ||
    segment.kind === "gap" ||
    segment.kind === "panel" ||
    segment.cabinetKind === "corner" ||
    segment.anchored === true
  );
}

/**
 * A zone is the stretch of a tier between blocking segments (appliances,
 * openings, corner gaps, and anchored sinks): width redistribution never
 * crosses those boundaries.
 */
function zoneBounds(
  segments: WallSegment[],
  index: number,
  tier: SegmentTier
): { left: number; right: number } {
  const blocks = (segment: WallSegment) =>
    segment.tier === tier && isZoneBoundary(segment);

  let left = -1;
  let right = segments.length;
  for (let i = index - 1; i >= 0; i--) {
    if (blocks(segments[i])) {
      left = i;
      break;
    }
  }
  for (let i = index + 1; i < segments.length; i++) {
    if (blocks(segments[i])) {
      right = i;
      break;
    }
  }
  return { left, right };
}

function nearestFillerIndex(
  segments: WallSegment[],
  tier: SegmentTier,
  targetIndex: number,
  delta: number
): number {
  const bounds = zoneBounds(segments, targetIndex, tier);

  const candidates = segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment, index }) =>
        segment.tier === tier &&
        segment.kind === "filler" &&
        index > bounds.left &&
        index < bounds.right
    );
    
  const withCapacity =
    delta > 0
      ? candidates.filter(({ segment }) => segment.widthSixteenths >= delta)
      : candidates;
  const pool = withCapacity.length > 0 ? withCapacity : candidates;
  
  if (pool.length === 0) return -1;
  
  return pool.reduce(
    (best, candidate) => {
      const distance = Math.abs(candidate.index - targetIndex);
      return distance < best.distance
        ? { index: candidate.index, distance }
        : best;
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  ).index;
}

function ensureSideFiller(
  segments: WallSegment[],
  targetIndex: number,
  tier: SegmentTier,
  side: "left" | "right"
): number {
  if (side === "left") {
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (segments[index].tier === tier) {
        if (isZoneBoundary(segments[index])) break;
        if (segments[index].kind === "filler") return index;
      }
    }
    const target = segments[targetIndex];
    segments.splice(targetIndex, 0, {
      id: `${target.id}-left-nudge`,
      wallId: target.wallId,
      tier,
      kind: "filler",
      widthSixteenths: 0,
      label: "Left nudge filler",
      code: `F${target.wallId}L`
    });
    return targetIndex;
  }

  for (let index = targetIndex + 1; index < segments.length; index += 1) {
    if (segments[index].tier === tier) {
      if (isZoneBoundary(segments[index])) break;
      if (segments[index].kind === "filler") return index;
    }
  }
  const target = segments[targetIndex];
  segments.splice(targetIndex + 1, 0, {
    id: `${target.id}-right-nudge`,
    wallId: target.wallId,
    tier,
    kind: "filler",
    widthSixteenths: 0,
    label: "Right nudge filler",
    code: `F${target.wallId}R`
  });
  return targetIndex + 1;
}

function withWidth(segment: WallSegment, widthSixteenths: number): WallSegment {
  return withLabel({
    ...segment,
    widthSixteenths,
    standardWidthSixteenths:
      segment.kind === "cabinet" || segment.kind === "appliance"
        ? widthSixteenths
        : segment.standardWidthSixteenths
  });
}

function withLabel(segment: WallSegment): WallSegment {
  if (segment.kind === "filler") {
    return {
      ...segment,
      label: `F${Math.round(segment.widthSixteenths / 16)}`
    };
  }
  if (segment.kind !== "cabinet" && segment.kind !== "appliance") {
    return segment;
  }

  const width = Math.round(segment.widthSixteenths / 16);
  if (segment.cabinetKind === "corner") {
    const prefix = /^[A-Z]+/.exec(segment.label)?.[0] ?? "LS";
    return { ...segment, label: `${prefix}${width}` };
  }
  if (segment.cabinetKind === "sink") {
    return { ...segment, label: `SB${width}` };
  }
  if (segment.cabinetKind === "upper" || segment.tier === "upper") {
    return { ...segment, cabinetKind: "upper", label: `W${width}` };
  }
  if (segment.cabinetKind === "tall") {
    return { ...segment, label: `T${width}` };
  }
  return { ...segment, cabinetKind: "base", label: `B${width}` };
}
