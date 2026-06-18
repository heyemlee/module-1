import type {
  ApplianceShape,
  FloorPlan,
  PlanRect,
  Wall
} from "../floorplan/plan-geometry";

export type ElevationItemKind =
  | "baseCabinet"
  | "wallCabinet"
  | "corner"
  | "appliance"
  | "opening";

export type ElevationSymbol =
  | "baseCabinet"
  | "wallCabinet"
  | "corner"
  | "sink"
  | "range"
  | "fridge"
  | "dishwasher"
  | "oven"
  | "hood"
  | "window"
  | "door";

export type ElevationItem = {
  key: string;
  kind: ElevationItemKind;
  symbol: ElevationSymbol;
  label: string;
  wall: Wall;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceCode?: string;
};

export type WallElevationScene = {
  wall: Wall;
  title: string;
  width: number;
  height: number;
  items: ElevationItem[];
  salesEstimateOnly: true;
  notForProduction: true;
  dimensionConfidence: "ROUGH";
};

const WALL_TITLES: Record<Wall, string> = {
  TOP: "Back Wall",
  LEFT: "Left Wall",
  RIGHT: "Right Wall",
  BOTTOM: "Front Wall"
};

const WALL_ORDER: Wall[] = ["TOP", "LEFT", "RIGHT", "BOTTOM"];
const SCENE_WIDTH = 680;
const SCENE_HEIGHT = 230;
const WALL_PADDING_X = 28;
const FLOOR_Y = 202;
const BASE_Y = 136;
const BASE_H = 54;
const WALL_CABINET_Y = 42;
const WALL_CABINET_H = 58;
const TALL_Y = 48;
const TALL_H = 142;
const WINDOW_Y = 70;
const WINDOW_H = 74;
const DOOR_Y = 58;
const DOOR_H = 132;

export const ELEVATION_FLOOR_Y = FLOOR_Y;

export function buildElevationScene(plan: FloorPlan): WallElevationScene[] {
  return WALL_ORDER.map((wall) => buildWallScene(plan, wall)).filter(
    (scene): scene is WallElevationScene => scene !== null
  );
}

function buildWallScene(plan: FloorPlan, wall: Wall): WallElevationScene | null {
  const items: ElevationItem[] = [
    ...baseCabinetItems(plan, wall),
    ...wallCabinetItems(plan, wall),
    ...cornerItems(plan, wall),
    ...applianceItems(plan, wall),
    ...windowItems(plan, wall),
    ...doorItems(plan, wall)
  ];

  if (items.length === 0) return null;

  return {
    wall,
    title: WALL_TITLES[wall],
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    items: items.sort((a, b) => a.x - b.x || a.y - b.y || a.key.localeCompare(b.key)),
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH"
  };
}

function baseCabinetItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.baseCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .map((cabinet, index) => ({
      key: `base-${wall}-${index}`,
      kind: "baseCabinet",
      symbol: "baseCabinet",
      label: "Base cabinet",
      wall,
      ...mapRectToBand(plan, wall, cabinet, BASE_Y, BASE_H),
      sourceCode: cabinet.code
    }));
}

function wallCabinetItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.wallCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .map((cabinet, index) => ({
      key: `wall-${wall}-${index}`,
      kind: "wallCabinet",
      symbol: "wallCabinet",
      label: "Wall cabinet",
      wall,
      ...mapRectToBand(plan, wall, cabinet, WALL_CABINET_Y, WALL_CABINET_H),
      sourceCode: cabinet.code
    }));
}

function cornerItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.wallCorners
    .filter((corner) => cornerTouchesWall(corner.type, wall))
    .map((corner, index) => ({
      key: `corner-${wall}-${index}`,
      kind: "corner",
      symbol: "corner",
      label: "Corner cabinet",
      wall,
      ...mapRectToBand(plan, wall, corner, BASE_Y, BASE_H)
    }));
}

function applianceItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  return plan.appliances
    .filter((appliance) => appliance.wall === wall)
    .map((appliance) => {
      const band = applianceBand(appliance);
      return {
        key: `appliance-${appliance.key}`,
        kind: "appliance",
        symbol: applianceSymbol(appliance),
        label: appliance.label,
        wall,
        ...mapRectToBand(plan, wall, appliance, band.y, band.h)
      };
    });
}

function windowItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  if (plan.window?.wall !== wall) return [];

  return [
    {
      key: `opening-window-${wall}`,
      kind: "opening",
      symbol: "window",
      label: "Window",
      wall,
      ...mapRectToBand(plan, wall, plan.window, WINDOW_Y, WINDOW_H)
    }
  ];
}

function doorItems(plan: FloorPlan, wall: Wall): ElevationItem[] {
  if (plan.door?.wall !== wall) return [];

  return [
    {
      key: `opening-door-${wall}`,
      kind: "opening",
      symbol: "door",
      label: "Door",
      wall,
      ...mapRectToBand(plan, wall, plan.door.breakRect, DOOR_Y, DOOR_H)
    }
  ];
}

function mapRectToBand(
  plan: FloorPlan,
  wall: Wall,
  rect: PlanRect,
  y: number,
  h: number
): Pick<ElevationItem, "x" | "y" | "w" | "h"> {
  const axis = wallAxis(plan, wall);
  const start =
    wall === "LEFT" || wall === "RIGHT"
      ? axis.start + axis.length - (rect.y + rect.h)
      : rect.x;
  const length = wall === "LEFT" || wall === "RIGHT" ? rect.h : rect.w;
  const usable = SCENE_WIDTH - WALL_PADDING_X * 2;
  const x = WALL_PADDING_X + ((start - axis.start) / axis.length) * usable;
  const w = Math.max(14, (length / axis.length) * usable);
  const maxW = SCENE_WIDTH - WALL_PADDING_X - x;

  return {
    x: round(clamp(x, WALL_PADDING_X, SCENE_WIDTH - WALL_PADDING_X - 8)),
    y,
    w: round(Math.max(8, Math.min(w, maxW))),
    h
  };
}

function wallAxis(plan: FloorPlan, wall: Wall): { start: number; length: number } {
  const thickness = plan.room.thickness;
  if (wall === "TOP" || wall === "BOTTOM") {
    return {
      start: plan.room.x + thickness,
      length: plan.room.w - thickness * 2
    };
  }
  return {
    start: plan.room.y + thickness,
    length: plan.room.h - thickness * 2
  };
}

function applianceBand(appliance: ApplianceShape): { y: number; h: number } {
  if (appliance.symbol === "fridge" || appliance.symbol === "oven") {
    return { y: TALL_Y, h: TALL_H };
  }
  if (appliance.symbol === "hood") {
    return { y: 64, h: 44 };
  }
  return { y: BASE_Y, h: BASE_H };
}

function applianceSymbol(appliance: ApplianceShape): ElevationSymbol {
  if (appliance.symbol === "sink") return "sink";
  if (appliance.symbol === "range") return "range";
  if (appliance.symbol === "fridge") return "fridge";
  if (appliance.symbol === "dishwasher") return "dishwasher";
  if (appliance.symbol === "oven") return "oven";
  if (appliance.symbol === "hood") return "hood";
  return "baseCabinet";
}

function cornerTouchesWall(type: "TL" | "TR" | "BL" | "BR", wall: Wall): boolean {
  return (
    (type === "TL" && (wall === "TOP" || wall === "LEFT")) ||
    (type === "TR" && (wall === "TOP" || wall === "RIGHT")) ||
    (type === "BL" && (wall === "BOTTOM" || wall === "LEFT")) ||
    (type === "BR" && (wall === "BOTTOM" || wall === "RIGHT"))
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
