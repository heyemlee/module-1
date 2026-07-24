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
  dishwasherPlacementIntentKey,
  fridgeAboveIntentKey,
  fridgeSidesIntentKey,
  gapResolutionIntentKey,
  type DishwasherPlacement,
  type FridgeAboveStrategy,
  type FridgeSideStrategy,
  type GapResolution,
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
   * Finished side-panel widths bundled into an appliance reservation (fridge,
   * dishwasher, tall oven/pantry towers). When set, the placed reservation
   * width already includes them, and fillBaseTier splits the block into
   * [left panel, unit, right panel] so the panels consume real wall width and
   * shift neighbours like any other reservation. `span` is the panels'
   * vertical extent: full height beside a tall unit, base height beside an
   * under-counter dishwasher.
   */
  sidePanels?: SidePanels;
};

type SidePanels = { left: number; right: number; span: "full" | "tier" };

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
        // A strip the designer explicitly confirmed via a gap resolution is
        // not an accidental sliver — skip the below-minimum warning for it.
        const sourceGapId = segment.id.replace(/-filler-\d+$/, "");
        const confirmedStrip =
          sourceGapId !== segment.id &&
          gapResolution(sourceGapId, intent) === "fillerFill";
        if (
          !confirmedStrip &&
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

  // A designer may intentionally convert a filler into open space. Preserve
  // that explicit choice when another intent edit regenerates the run.
  const intentionalGaps = new Map(
    measuredModel.walls.flatMap((wall) =>
      wall.segments
        .filter((segment) => segment.kind === "gap" && segment.intentionalGap)
        .map((segment) => [segment.id, segment] as const)
    )
  );
  const preservedWalls = walls.map((wall) => ({
    ...wall,
    segments: wall.segments.map((segment) => {
      const preserved = intentionalGaps.get(segment.id);
      return preserved
        ? {
            ...segment,
            kind: "gap" as const,
            label: preserved.label,
            intentionalGap: true,
            widthSixteenths: preserved.widthSixteenths
          }
        : segment;
    })
  }));

  const filledModel: Round2Model = {
    ...measuredModel,
    walls: preservedWalls,
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

/** A finished panel (见光板) closing an exposed cabinet side. */
const FINISHED_PANEL_LABEL = "Panel";
const PANEL_WIDTH_SIXTEENTHS =
  CABINET_STANDARDS.finishedPanel.sideWidthSixteenths;
// End panels flank cabinets: a run too short to host even the smallest
// cabinet next to both panels (a degenerate scribe-only span) gets none.
const MIN_RUN_FOR_END_PANELS_SIXTEENTHS =
  PANEL_WIDTH_SIXTEENTHS * 2 + MIN_CABINET_WIDTH_SIXTEENTHS;

function finishedPanelSegment(
  id: string,
  wallId: WallId,
  tier: FillTier,
  width: number,
  span: "full" | "tier",
  sourceFixedPointId?: string
): WallSegment {
  return {
    id,
    wallId,
    tier,
    kind: "panel",
    widthSixteenths: width,
    label: FINISHED_PANEL_LABEL,
    standardWidthSixteenths: width,
    sourceFixedPointId,
    panelSpan: span
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

  // Rule 1b — an exposed run end (no corner geometry) closes with a finished
  // end panel the height of its tier. A door landing on the wall end, or a
  // tall unit whose own full-height side panel already closes the run, leaves
  // no exposed cabinet side there, so no extra panel is reserved.
  const endPanels = baseEndPanelSides(
    wall,
    fillStart,
    fillEnd,
    startInsets.length > 0,
    endInsets.length > 0,
    intent
  );
  if (endPanels.start) fillStart += PANEL_WIDTH_SIXTEENTHS;
  if (endPanels.end) fillEnd -= PANEL_WIDTH_SIXTEENTHS;

  const reservations = nudgeRangeToCloseRuns(
    packReservations(
      fitAppliancesToSpan(
        baseReservations(wall, fillStart, fillEnd, intent),
        fillStart,
        fillEnd,
        wall,
        decisionItems
      ),
      fillStart,
      fillEnd,
      wall,
      decisionItems
    ),
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

  const wallPrefix = wall.id.toLowerCase();
  const segments: WallSegment[] = [...startInsets];
  if (endPanels.start) {
    segments.push(
      finishedPanelSegment(
        `${wallPrefix}-base-endpanel-start`,
        wall.id,
        "base",
        PANEL_WIDTH_SIXTEENTHS,
        "tier"
      )
    );
  }
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
        intent,
        decisionItems
      )
    );
    sequence += 1;
  };

  for (const item of reservations) {
    pushSpan(cursor, item.start);
    const panels = item.sidePanels;
    const applianceWidth = panels
      ? item.width - panels.left - panels.right
      : item.width;
    if (panels && panels.left > 0) {
      segments.push(
        finishedPanelSegment(
          `${wallPrefix}-base-${sequence}-panel-left-${item.fixedPoint.id}`,
          wall.id,
          "base",
          panels.left,
          panels.span,
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
          "base",
          panels.right,
          panels.span,
          item.fixedPoint.id
        )
      );
    }
    sequence += 1;
    cursor = item.start + item.width;
  }
  pushSpan(cursor, fillEnd);
  if (endPanels.end) {
    segments.push(
      finishedPanelSegment(
        `${wallPrefix}-base-endpanel-end`,
        wall.id,
        "base",
        PANEL_WIDTH_SIXTEENTHS,
        "tier"
      )
    );
  }
  segments.push(...endInsets);

  return tagFunctionalNeighbors(segments, intent);
}

/**
 * Which run ends need a finished end panel, decided before packing from the
 * fixed-point geometry: a corner reservation, a door whose opening reaches the
 * wall end, or a fridge/tall unit that hugs the end with its own full-height
 * side panel all close the run without one.
 */
function baseEndPanelSides(
  wall: Round2Wall,
  fillStart: number,
  fillEnd: number,
  hasStartCorner: boolean,
  hasEndCorner: boolean,
  intent: Round2DesignIntent | undefined
): { start: boolean; end: boolean } {
  const length = wall.lengthSixteenths ?? 0;
  if (fillEnd - fillStart < MIN_RUN_FOR_END_PANELS_SIXTEENTHS) {
    return { start: false, end: false };
  }
  let start = !hasStartCorner;
  let end = !hasEndCorner;

  for (const point of wall.fixedPoints) {
    if (point.type === "door") {
      const width = Math.max(0, point.widthSixteenths ?? 0);
      if (width === 0) continue;
      const desired =
        point.offsetSixteenths ??
        Math.round(point.positionRatio * Math.max(0, length - width));
      if (desired <= fillStart + 1) start = false;
      if (desired + width >= fillEnd - 1) end = false;
      continue;
    }
    if (point.type !== "appliance") continue;
    if (
      point.symbol !== "fridge" &&
      point.symbol !== "oven" &&
      point.symbol !== "microwave"
    ) {
      continue;
    }
    const panels = tallSidePanels(point, intent);
    if (!panels) continue;
    // The fridge deterministically hugs a run end (see baseReservations); the
    // other towers hug one only when their Round 1 spot sits there.
    const hugsStart =
      point.symbol === "fridge"
        ? point.positionRatio < 0.5
        : point.positionRatio <= 0.05;
    const hugsEnd =
      point.symbol === "fridge"
        ? point.positionRatio >= 0.5
        : point.positionRatio >= 0.95;
    if (hugsStart && panels.left > 0) start = false;
    if (hugsEnd && panels.right > 0) end = false;
  }

  return { start, end };
}

/** Whether a dishwasher docks against the sink or keeps its Round 1 spot. */
function dishwasherPlacement(
  fixedPointId: string,
  intent: Round2DesignIntent | undefined
): DishwasherPlacement {
  const value = intent?.answers[dishwasherPlacementIntentKey(fixedPointId)];
  return value === "keepRound1" ? "keepRound1" : "dockToSink";
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
 * Finished side-panel widths flanking a tall unit (fridge, oven/pantry
 * tower). Both sides carry a panel by default; a fridge can be dialed back
 * per side through the per-fridge sides intent.
 */
function tallSidePanels(
  point: Round2FixedPoint,
  intent: Round2DesignIntent | undefined
): SidePanels | null {
  const value =
    point.symbol === "fridge"
      ? ((intent?.answers[fridgeSidesIntentKey(point.id)] as
          | FridgeSideStrategy
          | undefined) ?? "both")
      : "both";
  if (value === "none") return null;
  return {
    left:
      value === "left" || value === "both" ? PANEL_WIDTH_SIXTEENTHS : 0,
    right:
      value === "right" || value === "both" ? PANEL_WIDTH_SIXTEENTHS : 0,
    span: "full"
  };
}

/** An under-counter dishwasher always carries base-height panels both sides. */
function dishwasherSidePanels(): SidePanels {
  return {
    left: PANEL_WIDTH_SIXTEENTHS,
    right: PANEL_WIDTH_SIXTEENTHS,
    span: "tier"
  };
}

/**
 * Rule 2b — keep the base run inside the wall using only appliance widths the
 * proposal already offers. When fixed appliances overflow, sink bases step
 * down through their standard widths before ranges do. Measured openings,
 * refrigerators, and dishwashers never flex. An overflow that cannot close
 * with those tiers falls through to the normal blocking path.
 */
function fitAppliancesToSpan(
  reservations: Reservation[],
  fillStart: number,
  fillEnd: number,
  wall: Round2Wall,
  decisionItems: Round2DecisionItem[]
): Reservation[] {
  const span = fillEnd - fillStart;
  if (span <= 0) return reservations;

  const total = reservations.reduce((sum, item) => sum + item.width, 0);
  if (total <= span) return reservations;

  const reduced = reservations.map((item) => ({ ...item }));
  for (const symbol of ["sink", "range"] as const) {
    while (reservationWidth(reduced) > span) {
      const candidate = reduced.find(
        (item) =>
          item.kind === "appliance" &&
          item.fixedPoint.symbol === symbol &&
          nextSmallerApplianceWidth(item) != null
      );
      if (!candidate) break;

      const nextWidth = nextSmallerApplianceWidth(candidate)!;
      candidate.width = nextWidth + reservationPanelWidth(candidate);
      candidate.label = applianceLabel(candidate.fixedPoint.symbol, nextWidth);
      candidate.requestedWindowCenter = undefined;
    }
  }

  if (reservationWidth(reduced) > span) return reservations;

  const ordered = [...reduced].sort(
    (a, b) =>
      a.desiredStart - b.desiredStart ||
      a.fixedPoint.id.localeCompare(b.fixedPoint.id)
  );
  let cursor = fillStart;
  for (const item of ordered) {
    item.desiredStart = cursor;
    cursor += item.width;
  }

  const adjustedNames = ordered
    .filter((item) => item.kind === "appliance")
    .map((item) => item.label)
    .join(", ");
  decisionItems.push({
    id: `decision-${wall.id}-appliance-autofit`,
    objectId: wall.id,
    wallId: wall.id,
    severity: "warning",
    title: `Wall ${wall.label} appliances reduced to fit`,
    body: `The fixed appliances totaled more than the ${formatSixteenths(span)} run, so ${adjustedNames} were stepped down through their available appliance widths to close the wall.`
  });

  return ordered;
}

function reservationWidth(reservations: readonly Reservation[]): number {
  return reservations.reduce((sum, item) => sum + item.width, 0);
}

function reservationPanelWidth(reservation: Reservation): number {
  return (reservation.sidePanels?.left ?? 0) + (reservation.sidePanels?.right ?? 0);
}

function nextSmallerApplianceWidth(reservation: Reservation): number | null {
  const options = applianceWidthOptions(reservation.fixedPoint.symbol);
  if (!options) return null;
  const bodyWidth = reservation.width - reservationPanelWidth(reservation);
  return options.filter((option) => option < bodyWidth).at(-1) ?? null;
}

function applianceWidthOptions(symbol: string | undefined): readonly number[] | null {
  const appliances = CABINET_STANDARDS.appliances;
  if (symbol === "sink") return appliances.sinkBase.widthOptionsSixteenths;
  if (symbol === "range") return appliances.range.widthOptionsSixteenths;
  return null;
}

function applianceLabel(symbol: string | undefined, widthSixteenths: number): string {
  const appliances = CABINET_STANDARDS.appliances;
  const prefix =
    symbol === "sink"
      ? appliances.sinkBase.labelPrefix
      : symbol === "range"
        ? appliances.range.labelPrefix
        : null;
  return prefix ? `${prefix}${widthSixteenths / 16}` : "Appliance";
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
    const sidePanels =
      point.symbol === "fridge" ||
      point.symbol === "oven" ||
      point.symbol === "microwave"
        ? tallSidePanels(point, intent)
        : point.symbol === "dishwasher"
          ? dishwasherSidePanels()
          : null;
    // The reservation block spans the unit plus any bundled side panels, so
    // packing and overflow checks treat the finished sides as consumed width.
    const width =
      applianceWidth + (sidePanels?.left ?? 0) + (sidePanels?.right ?? 0);
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
    } else if (
      point.symbol === "dishwasher" &&
      sinkPoint &&
      sinkStart != null &&
      dishwasherPlacement(point.id, intent) === "dockToSink"
    ) {
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
      sidePanels: sidePanels ?? undefined
    });
  }

  return items;
}

