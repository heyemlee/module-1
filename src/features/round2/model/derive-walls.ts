import type {
  ApplianceShape,
  DoorShape,
  FloorPlan,
  MarkerShape,
  PlanRect,
  Wall as Round1Wall,
  WindowShape
} from "@/features/round1/floorplan/plan-geometry";
import {
  type Round2FixedPoint,
  type Round2Model,
  type Round2Wall
} from "./round2-model";

const WALL_ORDER: Round1Wall[] = ["TOP", "RIGHT", "BOTTOM", "LEFT"];

const WALLS_BY_LAYOUT: Record<string, Round1Wall[]> = {
  GALLEY: ["TOP", "BOTTOM"],
  LEFT_L_SHAPE: ["TOP", "LEFT"],
  L_SHAPE: ["TOP", "LEFT"],
  PENINSULA: ["TOP", "LEFT"],
  L_SHAPE_ISLAND: ["TOP", "LEFT"],
  RIGHT_L_SHAPE: ["TOP", "RIGHT"],
  U_SHAPE: ["TOP", "RIGHT", "LEFT"],
  U_SHAPE_ISLAND: ["TOP", "RIGHT", "LEFT"],
  ONE_WALL: ["TOP"],
  ISLAND: ["TOP"],
  NO_PREFERENCE: ["TOP"]
};

/** Real inches → sixteenths for a plan pixel length at the given scale. */
function pxToSixteenths(px: number, pxPerInch: number): number {
  return Math.max(0, Math.round((px / pxPerInch) * 16));
}

/**
 * Preset overall length for a wall, recovered from the room rectangle so Round 2
 * field measurement opens pre-filled with the Round 1 layout dimension instead
 * of a blank field. Null when the plan carries no real scale.
 */
function wallLengthSixteenths(
  floorPlan: FloorPlan,
  wall: Round1Wall
): number | null {
  const pxPerInch = floorPlan.pxPerInch;
  if (pxPerInch == null) return null;
  const along =
    wall === "TOP" || wall === "BOTTOM" ? floorPlan.room.w : floorPlan.room.h;
  return pxToSixteenths(along, pxPerInch);
}

export function deriveWallsFromRound1(floorPlan: FloorPlan): Round2Model {
  const occupiedWalls = new Set<Round1Wall>();
  for (const cabinet of [
    ...floorPlan.baseCabinets,
    ...floorPlan.wallCabinets
  ]) {
    occupiedWalls.add(cabinet.wall);
  }

  if (occupiedWalls.size === 0) {
    for (const wall of wallsForLayout(floorPlan.layoutPreference)) {
      occupiedWalls.add(wall);
    }
  } else {
    for (const wall of wallsForLayout(floorPlan.layoutPreference)) {
      occupiedWalls.add(wall);
    }
  }

  const ordered = WALL_ORDER.filter((wall) => occupiedWalls.has(wall));
  const walls: Round2Wall[] = ordered.map((sourceWall, index) => ({
    id: String.fromCharCode(65 + index),
    label: String.fromCharCode(65 + index),
    sourceWall,
    lengthSixteenths: wallLengthSixteenths(floorPlan, sourceWall),
    fixedPoints: fixedPointsForWall(floorPlan, sourceWall),
    segments: [],
    notes: notesForWall(floorPlan, sourceWall)
  }));

  return {
    walls,
    ceilingHeightSixteenths: floorPlan.ceilingHeightSixteenths ?? null,
    decisionItems: []
  };
}

function wallsForLayout(layoutPreference: string): Round1Wall[] {
  return WALLS_BY_LAYOUT[layoutPreference] ?? WALLS_BY_LAYOUT.NO_PREFERENCE;
}

