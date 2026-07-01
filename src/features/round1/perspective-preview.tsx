import { memo } from "react";
import type { FloorPlan, PlanRect, Wall } from "./floorplan/plan-geometry";
import { CABINET_FILL } from "./floorplan/palette";

/**
 * Structural massing reference (Reference 1) for the concept rendering.
 *
 * gpt-image copies the silhouette of a reference far more faithfully than it
 * follows text, so this view carries the things text is weak at: the camera,
 * which wall is which, the room envelope (back + side walls with the window
 * cut in and the door as an opening), and the base/wall/island/peninsula
 * massing. Positions come entirely from the deterministic `FloorPlan` (the same
 * rects the top-down plan uses) — nothing here is independently guessed.
 *
 * The projection auto-fits every layout into the frame, so no per-layout magic
 * offsets are needed. The camera yaw per layout is chosen so the open side
 * faces the viewer and every required run is visible; GALLEY looks down the
 * aisle (matching the camera convention in `spatial-language.ts`).
 */

type Pt3 = { x: number; y: number; z: number };
type Projected = { x: number; y: number; depth: number };
type Face = { pts: Pt3[]; fill: string; stroke: string; opacity?: number };

// Heights in inches (rough residential proportions; only relative scale matters).
const CEIL = 84;
const BASE_H = 36;
const COUNTER_Z = 36;
const COUNTER_H = 1.6;
const WALL_CAB_Z = 54;
const WALL_CAB_H = 30;
const WINDOW_Z0 = 36;
const WINDOW_Z1 = 78;
const DOOR_H = 84;

const WALL_FILL = "#ededeb";
const WALL_STROKE = "#cbcbc7";
const COUNTER_FILL = "#e7e7e4";
const COUNTER_STROKE = "#b7b7b2";
const DEG = Math.PI / 180;

function camera(layout: string): { yaw: number; pitch: number } {
  const pitch = 30 * DEG;
  switch (layout) {
    case "ONE_WALL":
      return { yaw: 0, pitch };
    case "RIGHT_L_SHAPE":
      return { yaw: 28 * DEG, pitch };
    case "LEFT_L_SHAPE":
    case "L_SHAPE":
    case "L_SHAPE_ISLAND":
    case "PENINSULA":
      return { yaw: -28 * DEG, pitch };
    case "GALLEY":
      // Look down the aisle from the LEFT open end (+x into the scene). This
      // makes TOP->left, BOTTOM->right, LEFT->front, RIGHT->back, matching the
      // wall remap in spatial-language.ts.
      return { yaw: -75 * DEG, pitch };
    case "U_SHAPE":
    case "U_SHAPE_ISLAND":
    case "ISLAND":
    default:
      return { yaw: -20 * DEG, pitch };
  }
}

