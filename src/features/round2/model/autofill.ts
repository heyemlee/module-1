import {
  applyMeasurementsToModel,
  type Round2DecisionItem,
  type Round2FixedPoint,
  type Round2HeightProfile,
  type Round2Model,
  type Round2Wall,
  type SegmentTier,
  type FrontAccessory,
  type WallId,
  type WallSegment,
  formatSixteenths
} from "./round2-model";
import { CABINET_STANDARDS } from "./cabinet-standards";
import { deriveCorners, type Round2Corner } from "./corners";
import {
  buildIntentConfirmationDecisions,
  fridgeAboveIntentKey,
  fridgeSidesIntentKey,
  type FridgeAboveStrategy,
  type FridgeSideStrategy,
  type Round2DesignIntent,
  type UpperCornerStrategy
} from "./design-intent";

const BASE_WIDTHS_ASCENDING = CABINET_STANDARDS.base.widthsSixteenths;
const BASE_WIDTHS_DESCENDING = [...BASE_WIDTHS_ASCENDING].sort(
  (a, b) => b - a
);
const MIN_CABINET_WIDTH_SIXTEENTHS = BASE_WIDTHS_ASCENDING[0];
const FILLER_MIN_SIXTEENTHS = CABINET_STANDARDS.filler.minSixteenths;
const FILLER_MAX_SIXTEENTHS = CABINET_STANDARDS.filler.maxSixteenths;

type FillTier = Extract<SegmentTier, "upper" | "base">;
type FillerSide = "start" | "end";

/** Corner segments for one wall, ordered outward from the corner. */
type TierInsets = { start: WallSegment[]; end: WallSegment[] };

/** Corner reservations per tier — uppers turn corners independently of bases. */
type WallInsets = { base: TierInsets; upper: TierInsets };

type BlindBaseCornerStrategy =
  | "blindBase"
  | "magicCorner"
  | "blindCornerPullOut"
  | "cornerPullOutShelves";

type PlacedReservation = {
  fixedPoint: Round2FixedPoint;
  start: number;
  width: number;
  kind: "appliance" | "opening";
  label: string;
  cabinetKind?: "sink" | "tall";
  /** Measured window center requested by an aligned sink before packing. */
  requestedWindowCenter?: number;
  anchored?: boolean;
  /**
   * Finished side-panel widths bundled into a fridge reservation. When set, the
   * placed reservation width already includes them, and fillBaseTier splits the
   * block into [left panel, fridge, right panel] so the panels consume real
   * wall width and shift neighbours like any other reservation.
   */
  fridgePanels?: { left: number; right: number };
};

type Reservation = Omit<PlacedReservation, "start" | "anchored"> & {
  desiredStart: number;
};

export function autofillRound2Model(
  model: Round2Model,
  measurements: Record<string, number | null> = {},
  intent?: Round2DesignIntent
): Round2Model {
  const measuredModel = applyMeasurementsToModel(model, measurements);
  const decisionItems: Round2DecisionItem[] = [];

  for (const wall of measuredModel.walls) {
    for (const point of wall.fixedPoints) {
      if (
        point.type === "appliance" &&
        point.symbol !== "hood" &&
        applianceStandard(point) == null
      ) {
        decisionItems.push({
          id: `decision-${point.id}-appliance-width`,
          objectId: point.id,
          wallId: wall.id,
          severity: "blocking",
          title: "Appliance width required",
          body: `${point.label} needs a customer-confirmed width before autofill.`
        });
      }
    }
  }

  const insetsByWall = buildCornerInsets(measuredModel, intent);

  let cabinetNumber = 1;
  let fillerNumber = 1;
  const walls = measuredModel.walls.map((wall) => {
    if (wall.lengthSixteenths == null) return { ...wall, segments: [] };

    const insets = insetsByWall.get(wall.id) ?? {
      base: { start: [], end: [] },
      upper: { start: [], end: [] }
    };
    const base = fillBaseTier(wall, insets.base, intent, decisionItems);
    const upper = deriveUpperTier(
      wall,
      base,
      insets.upper,
      intent,
      decisionItems
    );
    const numbered = [...upper, ...base].map((segment) => {
      if (
        segment.kind === "cabinet" ||
        (segment.kind === "appliance" && segment.cabinetKind != null)
      ) {
        return { ...segment, code: `#${cabinetNumber++}` };
      }
      if (segment.kind === "filler") {
        const code = `F${fillerNumber++}`;
        if (
          segment.widthSixteenths > 0 &&
          segment.widthSixteenths < FILLER_MIN_SIXTEENTHS
        ) {
          decisionItems.push({
            id: `decision-${segment.id}`,
            objectId: segment.id,
            wallId: wall.id,
            severity: "warning",
            title: `Wall ${wall.label} filler below minimum`,
            body: `${code} is ${formatSixteenths(segment.widthSixteenths)}, narrower than the ${formatSixteenths(FILLER_MIN_SIXTEENTHS)} minimum filler. Step a neighbor width or remeasure.`
          });
        }
        return { ...segment, code };
      }
      return segment;
    });

    return { ...wall, segments: numbered };
  });

  const height = deriveHeightProfile(
    measuredModel.ceilingHeightSixteenths,
    intent,
    measuredModel.walls[0] ?? null
  );
  decisionItems.push(...height.decisions);

  const filledModel: Round2Model = {
    ...measuredModel,
    walls,
    heightProfile: height.profile,
    decisionItems
  };
  if (!intent) return filledModel;

  return {
    ...filledModel,
    decisionItems: [
      ...decisionItems,
      ...buildIntentConfirmationDecisions(filledModel, intent, measurements)
    ]
  };
}

