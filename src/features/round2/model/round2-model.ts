import type { Wall as Round1Wall } from "@/features/round1/floorplan/plan-geometry";

export type WallId = string;
export type MeasurementKey = string;

export type SegmentTier = "upper" | "base" | "full";

export type CabinetKind = "base" | "upper" | "sink" | "tall" | "corner";

export type WallSegmentKind =
  | "cabinet"
  | "filler"
  | "appliance"
  | "opening"
  | "gap";

export type Round2FixedPointType =
  | "window"
  | "door"
  | "marker"
  | "appliance"
  | "note";

export type Round2FixedPoint = {
  id: string;
  type: Round2FixedPointType;
  label: string;
  sourceWall: Round1Wall;
  order: number;
  positionRatio: number;
  symbol?: string;
  widthSixteenths?: number | null;
  offsetSixteenths?: number | null;
};

export type FrontAccessory = "trashPullout" | "spicePullout" | "lazySusan";

/**
 * Cabinet front configuration. Only exceptions a designer made are stored;
 * defaults derive from the door rule and design intent (see model/front.ts).
 */
export type WallSegmentFront = {
  doorCount?: 0 | 1 | 2;
  /** Relative drawer heights, top to bottom. Empty means no drawer stack. */
  drawerStack?: number[];
  hardware?: "handle" | "fingerPull";
  accessories?: FrontAccessory[];
};

export type WallSegment = {
  id: string;
  wallId: WallId;
  tier: SegmentTier;
  kind: WallSegmentKind;
  widthSixteenths: number;
  label: string;
  code?: string;
  cabinetKind?: CabinetKind;
  standardWidthSixteenths?: number;
  sourceFixedPointId?: string;
  sourceCornerId?: string;
  front?: WallSegmentFront;
};

export type Round2Wall = {
  id: WallId;
  label: string;
  sourceWall: Round1Wall;
  lengthSixteenths: number | null;
  fixedPoints: Round2FixedPoint[];
  segments: WallSegment[];
  notes: string[];
};

export type Round2DecisionItem = {
  id: string;
  objectId: string;
  wallId: WallId;
  severity: "warning" | "blocking";
  title: string;
  body: string;
};

export type Round2HeightProfile = {
  counterSixteenths: number;
  backsplashSixteenths: number;
  upperHeightSixteenths: number;
  mouldingSixteenths: number;
};

export type Round2Model = {
  walls: Round2Wall[];
  ceilingHeightSixteenths: number | null;
  heightProfile?: Round2HeightProfile | null;
  decisionItems: Round2DecisionItem[];
};

export type MeasurementFieldKind =
  | "ceiling"
  | "wall-length"
  | "opening-width"
  | "opening-offset";

export type MeasurementField = {
  key: MeasurementKey;
  kind: MeasurementFieldKind;
  label: string;
  group: string;
  helper: string;
  wallId?: WallId;
  fixedPointId?: string;
  required: boolean;
};

const FRACTION_BY_NUMERATOR: Record<number, string> = {
  1: "1/16",
  2: "1/8",
  3: "3/16",
  4: "1/4",
  5: "5/16",
  6: "3/8",
  7: "7/16",
  8: "1/2",
  9: "9/16",
  10: "5/8",
  11: "11/16",
  12: "3/4",
  13: "13/16",
  14: "7/8",
  15: "15/16"
};

export function formatSixteenths(value: number | null | undefined): string {
  if (value == null) return "待量";

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const inches = Math.floor(absolute / 16);
  const numerator = absolute % 16;
  const fraction = numerator === 0 ? "" : FRACTION_BY_NUMERATOR[numerator];

  if (inches === 0 && fraction) return `${sign}${fraction}″`;
  if (fraction) return `${sign}${inches} ${fraction}″`;
  return `${sign}${inches}″`;
}

export function ceilingMeasurementKey(): MeasurementKey {
  return "room.ceiling";
}

export function wallLengthMeasurementKey(wallId: WallId): MeasurementKey {
  return `wall.${wallId}.length`;
}

export function openingWidthMeasurementKey(
  fixedPointId: string
): MeasurementKey {
  return `opening.${fixedPointId}.width`;
}

export function openingOffsetMeasurementKey(
  fixedPointId: string
): MeasurementKey {
  return `opening.${fixedPointId}.offset`;
}