function PerspectivePreviewImpl({
  plan,
  svgRef,
  hidden = true
}: {
  plan: FloorPlan;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  // Hidden by default: the primary use is an off-screen machine reference. Pass
  // `hidden={false}` to show it in the UI (e.g. next to the elevation strip).
  hidden?: boolean;
}) {
  const layout = plan.layoutPreference;
  const isGalley = layout === "GALLEY";
  const { yaw, pitch } = camera(layout);

  const t = plan.room.thickness ?? 0;
  const ix = plan.room.x + t;
  const iy = plan.room.y + t;
  const iw = plan.room.w - t * 2;
  const ih = plan.room.h - t * 2;
  const cx = ix + iw / 2;
  const cy = iy + ih / 2;

  const faces: Face[] = [];
  const corner = (x: number, y: number, z: number): Pt3 => ({ x, y, z });

  // Floor.
  faces.push({
    pts: [
      corner(ix, iy, 0),
      corner(ix + iw, iy, 0),
      corner(ix + iw, iy + ih, 0),
      corner(ix, iy + ih, 0)
    ],
    fill: "#f5f5f3",
    stroke: "#e0e0de"
  });

  // Envelope walls. Skip the wall nearest the camera (it would occlude): the
  // front (BOTTOM) wall for most layouts, the LEFT wall for the galley camera.
  const wallQuad = (x0: number, y0: number, x1: number, y1: number): Pt3[] => [
    corner(x0, y0, 0),
    corner(x1, y1, 0),
    corner(x1, y1, CEIL),
    corner(x0, y0, CEIL)
  ];
  const drawnWalls = new Set<Wall>(
    isGalley ? ["TOP", "BOTTOM", "RIGHT"] : ["TOP", "LEFT", "RIGHT"]
  );
  if (drawnWalls.has("TOP"))
    faces.push({ pts: wallQuad(ix, iy, ix + iw, iy), fill: WALL_FILL, stroke: WALL_STROKE, opacity: 0.96 });
  if (drawnWalls.has("BOTTOM"))
    faces.push({ pts: wallQuad(ix, iy + ih, ix + iw, iy + ih), fill: WALL_FILL, stroke: WALL_STROKE, opacity: 0.96 });
  if (drawnWalls.has("LEFT"))
    faces.push({ pts: wallQuad(ix, iy, ix, iy + ih), fill: WALL_FILL, stroke: WALL_STROKE, opacity: 0.96 });
  if (drawnWalls.has("RIGHT"))
    faces.push({ pts: wallQuad(ix + iw, iy, ix + iw, iy + ih), fill: WALL_FILL, stroke: WALL_STROKE, opacity: 0.96 });

  // A window cut into its wall (dark glass rectangle) and the door as a
  // floor-standing opening, inset slightly into the room so they paint over the
  // wall plane instead of z-fighting it. Only drawn on walls the camera sees.
  const openingQuad = (wall: Wall, r: PlanRect, z0: number, z1: number): Pt3[] | null => {
    if (!drawnWalls.has(wall)) return null;
    const IN = 1.4;
    if (wall === "TOP")
      return [corner(r.x, iy + IN, z0), corner(r.x + r.w, iy + IN, z0), corner(r.x + r.w, iy + IN, z1), corner(r.x, iy + IN, z1)];
    if (wall === "BOTTOM")
      return [corner(r.x, iy + ih - IN, z0), corner(r.x + r.w, iy + ih - IN, z0), corner(r.x + r.w, iy + ih - IN, z1), corner(r.x, iy + ih - IN, z1)];
    if (wall === "LEFT")
      return [corner(ix + IN, r.y, z0), corner(ix + IN, r.y + r.h, z0), corner(ix + IN, r.y + r.h, z1), corner(ix + IN, r.y, z1)];
    return [corner(ix + iw - IN, r.y, z0), corner(ix + iw - IN, r.y + r.h, z0), corner(ix + iw - IN, r.y + r.h, z1), corner(ix + iw - IN, r.y, z1)];
  };
  if (plan.window) {
    const q = openingQuad(plan.window.wall, plan.window, WINDOW_Z0, WINDOW_Z1);
    if (q) faces.push({ pts: q, fill: "#bcd4e9", stroke: "#6f889d" });
  }
  if (plan.door) {
    const q = openingQuad(plan.door.wall, plan.door.breakRect, 0, DOOR_H);
    if (q) faces.push({ pts: q, fill: "#ded7cc", stroke: "#9c9689" });
  }

  // Extruded boxes (top + 4 side faces). Painter's sort handles occlusion.
  const addBox = (r: PlanRect, z0: number, z1: number, fill: string, stroke: string) => {
    const x0 = r.x;
    const y0 = r.y;
    const x1 = r.x + r.w;
    const y1 = r.y + r.h;
    faces.push({ pts: [corner(x0, y0, z1), corner(x1, y0, z1), corner(x1, y1, z1), corner(x0, y1, z1)], fill, stroke });
    faces.push({ pts: [corner(x0, y0, z0), corner(x1, y0, z0), corner(x1, y0, z1), corner(x0, y0, z1)], fill, stroke, opacity: 0.9 });
    faces.push({ pts: [corner(x0, y1, z0), corner(x1, y1, z0), corner(x1, y1, z1), corner(x0, y1, z1)], fill, stroke, opacity: 0.9 });
    faces.push({ pts: [corner(x0, y0, z0), corner(x0, y1, z0), corner(x0, y1, z1), corner(x0, y0, z1)], fill, stroke, opacity: 0.82 });
    faces.push({ pts: [corner(x1, y0, z0), corner(x1, y1, z0), corner(x1, y1, z1), corner(x1, y0, z1)], fill, stroke, opacity: 0.82 });
  };
  // Countertops overhang their base by enough that adjacent runs (notably the
  // left-wall run and the peninsula meeting at their corner) merge into one
  // continuous slab, so the peninsula reads as fused, not freestanding.
  // ponytail: fixed 4-unit overhang; widen if a plan leaves a bigger corner gap.
  const overhang = (r: PlanRect): PlanRect => ({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 });

  plan.baseCabinets.forEach((c) => addBox(c, 0, BASE_H, "#ffffff", "#23232a"));
  plan.peninsulaCabinets.forEach((c) => addBox(c, 0, BASE_H, "#ffffff", "#23232a"));
  // Continuous countertop over every base run + the peninsula: a single stone
  // band that makes the peninsula read as fused to the left-wall run (shared
  // 90-degree corner), not a freestanding island.
  plan.baseCabinets.forEach((c) => addBox(overhang(c), COUNTER_Z, COUNTER_Z + COUNTER_H, COUNTER_FILL, COUNTER_STROKE));
  plan.peninsulaCabinets.forEach((c) => addBox(overhang(c), COUNTER_Z, COUNTER_Z + COUNTER_H, COUNTER_FILL, COUNTER_STROKE));
  if (plan.peninsula) addBox(overhang(plan.peninsula), COUNTER_Z, COUNTER_Z + COUNTER_H, COUNTER_FILL, COUNTER_STROKE);
  if (plan.island) {
    addBox(plan.island, 0, BASE_H, CABINET_FILL, "#23232a");
    addBox(overhang(plan.island), COUNTER_Z, COUNTER_Z + COUNTER_H, COUNTER_FILL, COUNTER_STROKE);
  }
  plan.wallCabinets.forEach((c) => addBox(c, WALL_CAB_Z, WALL_CAB_Z + WALL_CAB_H, "#f1f1ef", "#3a3a40"));

  // Project (unscaled), then auto-fit the bounding box into the square canvas.
  const project = (p: Pt3): Projected => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const rx = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    const ry = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    return { x: rx, y: ry * Math.cos(pitch) - p.z * Math.sin(pitch), depth: ry };
  };
  const projected = faces.map((f) => ({ ...f, p: f.pts.map(project) }));

  const xs = projected.flatMap((f) => f.p.map((p) => p.x));
  const ys = projected.flatMap((f) => f.p.map((p) => p.y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const CANVAS = 1024;
  const MARGIN = 0.9;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = (Math.min(CANVAS / spanX, CANVAS / spanY) * MARGIN) || 1;
  const tx = CANVAS / 2 - ((minX + maxX) / 2) * scale;
  const ty = CANVAS / 2 - ((minY + maxY) / 2) * scale;
  const toScreen = (p: Projected) => `${(p.x * scale + tx).toFixed(1)},${(p.y * scale + ty).toFixed(1)}`;

  // Painter's algorithm: far (small depth) first, near last.
  const ordered = projected
    .map((f) => ({ f, depth: f.p.reduce((s, p) => s + p.depth, 0) / f.p.length }))
    .sort((a, b) => a.depth - b.depth);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      className="h-full w-full bg-white"
      style={hidden ? { display: "none" } : undefined}
      aria-hidden={hidden || undefined}
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : "Kitchen perspective structure reference"}
    >
      {ordered.map(({ f }, i) => (
        <polygon
          key={i}
          points={f.p.map(toScreen).join(" ")}
          fill={f.fill}
          stroke={f.stroke}
          strokeWidth={1.5}
          strokeLinejoin="round"
          opacity={f.opacity ?? 1}
        />
      ))}
    </svg>
  );
}

export const PerspectivePreview = memo(PerspectivePreviewImpl);