// Rule 1 — corners are resolved before any wall run is filled. A corner
// consumes width on both walls, so each wall's fillable interval starts
// inside its corner insets.
function buildCornerInsets(
  model: Round2Model,
  intent?: Round2DesignIntent
): Map<WallId, WallInsets> {
  const insets = new Map<WallId, WallInsets>();
  const wallInsets = (wallId: WallId): WallInsets => {
    const existing = insets.get(wallId);
    if (existing) return existing;
    const created: WallInsets = {
      base: { start: [], end: [] },
      upper: { start: [], end: [] }
    };
    insets.set(wallId, created);
    return created;
  };
  const tierFor = (wallId: WallId): TierInsets => wallInsets(wallId).base;
  const upperTierFor = (wallId: WallId): TierInsets => wallInsets(wallId).upper;

  for (const corner of deriveCorners(model)) {
    const strategy = resolveCornerStrategy(intent?.answers[corner.intentKey]);
    const cornerId = corner.id.toLowerCase();
    const primaryId = corner.primary.id.toLowerCase();
    const secondaryId = corner.secondary.id.toLowerCase();
    const baseDepth = CABINET_STANDARDS.depths.baseSixteenths;

    pushUpperCornerInsets(
      corner,
      resolveUpperCornerStrategy(intent?.answers[corner.upperIntentKey]),
      upperTierFor
    );

    if (strategy === "lazySusan") {
      const width = pickCornerWidth(
        CABINET_STANDARDS.corner.lazySusan.widthOptionsSixteenths,
        [corner.primary, corner.secondary]
      );
      tierFor(corner.primary.id)[corner.primaryEnd].push({
        id: `${primaryId}-base-corner-${cornerId}`,
        wallId: corner.primary.id,
        tier: "base",
        kind: "cabinet",
        cabinetKind: "corner",
        widthSixteenths: width,
        standardWidthSixteenths: width,
        label: `LS${width / 16}`,
        sourceCornerId: corner.id
      });
      tierFor(corner.secondary.id)[corner.secondaryEnd].push({
        id: `${secondaryId}-base-corner-${cornerId}-return`,
        wallId: corner.secondary.id,
        tier: "base",
        kind: "gap",
        widthSixteenths: width,
        label: `LS${width / 16} return`,
        sourceCornerId: corner.id
      });
    } else {
      const width = pickCornerWidth(
        CABINET_STANDARDS.corner.blindBase.widthOptionsSixteenths,
        [corner.primary]
      );
      const accessory = cornerAccessoryForStrategy(strategy);
      tierFor(corner.primary.id)[corner.primaryEnd].push({
        id: `${primaryId}-base-corner-${cornerId}`,
        wallId: corner.primary.id,
        tier: "base",
        kind: "cabinet",
        cabinetKind: "corner",
        widthSixteenths: width,
        standardWidthSixteenths: width,
        label: `BB${width / 16}`,
        front: accessory ? { accessories: [accessory] } : undefined,
        sourceCornerId: corner.id
      });
      tierFor(corner.secondary.id)[corner.secondaryEnd].push(
        {
          id: `${secondaryId}-base-corner-${cornerId}-body`,
          wallId: corner.secondary.id,
          tier: "base",
          kind: "gap",
          widthSixteenths: baseDepth,
          label: "Blind corner",
          sourceCornerId: corner.id
        },
        {
          id: `${secondaryId}-base-corner-${cornerId}-pull`,
          wallId: corner.secondary.id,
          tier: "base",
          kind: "filler",
          widthSixteenths:
            CABINET_STANDARDS.corner.blindBase.adjacentWallPullSixteenths,
          label: `F${CABINET_STANDARDS.corner.blindBase.adjacentWallPullSixteenths / 16}`,
          sourceCornerId: corner.id
        }
      );
    }
  }

  return insets;
}

// The upper tier turns each corner on its own terms: a diagonal wall cabinet
// consumes its width on both walls, a blind upper stays straight on the
// primary wall while the adjacent wall yields the upper depth plus a pull,
// and an open corner just clears the primary run's upper depth.
function pushUpperCornerInsets(
  corner: Round2Corner,
  strategy: UpperCornerStrategy,
  upperTierFor: (wallId: WallId) => TierInsets
): void {
  const cornerId = corner.id.toLowerCase();
  const primaryId = corner.primary.id.toLowerCase();
  const secondaryId = corner.secondary.id.toLowerCase();
  const upperDepth = CABINET_STANDARDS.depths.upperSixteenths;

  if (strategy === "diagonalUpper") {
    const width = pickCornerWidth(
      CABINET_STANDARDS.corner.upperDiagonal.widthOptionsSixteenths,
      [corner.primary, corner.secondary]
    );
    upperTierFor(corner.primary.id)[corner.primaryEnd].push({
      id: `${primaryId}-upper-corner-${cornerId}`,
      wallId: corner.primary.id,
      tier: "upper",
      kind: "cabinet",
      cabinetKind: "corner",
      widthSixteenths: width,
      standardWidthSixteenths: width,
      label: `WDC${width / 16}`,
      sourceCornerId: corner.id
    });
    upperTierFor(corner.secondary.id)[corner.secondaryEnd].push({
      id: `${secondaryId}-upper-corner-${cornerId}-return`,
      wallId: corner.secondary.id,
      tier: "upper",
      kind: "gap",
      widthSixteenths: width,
      label: `WDC${width / 16} return`,
      sourceCornerId: corner.id
    });
    return;
  }

  if (strategy === "blindUpper") {
    const width = pickCornerWidth(
      CABINET_STANDARDS.corner.upperBlind.widthOptionsSixteenths,
      [corner.primary]
    );
    const pull = CABINET_STANDARDS.corner.upperBlind.adjacentWallPullSixteenths;
    upperTierFor(corner.primary.id)[corner.primaryEnd].push({
      id: `${primaryId}-upper-corner-${cornerId}`,
      wallId: corner.primary.id,
      tier: "upper",
      kind: "cabinet",
      cabinetKind: "corner",
      widthSixteenths: width,
      standardWidthSixteenths: width,
      label: `WBC${width / 16}`,
      sourceCornerId: corner.id
    });
    upperTierFor(corner.secondary.id)[corner.secondaryEnd].push(
      {
        id: `${secondaryId}-upper-corner-${cornerId}-body`,
        wallId: corner.secondary.id,
        tier: "upper",
        kind: "gap",
        widthSixteenths: upperDepth,
        label: "Blind upper",
        sourceCornerId: corner.id
      },
      {
        id: `${secondaryId}-upper-corner-${cornerId}-pull`,
        wallId: corner.secondary.id,
        tier: "upper",
        kind: "filler",
        widthSixteenths: pull,
        label: `F${pull / 16}`,
        sourceCornerId: corner.id
      }
    );
    return;
  }

  // openUpper: no corner unit. The primary run finishes at the wall; the
  // secondary run clears the primary's upper depth.
  upperTierFor(corner.secondary.id)[corner.secondaryEnd].push({
    id: `${secondaryId}-upper-corner-${cornerId}-clearance`,
    wallId: corner.secondary.id,
    tier: "upper",
    kind: "gap",
    widthSixteenths: CABINET_STANDARDS.depths.upperSixteenths,
    label: "Open upper corner",
    sourceCornerId: corner.id
  });
}