export function buildMeasurementFields(
  model: Round2Model | null
): MeasurementField[] {
  if (!model) return [];

  const fields: MeasurementField[] = [
    {
      key: ceilingMeasurementKey(),
      kind: "ceiling",
      label: "Finished ceiling height",
      group: "ROOM",
      helper: "Floor to ceiling",
      required: true
    }
  ];

  for (const wall of model.walls) {
    fields.push({
      key: wallLengthMeasurementKey(wall.id),
      kind: "wall-length",
      label: `Wall ${wall.label} overall length`,
      group: `WALL ${wall.label}`,
      helper: sourceWallLabel(wall.sourceWall),
      wallId: wall.id,
      required: true
    });
  }

  for (const wall of model.walls) {
    for (const fixedPoint of wall.fixedPoints) {
      if (fixedPoint.type !== "window" && fixedPoint.type !== "door") {
        continue;
      }
      fields.push({
        key: openingWidthMeasurementKey(fixedPoint.id),
        kind: "opening-width",
        label: `${fixedPoint.label} width`,
        group: "OPENINGS",
        helper: `Wall ${wall.label} rough opening`,
        wallId: wall.id,
        fixedPointId: fixedPoint.id,
        required: true
      });
      fields.push({
        key: openingOffsetMeasurementKey(fixedPoint.id),
        kind: "opening-offset",
        label: `${fixedPoint.label} offset`,
        group: "OPENINGS",
        helper: `From Wall ${wall.label} start`,
        wallId: wall.id,
        fixedPointId: fixedPoint.id,
        required: true
      });
    }
  }

  return fields;
}

export function initializeMeasurements(
  model: Round2Model
): Record<MeasurementKey, number | null> {
  return Object.fromEntries(
    buildMeasurementFields(model).map((field) => [field.key, null])
  );
}

export function requiredMeasurementKeys(model: Round2Model | null): string[] {
  return buildMeasurementFields(model)
    .filter((field) => field.required)
    .map((field) => field.key);
}

export function measurementsComplete(
  model: Round2Model | null,
  measurements: Record<MeasurementKey, number | null>
): boolean {
  const required = requiredMeasurementKeys(model);
  return (
    required.length > 0 &&
    required.every((key) => {
      const value = measurements[key];
      return typeof value === "number" && Number.isFinite(value) && value >= 0;
    })
  );
}

export function applyMeasurementsToModel(
  model: Round2Model,
  measurements: Record<MeasurementKey, number | null>
): Round2Model {
  return {
    ...model,
    ceilingHeightSixteenths: measurementValue(
      measurements,
      ceilingMeasurementKey(),
      model.ceilingHeightSixteenths
    ),
    walls: model.walls.map((wall) => ({
      ...wall,
      lengthSixteenths: measurementValue(
        measurements,
        wallLengthMeasurementKey(wall.id),
        wall.lengthSixteenths
      ),
      fixedPoints: wall.fixedPoints.map((fixedPoint) => {
        if (fixedPoint.type !== "window" && fixedPoint.type !== "door") {
          return fixedPoint;
        }
        return {
          ...fixedPoint,
          widthSixteenths: measurementValue(
            measurements,
            openingWidthMeasurementKey(fixedPoint.id),
            fixedPoint.widthSixteenths ?? null
          ),
          offsetSixteenths: measurementValue(
            measurements,
            openingOffsetMeasurementKey(fixedPoint.id),
            fixedPoint.offsetSixteenths ?? null
          )
        };
      })
    }))
  };
}

function measurementValue(
  measurements: Record<MeasurementKey, number | null>,
  key: MeasurementKey,
  fallback: number | null
): number | null {
  return Object.prototype.hasOwnProperty.call(measurements, key)
    ? measurements[key]
    : fallback;
}

export function findWall(
  model: Round2Model | null,
  wallId: WallId | null
): Round2Wall | null {
  if (!model || !wallId) return null;
  return model.walls.find((wall) => wall.id === wallId) ?? null;
}

export function findSegment(
  model: Round2Model | null,
  segmentId: string | null
): WallSegment | null {
  if (!model || !segmentId) return null;
  for (const wall of model.walls) {
    const segment = wall.segments.find((item) => item.id === segmentId);
    if (segment) return segment;
  }
  return null;
}

export function sourceWallLabel(sourceWall: Round1Wall): string {
  if (sourceWall === "TOP") return "Back wall";
  if (sourceWall === "RIGHT") return "Right wall";
  if (sourceWall === "BOTTOM") return "Front wall";
  return "Left wall";
}
