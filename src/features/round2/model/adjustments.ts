import {
  FILLER_MIN_SIXTEENTHS,
  STANDARD_CABINET_WIDTHS_SIXTEENTHS
} from "./autofill";
import {
  type CabinetKind,
  type Round2DecisionItem,
  type Round2Model,
  type Round2Wall,
  type SegmentTier,
  type WallId,
  type WallSegment,
  formatSixteenths
} from "./round2-model";

export type NudgeDirection = "left" | "right";
export type FillerEnd = "start" | "end";

export function standardWidthOptionsSixteenths(): number[] {
  return [...STANDARD_CABINET_WIDTHS_SIXTEENTHS].sort((a, b) => a - b);
}

export function stepCabinetWidth(
  model: Round2Model,
  segmentId: string,
  targetWidthSixteenths: number
): Round2Model {
  const standard = standardWidthOptionsSixteenths();
  if (!standard.includes(targetWidthSixteenths)) return model;

  const context = findSegmentContext(model, segmentId);
  if (!context || !canResizeSegment(context.segment)) return model;

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
  const context = findSegmentContext(model, segmentId);
  if (!context || context.segment.kind === "opening") return model;

  const segments = [...context.wall.segments];
  let targetIndex = segments.findIndex((segment) => segment.id === segmentId);
  const left = ensureSideFiller(segments, targetIndex, context.segment.tier, "left");
  targetIndex = segments.findIndex((segment) => segment.id === segmentId);
  const right = ensureSideFiller(segments, targetIndex, context.segment.tier, "right");
  const sign = direction === "left" ? -1 : 1;

  segments[left] = withWidth(
    segments[left],
    segments[left].widthSixteenths + sign * amountSixteenths
  );
  segments[right] = withWidth(
    segments[right],
    segments[right].widthSixteenths - sign * amountSixteenths
  );

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function moveFillerEnd(
  model: Round2Model,
  segmentId: string,
  end: FillerEnd
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || context.segment.kind !== "filler") return model;

  const segments = [...context.wall.segments];
  const currentIndex = segments.findIndex((segment) => segment.id === segmentId);
  const [segment] = segments.splice(currentIndex, 1);
  const tierIndices = segments
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.tier === segment.tier)
    .map(({ index }) => index);

  if (tierIndices.length === 0) {
    segments.push(segment);
  } else if (end === "start") {
    segments.splice(tierIndices[0], 0, segment);
  } else {
    segments.splice(tierIndices[tierIndices.length - 1] + 1, 0, segment);
  }

  return updateModelDecisions(replaceWallSegments(model, context.wall.id, segments));
}

export function setSegmentKind(
  model: Round2Model,
  segmentId: string,
  cabinetKind: CabinetKind
): Round2Model {
  const context = findSegmentContext(model, segmentId);
  if (!context || !canResizeSegment(context.segment)) return model;
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

export function updateModelDecisions(model: Round2Model): Round2Model {
  const decisionItems: Round2DecisionItem[] = [];

  for (const wall of model.walls) {
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
        segment.widthSixteenths < FILLER_MIN_SIXTEENTHS
      ) {
        decisionItems.push({
          id: `decision-${segment.id}-minimum`,
          objectId: segment.id,
          wallId: wall.id,
          severity: "warning",
          title: `Wall ${wall.label} filler below minimum`,
          body: `${segment.code ?? segment.label} is narrower than 1/2". Request a design decision or remeasure.`
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
      wall.id === wallId ? { ...wall, segments } : wall
    )
  };
}

function canResizeSegment(segment: WallSegment): boolean {
  return segment.kind === "cabinet" || segment.kind === "appliance";
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

  const id = `${target.wallId.toLowerCase()}-${target.tier}-adjustment-filler`;
  const existing = segments.findIndex((segment) => segment.id === id);
  if (existing !== -1) return existing;

  segments.push({
    id,
    wallId: target.wallId,
    tier: target.tier,
    kind: "filler",
    widthSixteenths: 0,
    label: "Adjustment filler",
    code: `F${target.wallId}${target.tier === "upper" ? "U" : "B"}`
  });
  return segments.length - 1;
}

function nearestFillerIndex(
  segments: WallSegment[],
  tier: SegmentTier,
  targetIndex: number,
  delta: number
): number {
  const candidates = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.tier === tier && segment.kind === "filler");
  const withCapacity =
    delta > 0
      ? candidates.filter(({ segment }) => segment.widthSixteenths >= delta)
      : candidates;
  const pool = withCapacity.length > 0 ? withCapacity : candidates;
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
      if (segments[index].tier === tier && segments[index].kind === "filler") {
        return index;
      }
    }
    const target = segments[targetIndex];
    segments.splice(targetIndex, 0, {
      id: `${target.wallId.toLowerCase()}-${tier}-left-nudge-filler`,
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
    if (segments[index].tier === tier && segments[index].kind === "filler") {
      return index;
    }
  }
  const target = segments[targetIndex];
  segments.splice(targetIndex + 1, 0, {
    id: `${target.wallId.toLowerCase()}-${tier}-right-nudge-filler`,
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