function resolveUpperCornerStrategy(strategy: unknown): UpperCornerStrategy {
  if (strategy === "blindUpper" || strategy === "openUpper") return strategy;
  return "diagonalUpper";
}

function resolveCornerStrategy(
  strategy: unknown
): "lazySusan" | BlindBaseCornerStrategy {
  if (strategy === "lazySusan") return "lazySusan";
  if (isBlindBaseCornerStrategy(strategy)) return strategy;
  return "lazySusan";
}

function isBlindBaseCornerStrategy(
  strategy: unknown
): strategy is BlindBaseCornerStrategy {
  return (
    strategy === "blindBase" ||
    strategy === "magicCorner" ||
    strategy === "blindCornerPullOut" ||
    strategy === "cornerPullOutShelves"
  );
}

function cornerAccessoryForStrategy(
  strategy: BlindBaseCornerStrategy
): FrontAccessory | null {
  if (strategy === "magicCorner") return "magicCorner";
  if (strategy === "blindCornerPullOut") return "blindCornerPullOut";
  if (strategy === "cornerPullOutShelves") return "cornerPullOutShelves";
  return null;
}

// The intent question only picks the strategy; the width tier is derived as
// the largest option both walls can host ("宁少而宽").
function pickCornerWidth(
  options: readonly number[],
  walls: readonly Round2Wall[]
): number {
  const limit = Math.min(
    ...walls.map((wall) => wall.lengthSixteenths ?? Number.POSITIVE_INFINITY)
  );
  const fitting = options.filter((option) => option <= limit);
  return fitting.length > 0
    ? fitting[fitting.length - 1]
    : options[0];
}

/** A full-height finished side panel (见光板) flanking a tall unit. */
const FINISHED_PANEL_LABEL = "Panel";

function finishedPanelSegment(
  id: string,
  wallId: WallId,
  width: number,
  sourceFixedPointId: string
): WallSegment {
  return {
    id,
    wallId,
    tier: "base",
    kind: "panel",
    widthSixteenths: width,
    label: FINISHED_PANEL_LABEL,
    standardWidthSixteenths: width,
    sourceFixedPointId
  };
}

function fillBaseTier(
  wall: Round2Wall,
  insets: TierInsets,
  intent: Round2DesignIntent | undefined,
  decisionItems: Round2DecisionItem[]
): WallSegment[] {
  const length = wall.lengthSixteenths ?? 0;
  let startInsets = insets.start;
  let endInsets = [...insets.end].reverse();
  let fillStart = segmentTotal(startInsets);
  let fillEnd = length - segmentTotal(endInsets);

  if (fillStart > fillEnd) {
    const reservedCornerWidth = segmentTotal(startInsets) + segmentTotal(endInsets);
    decisionItems.push({
      id: `decision-${wall.id}-corner-overflow`,
      objectId: wall.id,
      wallId: wall.id,
      severity: "blocking",
      title: `Wall ${wall.label} too short for corner strategy`,
      body: `Corner reservations need ${formatSixteenths(reservedCornerWidth)} but the wall measures ${formatSixteenths(length)}. Revise the corner intent or remeasure.`
    });
    // Keep the immutable corner geometry visible. There is no remaining
    // ordinary-cabinet span, so fixed reservations pack after the start
    // corner and report their own overflow if they cannot fit either.
    fillEnd = fillStart;
  }

  const reservations = packReservations(
    baseReservations(wall, fillStart, fillEnd, intent),
    fillStart,
    fillEnd,
    wall,
    decisionItems
  );

  for (const item of reservations) {
    if (
      item.cabinetKind !== "sink" ||
      item.requestedWindowCenter == null ||
      item.anchored
    ) {
      continue;
    }
    decisionItems.push({
      id: `decision-${item.fixedPoint.id}-window-placement`,
      objectId: item.fixedPoint.id,
      wallId: wall.id,
      severity: "blocking",
      title: "Sink placement conflicts with window alignment",
      body: `${item.label} cannot stay centered under its measured window after fixed reservations were placed. Adjust the fixed-point layout or request a remeasure.`
    });
  }

  const segments: WallSegment[] = [...startInsets];
  let cursor = fillStart;
  let sequence = 1;
  const hasStartCorner = startInsets.length > 0;
  const hasEndCorner = endInsets.length > 0;

  const pushSpan = (spanStart: number, spanEnd: number) => {
    if (spanEnd <= spanStart) return;
    const side = fillerSideForSpan(
      spanStart,
      spanEnd,
      fillStart,
      fillEnd,
      hasStartCorner,
      hasEndCorner,
      length
    );
    segments.push(
      ...fillSpan(
        wall,
        "base",
        spanStart,
        spanEnd,
        sequence,
        side,
        decisionItems
      )
    );
    sequence += 1;
  };

  for (const item of reservations) {
    pushSpan(cursor, item.start);
    const wallPrefix = wall.id.toLowerCase();
    const panels = item.fridgePanels;
    const applianceWidth = panels
      ? item.width - panels.left - panels.right
      : item.width;
    if (panels && panels.left > 0) {
      segments.push(
        finishedPanelSegment(
          `${wallPrefix}-base-${sequence}-panel-left-${item.fixedPoint.id}`,
          wall.id,
          panels.left,
          item.fixedPoint.id
        )
      );
    }
    segments.push({
      id: `${wallPrefix}-base-${sequence}-${item.kind}-${item.fixedPoint.id}`,
      wallId: wall.id,
      tier: "base",
      kind: item.kind,
      widthSixteenths: applianceWidth,
      label: item.label,
      cabinetKind: item.cabinetKind,
      standardWidthSixteenths: applianceWidth,
      sourceFixedPointId: item.fixedPoint.id,
      anchored: item.anchored
    });
    if (panels && panels.right > 0) {
      segments.push(
        finishedPanelSegment(
          `${wallPrefix}-base-${sequence}-panel-right-${item.fixedPoint.id}`,
          wall.id,
          panels.right,
          item.fixedPoint.id
        )
      );
    }
    sequence += 1;
    cursor = item.start + item.width;
  }
  pushSpan(cursor, fillEnd);
  segments.push(...endInsets);

  return tagFunctionalNeighbors(segments, intent);
}

