import {
  applyMeasurementsToModel,
  type Round2DecisionItem,
  type Round2FixedPoint,
  type Round2Model,
  type Round2Wall,
  type SegmentTier,
  type WallSegment
} from "./round2-model";

export const STANDARD_CABINET_WIDTHS_SIXTEENTHS = [
  36, 33, 30, 27, 24, 21, 18, 15, 12, 9
].map((width) => width * 16);

export const FILLER_MIN_SIXTEENTHS = 8;

type ReservedSegment = {
  fixedPoint: Round2FixedPoint;
  desiredStart: number;
  width: number;
  kind: "appliance" | "opening";
  label: string;
  cabinetKind?: "sink" | "tall";
};

export function autofillRound2Model(
  model: Round2Model,
  measurements: Record<string, number | null> = {}
): Round2Model {
  const measuredModel = applyMeasurementsToModel(model, measurements);
  const decisionItems: Round2DecisionItem[] = [];
  let cabinetNumber = 1;
  let fillerNumber = 1;

  const walls = measuredModel.walls.map((wall) => {
    if (wall.lengthSixteenths == null) return { ...wall, segments: [] };

    const upper = autofillWallTier(wall, "upper");
    const base = autofillWallTier(wall, "base");
    const numbered = [...upper, ...base].map((segment) => {
      if (
        segment.kind === "cabinet" ||
        segment.kind === "appliance"
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
            body: `${code} is narrower than 1/2". Request a design decision or remeasure.`
          });
        }
        return { ...segment, code };
      }
      return segment;
    });

    return { ...wall, segments: numbered };
  });

  return {
    ...measuredModel,
    walls,
    decisionItems
  };
}

export function autofillWall(wall: Round2Wall): WallSegment[] {
  if (wall.lengthSixteenths == null) return [];
  return [
    ...autofillWallTier(wall, "upper"),
    ...autofillWallTier(wall, "base")
  ];
}

function autofillWallTier(
  wall: Round2Wall,
  tier: Extract<SegmentTier, "upper" | "base">
): WallSegment[] {
  if (wall.lengthSixteenths == null) return [];

  const reserved =
    tier === "upper" ? openingReservations(wall) : applianceReservations(wall);
  return fillRunAroundReserved(wall, tier, reserved);
}

function fillRunAroundReserved(
  wall: Round2Wall,
  tier: Extract<SegmentTier, "upper" | "base">,
  reserved: ReservedSegment[]
): WallSegment[] {
  const length = wall.lengthSixteenths ?? 0;
  const segments: WallSegment[] = [];
  let cursor = 0;
  let sequence = 1;

  for (const item of reserved.sort(
    (a, b) => a.desiredStart - b.desiredStart || a.fixedPoint.id.localeCompare(b.fixedPoint.id)
  )) {
    const start = Math.max(cursor, Math.min(item.desiredStart, length));
    const width = Math.min(item.width, Math.max(0, length - start));
    if (start > cursor) {
      segments.push(
        ...fillSpan(wall, tier, start - cursor, sequence, item.kind === "opening")
      );
      sequence += 1;
    }
    if (width > 0) {
      segments.push({
        id: `${wall.id.toLowerCase()}-${tier}-${sequence}-${item.kind}-${item.fixedPoint.id}`,
        wallId: wall.id,
        tier,
        kind: item.kind,
        widthSixteenths: width,
        label: item.label,
        cabinetKind: item.cabinetKind,
        standardWidthSixteenths: width,
        sourceFixedPointId: item.fixedPoint.id
      });
      sequence += 1;
      cursor = start + width;
    }
  }

  if (cursor < length) {
    segments.push(...fillSpan(wall, tier, length - cursor, sequence, false));
  }

  const total = segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0);
  if (total < length) {
    segments.push({
      id: `${wall.id.toLowerCase()}-${tier}-closure-filler`,
      wallId: wall.id,
      tier,
      kind: "filler",
      widthSixteenths: length - total,
      label: `F${formatWidth(length - total)}`
    });
  }

  return segments;
}

function fillSpan(
  wall: Round2Wall,
  tier: Extract<SegmentTier, "upper" | "base">,
  spanWidth: number,
  sequence: number,
  adjacentToOpening: boolean
): WallSegment[] {
  const segments: WallSegment[] = [];
  let remaining = Math.max(0, spanWidth);
  let local = 1;

  while (remaining >= 9 * 16) {
    const width =
      STANDARD_CABINET_WIDTHS_SIXTEENTHS.find((candidate) => candidate <= remaining) ??
      null;
    if (!width) break;
    segments.push({
      id: `${wall.id.toLowerCase()}-${tier}-${sequence}-${local}-cabinet`,
      wallId: wall.id,
      tier,
      kind: "cabinet",
      widthSixteenths: width,
      label: `${tier === "upper" ? "W" : "B"}${width / 16}`,
      cabinetKind: tier === "upper" ? "upper" : "base",
      standardWidthSixteenths: width
    });
    remaining -= width;
    local += 1;
  }

  if (remaining > 0 || segments.length === 0) {
    const fillerWidth = remaining > 0 ? remaining : spanWidth;
    if (fillerWidth > 0) {
      segments.push({
        id: `${wall.id.toLowerCase()}-${tier}-${sequence}-${local}-filler`,
        wallId: wall.id,
        tier,
        kind: "filler",
        widthSixteenths: fillerWidth,
        label: adjacentToOpening ? `Opening filler ${formatWidth(fillerWidth)}` : `F${formatWidth(fillerWidth)}`
      });
    }
  }

  return segments;
}

function openingReservations(wall: Round2Wall): ReservedSegment[] {
  const length = wall.lengthSixteenths ?? 0;
  return wall.fixedPoints
    .filter((point) => point.type === "window" || point.type === "door")
    .map((point) => {
      const width = Math.max(0, point.widthSixteenths ?? 0);
      const measuredOffset = point.offsetSixteenths;
      const desiredStart =
        measuredOffset == null
          ? Math.round(point.positionRatio * Math.max(0, length - width))
          : measuredOffset;
      return {
        fixedPoint: point,
        desiredStart,
        width,
        kind: "opening" as const,
        label: point.label
      };
    })
    .filter((item) => item.width > 0);
}

function applianceReservations(wall: Round2Wall): ReservedSegment[] {
  const length = wall.lengthSixteenths ?? 0;
  return wall.fixedPoints
    .filter((point) => point.type === "appliance")
    .map((point) => {
      const width = applianceWidth(point);
      return {
        fixedPoint: point,
        desiredStart: Math.round(point.positionRatio * Math.max(0, length - width)),
        width,
        kind: "appliance" as const,
        label: applianceLabel(point),
        cabinetKind: point.symbol === "sink" ? ("sink" as const) : point.symbol === "fridge" || point.symbol === "oven" || point.symbol === "microwave" ? ("tall" as const) : undefined
      };
    });
}

function applianceWidth(point: Round2FixedPoint): number {
  if (point.symbol === "dishwasher") return 24 * 16;
  if (point.symbol === "range") return 30 * 16;
  if (point.symbol === "sink") return 36 * 16;
  if (point.symbol === "fridge") return 36 * 16;
  return 30 * 16;
}

function applianceLabel(point: Round2FixedPoint): string {
  if (point.symbol === "sink") return "SB36";
  if (point.symbol === "dishwasher") return "DW24";
  if (point.symbol === "range") return "RNG30";
  if (point.symbol === "fridge") return "REF36";
  return point.label;
}

function formatWidth(value: number): string {
  return `${Math.round(value / 16)}″`;
}