function fixedPointsForWall(
  floorPlan: FloorPlan,
  wall: Round1Wall
): Round2FixedPoint[] {
  const points: Round2FixedPoint[] = [];

  if (floorPlan.window?.wall === wall) {
    points.push(openingPoint(floorPlan, floorPlan.window, wall, "window"));
  }

  if (floorPlan.door?.wall === wall) {
    points.push(doorPoint(floorPlan, floorPlan.door, wall));
  }

  for (const appliance of floorPlan.appliances.filter(
    (item) => item.wall === wall && !item.onIsland && !item.onPeninsula
  )) {
    points.push({
      id: `${wall.toLowerCase()}-appliance-${appliance.key}`,
      type: "appliance",
      label: appliance.label,
      sourceWall: wall,
      order: orderRectAlongWall(appliance, wall, floorPlan),
      positionRatio: orderRectAlongWall(appliance, wall, floorPlan),
      symbol: appliance.symbol
    });
  }

  floorPlan.markers.forEach((marker, index) => {
    const markerWall = inferMarkerWall(marker, floorPlan);
    if (markerWall !== wall) return;
    const order = orderPointAlongWall(marker.cx, marker.cy, wall, floorPlan);
    points.push({
      id: `${wall.toLowerCase()}-marker-${index}`,
      type: "marker",
      label: `${marker.letter} marker`,
      sourceWall: wall,
      order,
      positionRatio: order,
      symbol: marker.letter
    });
  });

  return points.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function openingPoint(
  floorPlan: FloorPlan,
  shape: WindowShape,
  wall: Round1Wall,
  id: "window"
): Round2FixedPoint {
  const order = orderRectAlongWall(shape, wall, floorPlan);
  return {
    id: `${wall.toLowerCase()}-${id}`,
    type: id,
    label: "Window",
    sourceWall: wall,
    order,
    positionRatio: order,
    ...openingPresets(floorPlan, shape, wall)
  };
}

function doorPoint(
  floorPlan: FloorPlan,
  shape: DoorShape,
  wall: Round1Wall
): Round2FixedPoint {
  const order = orderPointAlongWall(shape.cx, shape.cy, wall, floorPlan);
  return {
    id: `${wall.toLowerCase()}-door`,
    type: "door",
    label: shape.kind === "OPEN_PASSAGE" ? "Opening" : "Door",
    sourceWall: wall,
    order,
    positionRatio: order,
    ...openingPresets(floorPlan, shape.breakRect, wall)
  };
}

/**
 * Recovers an opening's preset width and start offset (from the wall start, in
 * the same left→right / top→bottom frame as {@link orderPointAlongWall}) from
 * its plan rectangle, so field measurement opens pre-filled. Empty when the
 * plan has no real scale.
 */
function openingPresets(
  floorPlan: FloorPlan,
  rect: PlanRect,
  wall: Round1Wall
): { widthSixteenths: number; offsetSixteenths: number } | Record<string, never> {
  const pxPerInch = floorPlan.pxPerInch;
  if (pxPerInch == null) return {};
  const horizontal = wall === "TOP" || wall === "BOTTOM";
  const widthPx = horizontal ? rect.w : rect.h;
  const offsetPx = horizontal
    ? rect.x - floorPlan.room.x
    : rect.y - floorPlan.room.y;
  return {
    widthSixteenths: pxToSixteenths(widthPx, pxPerInch),
    offsetSixteenths: pxToSixteenths(offsetPx, pxPerInch)
  };
}

function notesForWall(floorPlan: FloorPlan, wall: Round1Wall): string[] {
  const notes: string[] = [];
  if (floorPlan.island && wall === "TOP") {
    notes.push("Round 1 island intent deferred to Round 2 decision item.");
  }
  if (floorPlan.peninsula && wall === "TOP") {
    notes.push("Round 1 peninsula intent deferred to Round 2 decision item.");
  }
  return notes;
}

function orderRectAlongWall(
  rect: PlanRect,
  wall: Round1Wall,
  floorPlan: FloorPlan
): number {
  return orderPointAlongWall(
    rect.x + rect.w / 2,
    rect.y + rect.h / 2,
    wall,
    floorPlan
  );
}

function orderPointAlongWall(
  x: number,
  y: number,
  wall: Round1Wall,
  floorPlan: FloorPlan
): number {
  const room = floorPlan.room;
  if (wall === "TOP" || wall === "BOTTOM") {
    return clamp01((x - room.x) / room.w);
  }
  return clamp01((y - room.y) / room.h);
}

function inferMarkerWall(marker: MarkerShape, floorPlan: FloorPlan): Round1Wall {
  const room = floorPlan.room;
  const distances: Record<Round1Wall, number> = {
    TOP: Math.abs(marker.cy - room.y),
    RIGHT: Math.abs(marker.cx - (room.x + room.w)),
    BOTTOM: Math.abs(marker.cy - (room.y + room.h)),
    LEFT: Math.abs(marker.cx - room.x)
  };
  return WALL_ORDER.reduce((best, wall) =>
    distances[wall] < distances[best] ? wall : best
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