/** The finished-panel treatment a designer chose above a fridge tall unit. */
function fridgeAboveStrategy(
  fixedPointId: string,
  intent: Round2DesignIntent | undefined
): FridgeAboveStrategy {
  const value = intent?.answers[fridgeAboveIntentKey(fixedPointId)];
  return value === "wallCabinet" || value === "panel" ? value : "gap";
}

/**
 * Finished side-panel widths flanking a fridge, from the per-fridge sides
 * intent. Returns null (no panels) for the default so autofill reproduces the
 * original single-segment fridge exactly.
 */
function fridgeSidePanels(
  point: Round2FixedPoint,
  intent: Round2DesignIntent | undefined
): { left: number; right: number } | null {
  const value = intent?.answers[fridgeSidesIntentKey(point.id)] as
    | FridgeSideStrategy
    | undefined;
  if (value == null || value === "none") return null;
  const panel = CABINET_STANDARDS.finishedPanel.sideWidthSixteenths;
  return {
    left: value === "left" || value === "both" ? panel : 0,
    right: value === "right" || value === "both" ? panel : 0
  };
}

// Rule 2 — fixed points become anchors: the sink centers on the window, the
// range follows the gas marker, the fridge hugs a wall end, the dishwasher
// docks against the sink. Doors block the base run entirely.
function baseReservations(
  wall: Round2Wall,
  fillStart: number,
  fillEnd: number,
  intent?: Round2DesignIntent
): Reservation[] {
  const length = wall.lengthSixteenths ?? 0;
  const items: Reservation[] = [];

  for (const point of wall.fixedPoints) {
    if (point.type !== "door") continue;
    const width = Math.max(0, point.widthSixteenths ?? 0);
    if (width === 0) continue;
    items.push({
      fixedPoint: point,
      desiredStart:
        point.offsetSixteenths ??
        Math.round(point.positionRatio * Math.max(0, length - width)),
      width,
      kind: "opening",
      label: point.label
    });
  }

  const sinkPoint = wall.fixedPoints.find(
    (point) => point.type === "appliance" && point.symbol === "sink"
  );
  const window = wall.fixedPoints.find((point) => point.type === "window");
  let sinkStart: number | null = null;
  let sinkWidth = 0;

  if (sinkPoint) {
    const standard = applianceStandard(sinkPoint);
    if (standard) {
      sinkWidth = standard.widthSixteenths;
      const alignment =
        intent?.answers[`sink-window.${wall.id}.alignment`] ?? "align";
      const windowCenter =
        window &&
        window.offsetSixteenths != null &&
        window.widthSixteenths != null
          ? window.offsetSixteenths + Math.round(window.widthSixteenths / 2)
          : null;
      const aligned = alignment === "align" && windowCenter != null;
      sinkStart = aligned
        ? (windowCenter as number) - Math.round(sinkWidth / 2)
        : Math.round(sinkPoint.positionRatio * Math.max(0, length - sinkWidth));
      items.push({
        fixedPoint: sinkPoint,
        desiredStart: sinkStart,
        width: sinkWidth,
        kind: "appliance",
        label: standard.label,
        cabinetKind: "sink",
        // This records the requested measured center. Anchoring is decided only
        // after packing confirms that the final sink placement still matches it.
        requestedWindowCenter: aligned ? windowCenter ?? undefined : undefined
      });
    }
  }

  for (const point of wall.fixedPoints) {
    if (
      point.type !== "appliance" ||
      point.symbol === "sink" ||
      point.symbol === "hood"
    ) {
      continue;
    }
    const standard = applianceStandard(point);
    if (!standard) continue;
    const applianceWidth = standard.widthSixteenths;
    const fridgePanels =
      point.symbol === "fridge" ? fridgeSidePanels(point, intent) : null;
    // The reservation block spans the fridge plus any bundled side panels, so
    // packing and overflow checks treat the finished sides as consumed width.
    const width =
      applianceWidth + (fridgePanels?.left ?? 0) + (fridgePanels?.right ?? 0);
    let desiredStart = Math.round(
      point.positionRatio * Math.max(0, length - width)
    );
    if (point.symbol === "range") {
      const gas = wall.fixedPoints.find(
        (item) => item.type === "marker" && item.symbol === "G"
      );
      if (gas) {
        desiredStart = Math.round(gas.positionRatio * length - width / 2);
      }
    } else if (point.symbol === "fridge") {
      desiredStart = point.positionRatio < 0.5 ? fillStart : fillEnd - width;
    } else if (point.symbol === "dishwasher" && sinkPoint && sinkStart != null) {
      desiredStart =
        point.positionRatio <= sinkPoint.positionRatio
          ? sinkStart - width
          : sinkStart + sinkWidth;
    }
    items.push({
      fixedPoint: point,
      desiredStart,
      width,
      kind: "appliance",
      label: standard.label,
      cabinetKind:
        point.symbol === "fridge" ||
        point.symbol === "oven" ||
        point.symbol === "microwave"
          ? "tall"
          : undefined,
      fridgePanels: fridgePanels ?? undefined
    });
  }

  return items;
}

