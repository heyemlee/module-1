import {
  applyMeasurementsToModel,
  type Round2DecisionItem,
  type Round2FixedPoint,
  type Round2Model,
  type Round2Wall,
  type SegmentTier,
  type WallSegment,
  formatSixteenths
} from "./round2-model";
import { CABINET_STANDARDS } from "./cabinet-standards";
import {
  buildIntentConfirmationDecisions,
  type Round2DesignIntent
} from "./design-intent";

const CABINET_WIDTHS_DESCENDING = [
  ...CABINET_STANDARDS.base.widthsSixteenths
].sort((a, b) => b - a);
const MIN_CABINET_WIDTH_SIXTEENTHS =
  CABINET_STANDARDS.base.widthsSixteenths[0];

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
  measurements: Record<string, number | null> = {},
  intent?: Round2DesignIntent
): Round2Model {
  const measuredModel = applyMeasurementsToModel(model, measurements);
  const decisionItems: Round2DecisionItem[] = [];
  let cabinetNumber = 1;
  let fillerNumber = 1;

  const walls = measuredModel.walls.map((wall) => {
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
          segment.widthSixteenths < CABINET_STANDARDS.filler.minSixteenths
        ) {
          decisionItems.push({
            id: `decision-${segment.id}`,
            objectId: segment.id,
            wallId: wall.id,
            severity: "warning",
            title: `Wall ${wall.label} filler below minimum`,
            body: `${code} is narrower than ${formatSixteenths(CABINET_STANDARDS.filler.minSixteenths)}. Request a design decision or remeasure.`
          });
        }
        return { ...segment, code };
      }
      return segment;
    });

    return { ...wall, segments: numbered };
  });

  const filledModel = {
    ...measuredModel,
    walls,
    decisionItems
  };
  if (!intent) return filledModel;

  return {
    ...filledModel,
    decisionItems: [
      ...decisionItems,
      ...buildIntentConfirmationDecisions(
        filledModel,
        intent,
        measurements
      )
    ]
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

  while (remaining >= MIN_CABINET_WIDTH_SIXTEENTHS) {
    const width =
      CABINET_WIDTHS_DESCENDING.find((candidate) => candidate <= remaining) ??
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
    .flatMap((point) => {
      const standard = applianceStandard(point);
      if (!standard) return [];
      const width = standard.widthSixteenths;
      return [
        {
          fixedPoint: point,
          desiredStart: Math.round(
            point.positionRatio * Math.max(0, length - width)
          ),
          width,
          kind: "appliance" as const,
          label: standard.label,
          cabinetKind:
            point.symbol === "sink"
              ? ("sink" as const)
              : point.symbol === "fridge" ||
                  point.symbol === "oven" ||
                  point.symbol === "microwave"
                ? ("tall" as const)
                : undefined
        }
      ];
    });
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

function formatWidth(value: number): string {
  return `${Math.round(value / 16)}″`;
}