/**
 * How far the range may slide off its requested position (gas mark or Round 1
 * ratio) when doing so lets the neighboring runs close on standard widths.
 * Gas connections use flexible hoses, so a small offset is installable.
 */
const RANGE_NUDGE_TOLERANCE_SIXTEENTHS = 3 * 16;

/** Fewer blocking spans, then fewer fillers, then less filler width wins. */
type NudgeScore = readonly [number, number, number];

function betterNudgeScore(candidate: NudgeScore, current: NudgeScore): boolean {
  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== current[index]) {
      return candidate[index] < current[index];
    }
  }
  return false;
}

// Rule 2a — the range is a soft anchor: its requested position is honored
// within a small tolerance. When sliding it a hair lets the spans on both
// sides partition into standard widths with fewer (ideally zero) fillers, the
// nudge is applied; a gas mark makes the offset a designer-visible warning.
function nudgeRangeToCloseRuns(
  placed: PlacedReservation[],
  fillStart: number,
  fillEnd: number,
  wall: Round2Wall,
  decisionItems: Round2DecisionItem[]
): PlacedReservation[] {
  const result = [...placed];

  for (let index = 0; index < result.length; index += 1) {
    const item = result[index];
    if (item.kind !== "appliance" || item.fixedPoint.symbol !== "range") {
      continue;
    }
    const previous = result[index - 1];
    const next = result[index + 1];
    const leftBound = previous ? previous.start + previous.width : fillStart;
    const rightBound = next ? next.start : fillEnd;
    const leftSpan = item.start - leftBound;
    const rightSpan = rightBound - (item.start + item.width);
    // Overlapping reservations already carry their own blocking decision.
    if (leftSpan < 0 || rightSpan < 0) continue;

    const scoreFor = (left: number, right: number): NudgeScore => {
      let blocked = 0;
      let fillers = 0;
      let fillerWidth = 0;
      for (const span of [left, right]) {
        if (span === 0) continue;
        const partition = partitionBaseSpan(span);
        if (!partition) {
          blocked += 1;
        } else if (partition.fillerWidth > 0) {
          fillers += 1;
          fillerWidth += partition.fillerWidth;
        }
      }
      return [blocked, fillers, fillerWidth];
    };

    let bestDelta = 0;
    let bestScore = scoreFor(leftSpan, rightSpan);
    if (bestScore[0] === 0 && bestScore[1] === 0) continue;

    // Ascending magnitude, so the smallest sufficient offset wins.
    for (
      let magnitude = 1;
      magnitude <= RANGE_NUDGE_TOLERANCE_SIXTEENTHS;
      magnitude += 1
    ) {
      for (const delta of [-magnitude, magnitude]) {
        if (leftSpan + delta < 0 || rightSpan - delta < 0) continue;
        const score = scoreFor(leftSpan + delta, rightSpan - delta);
        if (betterNudgeScore(score, bestScore)) {
          bestDelta = delta;
          bestScore = score;
        }
      }
    }
    if (bestDelta === 0) continue;

    result[index] = { ...item, start: item.start + bestDelta };

    const gas = wall.fixedPoints.find(
      (point) => point.type === "marker" && point.symbol === "G"
    );
    if (gas) {
      decisionItems.push({
        id: `decision-${item.fixedPoint.id}-nudge`,
        objectId: item.fixedPoint.id,
        wallId: wall.id,
        severity: "warning",
        title: "Range nudged off the gas mark",
        body: `${item.label} moved ${formatSixteenths(Math.abs(bestDelta))} ${
          bestDelta > 0 ? "right" : "left"
        } of the gas mark so the neighboring runs close on standard widths. Confirm the connection reach.`
      });
    }
  }

  return result;
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
// one approved 3–6″ remainder; otherwise the span stays visibly unresolved
// until the designer picks a gap resolution.
function fillSpan(
  wall: Round2Wall,
  tier: FillTier,
  spanStart: number,
  spanEnd: number,
  sequence: number,
  fillerSide: FillerSide,
  intent: Round2DesignIntent | undefined,
  decisionItems: Round2DecisionItem[]
): WallSegment[] {
  const span = spanEnd - spanStart;
  if (span <= 0) return [];

  const partition = partitionBaseSpan(span);
  if (!partition) {
    return blockingGapSegments(wall, tier, sequence, span, intent, decisionItems);
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
    intent,
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
  intent: Round2DesignIntent | undefined,
  decisionItems: Round2DecisionItem[]
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
      label: `F${Math.round(fillerWidth / 16)}`
    }));
  }

  return blockingGapSegments(wall, tier, sequence, width, intent, decisionItems);
}