function packReservations(
  reservations: Reservation[],
  fillStart: number,
  fillEnd: number,
  wall: Round2Wall,
  decisionItems: Round2DecisionItem[]
): PlacedReservation[] {
  const sorted = [...reservations].sort(
    (a, b) =>
      a.desiredStart - b.desiredStart ||
      a.fixedPoint.id.localeCompare(b.fixedPoint.id)
  );
  const sink = sorted.find((item) => item.requestedWindowCenter != null);
  if (!sink) {
    return packInterval(sorted, fillStart, fillEnd, wall, decisionItems);
  }

  // The window-aligned sink is confirmed first: it pins to the measured
  // window center — only immutable corner geometry can bound it — and every
  // other reservation packs around it instead of displacing it.
  const sinkStart = Math.max(
    fillStart,
    Math.min(sink.desiredStart, fillEnd - sink.width)
  );
  const before = sorted.filter(
    (item) => item !== sink && item.desiredStart < sinkStart
  );
  const after = sorted.filter(
    (item) => item !== sink && item.desiredStart >= sinkStart
  );

  return [
    ...packInterval(before, fillStart, sinkStart, wall, decisionItems),
    placeReservation(sink, sinkStart, fillEnd, wall, decisionItems),
    ...packInterval(
      after,
      Math.max(sinkStart + sink.width, fillStart),
      fillEnd,
      wall,
      decisionItems
    )
  ];
}

function packInterval(
  reservations: Reservation[],
  intervalStart: number,
  intervalEnd: number,
  wall: Round2Wall,
  decisionItems: Round2DecisionItem[]
): PlacedReservation[] {
  const placed: PlacedReservation[] = [];
  let cursor = intervalStart;

  for (const item of reservations) {
    const start = Math.max(
      cursor,
      Math.min(item.desiredStart, intervalEnd - item.width)
    );
    placed.push(placeReservation(item, start, intervalEnd, wall, decisionItems));
    cursor = start + item.width;
  }

  return placed;
}

function placeReservation(
  item: Reservation,
  start: number,
  intervalEnd: number,
  wall: Round2Wall,
  decisionItems: Round2DecisionItem[]
): PlacedReservation {
  const width = item.width;
  const overflow = start + width - intervalEnd;
  if (overflow > 0) {
    decisionItems.push({
      id: `decision-${item.fixedPoint.id}-reservation-overflow`,
      objectId: item.fixedPoint.id,
      wallId: wall.id,
      severity: "blocking",
      title: "Fixed reservation exceeds available wall space",
      body: `${item.label} needs ${formatSixteenths(width)} but extends ${formatSixteenths(overflow)} beyond the available run. Keep the fixed geometry and revise the layout, corner strategy, or measurement.`
    });
  }
  const anchored =
    item.requestedWindowCenter == null
      ? undefined
      : start + width / 2 === item.requestedWindowCenter;
  return { ...item, start, width, anchored };
}

// Rule 3 + 4 — zones between anchors are packed as an exact partition of
// standard cabinet widths. A filler is allowed only when the partition leaves
// one approved 3–6″ remainder; otherwise the span stays visibly unresolved.
function fillSpan(
  wall: Round2Wall,
  tier: FillTier,
  spanStart: number,
  spanEnd: number,
  sequence: number,
  fillerSide: FillerSide,
  decisionItems: Round2DecisionItem[]
): WallSegment[] {
  const span = spanEnd - spanStart;
  if (span <= 0) return [];

  const partition = partitionBaseSpan(span);
  if (!partition) {
    return blockingGapSegments(wall, tier, sequence, span, decisionItems);
  }

  const prefix = tier === "upper" ? "W" : "B";
  const cabinets = partition.widths.map((width, local) => ({
    id: `${wall.id.toLowerCase()}-${tier}-${sequence}-${local + 1}-cabinet`,
    wallId: wall.id,
    tier,
    kind: "cabinet" as const,
    widthSixteenths: width,
    label: `${prefix}${width / 16}`,
    cabinetKind: tier === "upper" ? ("upper" as const) : ("base" as const),
    standardWidthSixteenths: width
  }));

  const filler = residualSegments(
    wall,
    tier,
    sequence,
    partition.fillerWidth,
    decisionItems
  );

  return fillerSide === "start" ? [...filler, ...cabinets] : [...cabinets, ...filler];
}

type BaseSpanPartition = {
  widths: number[];
  fillerWidth: number;
};

/**
 * Finds the standard-width cabinet total that leaves no filler or one approved
 * filler. The filler order is intentional: 0 closes a span exactly, then the
 * preferred 3″ filler wins before the wider approved options.
 */
function partitionBaseSpan(span: number): BaseSpanPartition | null {
  const preferredFillers = [
    0,
    ...[...CABINET_STANDARDS.filler.commonWidthsSixteenths].sort(
      (a, b) =>
        Math.abs(a - CABINET_STANDARDS.filler.preferredSixteenths) -
          Math.abs(b - CABINET_STANDARDS.filler.preferredSixteenths) ||
        a - b
    )
  ];
  const customFillers = Array.from(
    {
      length: FILLER_MAX_SIXTEENTHS - FILLER_MIN_SIXTEENTHS + 1
    },
    (_, index) => FILLER_MIN_SIXTEENTHS + index
  )
    .filter((width) => !preferredFillers.includes(width))
    .sort(
      (a, b) =>
        Math.abs(a - CABINET_STANDARDS.filler.preferredSixteenths) -
          Math.abs(b - CABINET_STANDARDS.filler.preferredSixteenths) ||
        a - b
    );

  for (const fillerWidth of [...preferredFillers, ...customFillers]) {
    const widths = exactBaseCabinetPartition(span - fillerWidth);
    if (widths) return { widths, fillerWidth };
  }

  return null;
}

/**
 * Finds one exact standard-width partition. It first minimizes cabinet count,
 * then prefers the lexicographically wider descending width list. This keeps
 * the choice deterministic while still allowing 9″ cabinets when necessary.
 */
function exactBaseCabinetPartition(total: number): number[] | null {
  if (total < 0) return null;

  const memo = new Map<string, number[] | null>();
  const solve = (remaining: number, firstWidthIndex: number): number[] | null => {
    if (remaining === 0) return [];
    if (remaining < MIN_CABINET_WIDTH_SIXTEENTHS) return null;

    const key = `${remaining}:${firstWidthIndex}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best: number[] | null = null;
    for (
      let index = firstWidthIndex;
      index < BASE_WIDTHS_DESCENDING.length;
      index += 1
    ) {
      const width = BASE_WIDTHS_DESCENDING[index];
      if (width > remaining) continue;
      const suffix = solve(remaining - width, index);
      if (!suffix) continue;

      const candidate = [width, ...suffix];
      if (!best || prefersCabinetPartition(candidate, best)) best = candidate;
    }

    memo.set(key, best);
    return best;
  };

  return solve(total, 0);
}

function prefersCabinetPartition(candidate: number[], current: number[]): boolean {
  if (candidate.length !== current.length) {
    return candidate.length < current.length;
  }

  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== current[index]) {
      return candidate[index] > current[index];
    }
  }
  return false;
}

function residualSegments(
  wall: Round2Wall,
  tier: FillTier,
  sequence: number,
  width: number,
  decisionItems: Round2DecisionItem[],
  source?: Pick<WallSegment, "sourceCornerId" | "sourceFixedPointId">
): WallSegment[] {
  if (width <= 0) return [];

  const fillerWidths = splitFillerWidths(width);
  if (fillerWidths) {
    return fillerWidths.map((fillerWidth, index) => ({
      id: `${wall.id.toLowerCase()}-${tier}-${sequence}-filler-${index + 1}`,
      wallId: wall.id,
      tier,
      kind: "filler" as const,
      widthSixteenths: fillerWidth,
      label: `F${Math.round(fillerWidth / 16)}`,
      ...source
    }));
  }

  return blockingGapSegments(
    wall,
    tier,
    sequence,
    width,
    decisionItems,
    source
  );
}

function blockingGapSegments(
  wall: Round2Wall,
  tier: FillTier,
  sequence: number,
  width: number,
  decisionItems: Round2DecisionItem[],
  source?: Pick<WallSegment, "sourceCornerId" | "sourceFixedPointId">
): WallSegment[] {
  const id = `${wall.id.toLowerCase()}-${tier}-${sequence}-gap`;
  decisionItems.push({
    id: `decision-${id}-below-filler-minimum`,
    objectId: id,
    wallId: wall.id,
    severity: "blocking",
    title: `Wall ${wall.label} gap below filler minimum`,
    body: `${formatSixteenths(width)} cannot be filled with the approved ${formatSixteenths(FILLER_MIN_SIXTEENTHS)}-${formatSixteenths(FILLER_MAX_SIXTEENTHS)} filler range. Step a neighbor width or remeasure.`
  });
  return [
    {
      id,
      wallId: wall.id,
      tier,
      kind: "gap",
      widthSixteenths: width,
      label: "Unresolved gap",
      ...source
    }
  ];
}

function splitFillerWidths(width: number): number[] | null {
  if (width < FILLER_MIN_SIXTEENTHS) return null;
  if (width <= FILLER_MAX_SIXTEENTHS) return [width];

  const widths: number[] = [];
  let remaining = width;
  while (remaining > FILLER_MAX_SIXTEENTHS) {
    if (remaining - FILLER_MIN_SIXTEENTHS <= FILLER_MAX_SIXTEENTHS) {
      widths.push(FILLER_MIN_SIXTEENTHS);
      remaining -= FILLER_MIN_SIXTEENTHS;
      break;
    }

    const next =
      remaining - FILLER_MAX_SIXTEENTHS >= FILLER_MIN_SIXTEENTHS
        ? FILLER_MAX_SIXTEENTHS
        : remaining - FILLER_MIN_SIXTEENTHS;
    widths.push(next);
    remaining -= next;
  }

  widths.push(remaining);
  return widths;
}

function fillerSideForSpan(
  spanStart: number,
  spanEnd: number,
  fillStart: number,
  fillEnd: number,
  hasStartCorner: boolean,
  hasEndCorner: boolean,
  length: number
): FillerSide {
  const first = spanStart === fillStart;
  const last = spanEnd === fillEnd;
  if (first && last) {
    return hasStartCorner && !hasEndCorner ? "start" : "end";
  }
  if (first) return "start";
  if (last) return "end";
  return (spanStart + spanEnd) / 2 <= length / 2 ? "start" : "end";
}

// Rule 3 (functional adjacency) — the cabinets flanking the range become
// drawer bases and the cabinet on the intent side of the sink hosts the
// trash pullout. Both stay ordinary base cabinets geometrically.
function tagFunctionalNeighbors(
  segments: WallSegment[],
  intent?: Round2DesignIntent
): WallSegment[] {
  const tagged = [...segments];

  const rangeIndex = tagged.findIndex(
    (segment) =>
      segment.kind === "appliance" &&
      segment.label.startsWith(CABINET_STANDARDS.appliances.range.labelPrefix)
  );
  if (rangeIndex !== -1) {
    for (const neighborIndex of [rangeIndex - 1, rangeIndex + 1]) {
      const neighbor = tagged[neighborIndex];
      if (neighbor?.kind === "cabinet" && neighbor.cabinetKind === "base") {
        tagged[neighborIndex] = {
          ...neighbor,
          label: `DB${Math.round(neighbor.widthSixteenths / 16)}`
        };
      }
    }
  }

  const trashPreference = intent?.answers["trash.location"] ?? "sinkRight";
  if (trashPreference === "none") return tagged;
  const sinkIndex = tagged.findIndex(
    (segment) => segment.cabinetKind === "sink"
  );
  if (sinkIndex === -1) return tagged;
  const step = trashPreference === "sinkLeft" ? -1 : 1;
  for (
    let index = sinkIndex + step;
    index >= 0 && index < tagged.length;
    index += step
  ) {
    const segment = tagged[index];
    if (segment.kind === "opening" || segment.kind === "gap") break;
    if (
      segment.kind === "cabinet" &&
      segment.cabinetKind === "base" &&
      !segment.label.startsWith("DB")
    ) {
      tagged[index] = {
        ...segment,
        label: `WB${Math.round(segment.widthSixteenths / 16)}`
      };
      break;
    }
  }
  return tagged;
}

// Rule 5 — the upper tier is a projection of the base tier: seams copy up,
// the hood follows the range width, the fridge gets a deep upper, tall units
// leave a gap, and window/door openings are carved out afterwards.
function deriveUpperTier(
  wall: Round2Wall,
  baseSegments: WallSegment[],
  insets: TierInsets,
  intent: Round2DesignIntent | undefined,
  decisionItems: Round2DecisionItem[]
): WallSegment[] {
  const length = wall.lengthSixteenths ?? 0;
  if (length === 0) return [];

  const startInsets = insets.start;
  const endInsets = [...insets.end].reverse();
  const fillStart = Math.min(segmentTotal(startInsets), length);
  // A wall too short for its corner strategy is already reported by the base
  // tier; clamp so the upper derivation stays inside the wall regardless.
  const fillEnd = Math.max(length - segmentTotal(endInsets), fillStart);

  type Placed = { segment: WallSegment; start: number; end: number };
  const basePlaced: Placed[] = [];
  let position = 0;
  for (const segment of baseSegments) {
    basePlaced.push({
      segment,
      start: position,
      end: position + segment.widthSixteenths
    });
    position += segment.widthSixteenths;
  }

  type OpeningInterval = {
    point: Round2FixedPoint;
    start: number;
    end: number;
  };
  const openings: OpeningInterval[] = [];
  for (const placed of basePlaced) {
    if (placed.segment.kind !== "opening") continue;
    const point = wall.fixedPoints.find(
      (item) => item.id === placed.segment.sourceFixedPointId
    );
    if (point) openings.push({ point, start: placed.start, end: placed.end });
  }
  for (const point of wall.fixedPoints) {
    if (point.type !== "window") continue;
    const width = Math.max(0, point.widthSixteenths ?? 0);
    if (width === 0) continue;
    const start = Math.min(
      Math.max(
        point.offsetSixteenths ??
          Math.round(point.positionRatio * Math.max(0, length - width)),
        0
      ),
      length - width
    );
    openings.push({ point, start, end: start + width });
  }

  const cuts = new Set<number>([fillStart, fillEnd]);
  for (const placed of basePlaced) {
    cuts.add(placed.start);
    cuts.add(placed.end);
  }
  for (const opening of openings) {
    cuts.add(Math.max(0, opening.start));
    cuts.add(Math.min(length, opening.end));
  }
  const bounds = [...cuts]
    .filter((value) => value >= fillStart && value <= fillEnd)
    .sort((a, b) => a - b);

  type Piece = {
    type: "opening" | "hood" | "gap" | "cabinet" | "filler" | "panel";
    ref: string;
    label: string;
    width: number;
    cabinetKind?: "upper";
    sourceFixedPointId?: string;
    sourceCornerId?: string;
  };
  const pieces: Piece[] = [];

  for (let index = 0; index < bounds.length - 1; index += 1) {
    const from = bounds[index];
    const to = bounds[index + 1];
    if (to <= from) continue;
    const width = to - from;

    const opening = openings.find(
      (item) => item.start <= from && to <= item.end
    );
    const piece = opening
      ? ({
          type: "opening",
          ref: opening.point.id,
          label: opening.point.label,
          width,
          sourceFixedPointId: opening.point.id
        } as Piece)
      : mapBaseToUpperPiece(
          wall,
          basePlaced.find((item) => item.start <= from && to <= item.end),
          width,
          intent
        );
    if (!piece) continue;

    const previous = pieces[pieces.length - 1];
    if (previous && previous.type === piece.type && previous.ref === piece.ref) {
      previous.width += piece.width;
    } else {
      pieces.push(piece);
    }
  }

  const derived = pieces.flatMap((piece, index) => {
    const id = `${wall.id.toLowerCase()}-upper-${index + 1}-${piece.type}`;
    if (piece.type === "opening") {
      return {
        id,
        wallId: wall.id,
        tier: "upper" as const,
        kind: "opening" as const,
        widthSixteenths: piece.width,
        label: piece.label,
        sourceFixedPointId: piece.sourceFixedPointId
      };
    }
    if (piece.type === "gap") {
      return {
        id,
        wallId: wall.id,
        tier: "upper" as const,
        kind: "gap" as const,
        widthSixteenths: piece.width,
        label: piece.label,
        sourceCornerId: piece.sourceCornerId,
        sourceFixedPointId: piece.sourceFixedPointId
      };
    }
    if (piece.type === "filler") {
      return residualSegments(
        wall,
        "upper",
        index + 1,
        piece.width,
        decisionItems,
        {
          sourceCornerId: piece.sourceCornerId,
          sourceFixedPointId: piece.sourceFixedPointId
        }
      );
    }
    if (piece.type === "panel") {
      return {
        id,
        wallId: wall.id,
        tier: "upper" as const,
        kind: "panel" as const,
        widthSixteenths: piece.width,
        label: piece.label,
        sourceFixedPointId: piece.sourceFixedPointId
      };
    }
    const label =
      piece.type === "hood"
        ? `HD${Math.round(piece.width / 16)}`
        : `W${Math.round(piece.width / 16)}`;
    return {
      id,
      wallId: wall.id,
      tier: "upper" as const,
      kind: "cabinet" as const,
      widthSixteenths: piece.width,
      label,
      cabinetKind: "upper" as const,
      standardWidthSixteenths: piece.width,
      sourceFixedPointId: piece.sourceFixedPointId
    };
  });

  return [...startInsets, ...derived, ...endInsets];
}

function mapBaseToUpperPiece(
  wall: Round2Wall,
  placed: { segment: WallSegment } | undefined,
  width: number,
  intent?: Round2DesignIntent
): {
  type: "hood" | "gap" | "cabinet" | "filler" | "panel";
  ref: string;
  label: string;
  width: number;
  sourceFixedPointId?: string;
  sourceCornerId?: string;
} | null {
  if (!placed) return null;
  const base = placed.segment;

  // A finished side panel is full height, so nothing stacks above it.
  if (base.kind === "panel") {
    return { type: "gap", ref: base.id, label: base.label, width };
  }

  if (base.kind === "appliance") {
    const point = wall.fixedPoints.find(
      (item) => item.id === base.sourceFixedPointId
    );
    if (point?.symbol === "range") {
      const hoodStyle = intent?.answers["hood.style"] ?? "cabinetInsert";
      if (hoodStyle === "chimney") {
        return {
          type: "gap",
          ref: base.id,
          label: "Chimney hood zone",
          width,
          sourceFixedPointId: point.id
        };
      }
      return {
        type: "hood",
        ref: base.id,
        label: "",
        width,
        sourceFixedPointId: point.id
      };
    }
    // Above a fridge the designer can leave the default gap, drop in a deep
    // wall cabinet, or close it with a finished panel (见光板). Other tall units
    // (oven/pantry towers) keep the plain gap.
    if (base.cabinetKind === "tall") {
      if (point?.symbol === "fridge") {
        const above = fridgeAboveStrategy(point.id, intent);
        if (above === "wallCabinet") {
          return {
            type: "cabinet",
            ref: base.id,
            label: "",
            width,
            sourceFixedPointId: point.id
          };
        }
        if (above === "panel") {
          return {
            type: "panel",
            ref: base.id,
            label: FINISHED_PANEL_LABEL,
            width,
            sourceFixedPointId: point.id
          };
        }
      }
      return {
        type: "gap",
        ref: base.id,
        label: "Tall unit",
        width,
        sourceFixedPointId: base.sourceFixedPointId
      };
    }
    // Sink and dishwasher runs carry ordinary uppers aligned to their seams.
    // Window cuts can leave a sliver, which must become a filler (or blocking
    // gap through residualSegments) instead of an undersized upper cabinet.
    if (width < MIN_CABINET_WIDTH_SIXTEENTHS) {
      return { type: "filler", ref: base.id, label: "", width };
    }
    return { type: "cabinet", ref: base.id, label: "", width };
  }

  if (base.kind === "filler") {
    return { type: "filler", ref: base.id, label: "", width };
  }
  // The wall over a base corner body (lazy-Susan return, blind body) is
  // ordinary upper space — the corner reservation for the upper tier is
  // already carved out by the upper insets — so only doors and genuinely
  // unresolved gaps block the run.
  if (base.kind === "opening" || (base.kind === "gap" && !base.sourceCornerId)) {
    return { type: "gap", ref: base.id, label: base.label, width };
  }

  // Seam-copied upper; slivers left by window carving become fillers.
  if (width < MIN_CABINET_WIDTH_SIXTEENTHS) {
    return { type: "filler", ref: base.id, label: "", width };
  }
  return { type: "cabinet", ref: base.id, label: "", width };
}

// Rule 6 — the height chain consumes the measured ceiling: the upper height
// is the largest standard tier that fits under counter + backsplash +
// moulding, and the flat moulding size is a derived product.
function deriveHeightProfile(
  ceilingHeightSixteenths: number | null,
  intent: Round2DesignIntent | undefined,
  wall: Round2Wall | null
): { profile: Round2HeightProfile | null; decisions: Round2DecisionItem[] } {
  if (ceilingHeightSixteenths == null || !wall) {
    return { profile: null, decisions: [] };
  }

  const vertical = CABINET_STANDARDS.vertical;
  const counter = vertical.finishedCounterHeightSixteenths;
  const backsplash = vertical.backsplashMinSixteenths;
  const termination = intent?.answers["uppers.termination"] ?? "standard";
  const style = intent?.answers["uppers.moulding"] ?? "flat3";
  const styleMoulding =
    style === "none"
      ? 0
      : style === "flat2"
        ? vertical.flatMoulding.minSixteenths
        : vertical.flatMoulding.preferredSixteenths;
  const available = ceilingHeightSixteenths - counter - backsplash;
  const tiers = [...CABINET_STANDARDS.upper.standardHeightsSixteenths].sort(
    (a, b) => b - a
  );
  const decisions: Round2DecisionItem[] = [];

  let upperHeight: number;
  let moulding = styleMoulding;

  if (termination === "ceiling") {
    const mouldingMin = style === "none" ? 0 : vertical.flatMoulding.minSixteenths;
    const mouldingMax = style === "none" ? 0 : vertical.flatMoulding.maxSixteenths;
    const fit = tiers.find((tier) => tier <= available - mouldingMin) ?? null;
    upperHeight = fit ?? Math.max(0, available - mouldingMin);
    moulding = Math.min(Math.max(available - upperHeight, mouldingMin), mouldingMax);
    const leftover = available - upperHeight - moulding;
    if (fit == null || leftover !== 0) {
      decisions.push({
        id: "decision-height-ceiling-closure",
        objectId: wall.id,
        wallId: wall.id,
        severity: "warning",
        title: "Uppers cannot close to the ceiling",
        body: `A ${formatSixteenths(leftover)} gap remains above ${formatSixteenths(upperHeight)} uppers with ${formatSixteenths(moulding)} moulding. Confirm the reveal or change the moulding intent.`
      });
    }
  } else {
    const fit = tiers.find((tier) => tier <= available - moulding) ?? null;
    upperHeight = fit ?? Math.max(0, available - moulding);
    if (fit == null) {
      decisions.push({
        id: "decision-height-no-standard-upper",
        objectId: wall.id,
        wallId: wall.id,
        severity: "warning",
        title: "No standard upper height fits",
        body: `Only ${formatSixteenths(available)} remains above the backsplash. Confirm a custom upper height.`
      });
    }
  }

  return {
    profile: {
      counterSixteenths: counter,
      backsplashSixteenths: backsplash,
      upperHeightSixteenths: upperHeight,
      mouldingSixteenths: moulding
    },
    decisions
  };
}

function segmentTotal(segments: readonly WallSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0);
}

function applianceStandard(
  point: Round2FixedPoint
): { widthSixteenths: number; label: string } | null {
  if (point.symbol === "hood") return null;

  const appliances = CABINET_STANDARDS.appliances;
  const definition =
    point.symbol === "dishwasher"
      ? appliances.dishwasher
      : point.symbol === "range"
        ? appliances.range
        : point.symbol === "fridge"
          ? appliances.refrigerator
          : point.symbol === "sink"
            ? appliances.sinkBase
            : null;
  const customerWidth =
    point.widthSixteenths != null && point.widthSixteenths > 0
      ? point.widthSixteenths
      : null;

  if (definition) {
    const widthSixteenths =
      customerWidth ?? definition.defaultWidthSixteenths;
    return {
      widthSixteenths,
      label: `${definition.labelPrefix}${widthSixteenths / 16}`
    };
  }

  if (customerWidth) {
    return { widthSixteenths: customerWidth, label: point.label };
  }

  return null;
}