function gapResolution(
  gapSegmentId: string,
  intent: Round2DesignIntent | undefined
): GapResolution | null {
  const value = intent?.answers[gapResolutionIntentKey(gapSegmentId)];
  return value === "fillerFill" || value === "leaveOpen" ? value : null;
}

function blockingGapSegments(
  wall: Round2Wall,
  tier: FillTier,
  sequence: number,
  width: number,
  intent: Round2DesignIntent | undefined,
  decisionItems: Round2DecisionItem[]
): WallSegment[] {
  const id = `${wall.id.toLowerCase()}-${tier}-${sequence}-gap`;

  // A designer resolution recorded against this span replaces the blocking
  // gap: filler strips (split into approved widths where possible, a single
  // scribe strip when the span is below the minimum) or confirmed open space.
  const resolution = gapResolution(id, intent);
  if (resolution === "fillerFill") {
    const fillerWidths = splitFillerWidths(width) ?? [width];
    return fillerWidths.map((fillerWidth, index) => ({
      id: `${id}-filler-${index + 1}`,
      wallId: wall.id,
      tier,
      kind: "filler" as const,
      widthSixteenths: fillerWidth,
      label: `F${Math.round(fillerWidth / 16)}`
    }));
  }
  if (resolution === "leaveOpen") {
    return [
      {
        id,
        wallId: wall.id,
        tier,
        kind: "gap",
        widthSixteenths: width,
        label: "Open space"
      }
    ];
  }

  decisionItems.push({
    id: `decision-${id}-below-filler-minimum`,
    objectId: id,
    wallId: wall.id,
    severity: "blocking",
    title: `Wall ${wall.label} gap below filler minimum`,
    body: `${formatSixteenths(width)} cannot be filled with the approved ${formatSixteenths(FILLER_MIN_SIXTEENTHS)}-${formatSixteenths(FILLER_MAX_SIXTEENTHS)} filler range. Step a neighbor width, fill it with filler strips, or confirm it as open space.`
  });
  return [
    {
      id,
      wallId: wall.id,
      tier,
      kind: "gap",
      widthSixteenths: width,
      label: "Unresolved gap"
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

/** One classified stretch of the upper tier before segments are emitted. */
type UpperPiece = {
  type: "opening" | "hood" | "gap" | "cabinet" | "panel" | "fill";
  ref: string;
  label: string;
  width: number;
  sourceFixedPointId?: string;
  sourceCornerId?: string;
};

// Rule 5 — the upper tier shares the base tier's anchors, not its seams:
// window/door openings are carved out, the hood follows the range, tall units
// and finished panels reserve their columns, and every remaining continuous
// run is repartitioned into standard widths with at most one approved filler
// pushed to the run's edge (Rules 3 + 4 applied to the upper tier).
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

  // Rule 1b (upper tier) — an exposed upper-run end closes with an
  // upper-height finished end panel. An end already closed by corner
  // geometry, an opening, or a full-height tall column/side panel stays as
  // is; a base-height end panel below means the upper panel stacks directly
  // above it in the same column.
  const startPanel =
    startInsets.length === 0 &&
    fillEnd - fillStart >= MIN_RUN_FOR_END_PANELS_SIXTEENTHS &&
    upperEndExposed(basePlaced, openings, fillStart);
  const endPanel =
    endInsets.length === 0 &&
    fillEnd - fillStart >= MIN_RUN_FOR_END_PANELS_SIXTEENTHS &&
    upperEndExposed(basePlaced, openings, fillEnd - 1);
  const runStart = fillStart + (startPanel ? PANEL_WIDTH_SIXTEENTHS : 0);
  const runEnd = Math.max(
    fillEnd - (endPanel ? PANEL_WIDTH_SIXTEENTHS : 0),
    runStart
  );

  // A sink with no window over its column carries its own upper module —
  // same width, same column (see model/sink-upper.ts for its height rule).
  const windowlessSinks = new Set<string>();
  for (const placed of basePlaced) {
    if (placed.segment.cabinetKind !== "sink") continue;
    const windowed = openings.some(
      (opening) =>
        opening.point.type === "window" &&
        opening.start < placed.end &&
        opening.end > placed.start
    );
    if (!windowed) windowlessSinks.add(placed.segment.id);
  }

  const cuts = new Set<number>([runStart, runEnd]);
  for (const placed of basePlaced) {
    cuts.add(placed.start);
    cuts.add(placed.end);
  }
  for (const opening of openings) {
    cuts.add(Math.max(0, opening.start));
    cuts.add(Math.min(length, opening.end));
  }
  const bounds = [...cuts]
    .filter((value) => value >= runStart && value <= runEnd)
    .sort((a, b) => a - b);

  const pieces: UpperPiece[] = [];

  for (let index = 0; index < bounds.length - 1; index += 1) {
    const from = bounds[index];
    const to = bounds[index + 1];
    if (to <= from) continue;
    const width = to - from;

    const opening = openings.find(
      (item) => item.start <= from && to <= item.end
    );
    const piece: UpperPiece = opening
      ? {
          type: "opening",
          ref: opening.point.id,
          label: opening.point.label,
          width,
          sourceFixedPointId: opening.point.id
        }
      : mapBaseToUpperPiece(
          wall,
          basePlaced.find((item) => item.start <= from && to <= item.end),
          width,
          windowlessSinks,
          intent
        );

    const previous = pieces[pieces.length - 1];
    if (
      previous &&
      previous.type === piece.type &&
      (piece.type === "fill" || previous.ref === piece.ref)
    ) {
      previous.width += piece.width;
    } else {
      pieces.push(piece);
    }
  }

  const hasStartCorner = startInsets.length > 0;
  const hasEndCorner = endInsets.length > 0;
  const derived: WallSegment[] = [];
  let cursor = runStart;

  pieces.forEach((piece, index) => {
    const from = cursor;
    const to = from + piece.width;
    cursor = to;

    if (piece.type === "fill") {
      derived.push(
        ...fillSpan(
          wall,
          "upper",
          from,
          to,
          index + 1,
          fillerSideForSpan(
            from,
            to,
            runStart,
            runEnd,
            hasStartCorner,
            hasEndCorner,
            length
          ),
          intent,
          decisionItems
        )
      );
      return;
    }

    const id = `${wall.id.toLowerCase()}-upper-${index + 1}-${piece.type}`;
    if (piece.type === "opening") {
      derived.push({
        id,
        wallId: wall.id,
        tier: "upper",
        kind: "opening",
        widthSixteenths: piece.width,
        label: piece.label,
        sourceFixedPointId: piece.sourceFixedPointId
      });
      return;
    }
    if (piece.type === "gap") {
      derived.push({
        id,
        wallId: wall.id,
        tier: "upper",
        kind: "gap",
        widthSixteenths: piece.width,
        label: piece.label,
        sourceCornerId: piece.sourceCornerId,
        sourceFixedPointId: piece.sourceFixedPointId
      });
      return;
    }
    if (piece.type === "panel") {
      derived.push({
        id,
        wallId: wall.id,
        tier: "upper",
        kind: "panel",
        widthSixteenths: piece.width,
        label: piece.label,
        sourceFixedPointId: piece.sourceFixedPointId
      });
      return;
    }
    const label =
      piece.type === "hood"
        ? `HD${Math.round(piece.width / 16)}`
        : `W${Math.round(piece.width / 16)}`;
    derived.push({
      id,
      wallId: wall.id,
      tier: "upper",
      kind: "cabinet",
      widthSixteenths: piece.width,
      label,
      cabinetKind: "upper",
      standardWidthSixteenths: piece.width,
      sourceFixedPointId: piece.sourceFixedPointId
    });
  });

  const wallPrefix = wall.id.toLowerCase();
  return [
    ...startInsets,
    ...(startPanel
      ? [
          finishedPanelSegment(
            `${wallPrefix}-upper-endpanel-start`,
            wall.id,
            "upper",
            PANEL_WIDTH_SIXTEENTHS,
            "tier"
          )
        ]
      : []),
    ...derived,
    ...(endPanel
      ? [
          finishedPanelSegment(
            `${wallPrefix}-upper-endpanel-end`,
            wall.id,
            "upper",
            PANEL_WIDTH_SIXTEENTHS,
            "tier"
          )
        ]
      : []),
    ...endInsets
  ];
}

/**
 * Whether the upper run at this wall position ends on an exposed cabinet side
 * that needs an end panel. Openings, unresolved/corner gaps, tall columns and
 * their full-height side panels already terminate the run.
 */
function upperEndExposed(
  basePlaced: readonly { segment: WallSegment; start: number; end: number }[],
  openings: readonly { start: number; end: number }[],
  position: number
): boolean {
  if (
    openings.some(
      (opening) => opening.start <= position && position < opening.end
    )
  ) {
    return false;
  }
  const placed = basePlaced.find(
    (item) => item.start <= position && position < item.end
  );
  if (!placed) return true;
  const base = placed.segment;
  if (base.kind === "opening" || base.kind === "gap") return false;
  if (base.cabinetKind === "tall") return false;
  if (base.kind === "panel" && base.panelSpan !== "tier") return false;
  return true;
}

// Classifies the wall area above one base piece. Openings, the hood, tall
// units, and finished panels reserve their columns ("hard" pieces); everything
// else — base cabinets, fillers, sink/dishwasher runs, and the wall over a
// base corner body — is ordinary upper space that joins the surrounding
// fillable run and is repartitioned by fillSpan.
function mapBaseToUpperPiece(
  wall: Round2Wall,
  placed: { segment: WallSegment } | undefined,
  width: number,
  windowlessSinks: ReadonlySet<string>,
  intent?: Round2DesignIntent
): UpperPiece {
  if (!placed) return { type: "fill", ref: "open-wall", label: "", width };
  const base = placed.segment;

  // A full-height side panel lets nothing stack above it; a tier-height panel
  // (run end, dishwasher side) is ordinary upper space.
  if (base.kind === "panel") {
    if (base.panelSpan === "tier") {
      return { type: "fill", ref: base.id, label: "", width };
    }
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
    // A windowless sink carries its own upper module: the sink cabinet's
    // exact width and column, so it stays horizontally centered on the sink.
    // Its raised bottom is a rendering rule (see model/sink-upper.ts).
    if (base.cabinetKind === "sink" && windowlessSinks.has(base.id)) {
      return {
        type: "cabinet",
        ref: base.id,
        label: "",
        width,
        sourceFixedPointId: base.sourceFixedPointId
      };
    }
    // Sink-under-window and dishwasher columns carry ordinary uppers; they
    // merge into the surrounding run so window cuts repartition instead of
    // leaving slivers.
    return { type: "fill", ref: base.id, label: "", width };
  }

  // Doors block the upper run; a genuinely unresolved base gap stays visible.
  if (base.kind === "opening" || (base.kind === "gap" && !base.sourceCornerId)) {
    return { type: "gap", ref: base.id, label: base.label, width };
  }

  // Base cabinets, fillers, and the wall over a base corner body (lazy-Susan
  // return, blind body) are ordinary upper space — the upper tier's own corner
  // reservation is already carved out by the upper insets.
  return { type: "fill", ref: base.id, label: "", width };
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
