import { memo } from "react";
import type { FloorPlan, PlanRect } from "./floorplan/plan-geometry";
import { CABINET_FILL } from "./floorplan/palette";

type CameraMode =
  | "CENTERED_FRONT"
  | "FRONT_RIGHT"
  | "FRONT_LEFT"
  | "OPEN_END"
  | "PENINSULA"
  | "ISLAND";

function getCameraMode(layout: string): CameraMode {
  switch (layout) {
    case "ONE_WALL":
      return "CENTERED_FRONT";
    case "LEFT_L_SHAPE":
      return "FRONT_RIGHT";
    case "RIGHT_L_SHAPE":
      return "FRONT_LEFT";
    case "U_SHAPE":
    case "GALLEY":
      return "OPEN_END";
    case "PENINSULA":
      return "PENINSULA";
    case "ISLAND":
    case "L_SHAPE_ISLAND":
    case "U_SHAPE_ISLAND":
    default:
      return "ISLAND";
  }
}

type Point3D = { x: number; y: number; z: number };
type Point2D = { x: number; y: number };

// 3D Block representation
type Block = {
  id: string;
  rect: PlanRect;
  zBase: number;
  zHeight: number;
  color: string;
  stroke: string;
  type: string;
};

// Project 3D to 2D
function project(
  pt: Point3D,
  angleRad: number,
  pitchRad: number,
  scale: number,
  cx: number,
  cy: number
): Point2D {
  // Translate relative to center
  const dx = pt.x - cx;
  const dy = pt.y - cy;

  // Rotate around Z axis (yaw)
  const rx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
  const ry = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

  // Pitch (tilt camera down)
  const px = rx;
  const py = ry * Math.cos(pitchRad) - pt.z * Math.sin(pitchRad);

  return {
    x: px * scale,
    y: py * scale
  };
}

function PerspectivePreviewImpl({
  plan,
  svgRef
}: {
  plan: FloorPlan;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const mode = getCameraMode(plan.layoutPreference);
  
  // Base configuration
  const cx = plan.room.x + plan.room.w / 2;
  const cy = plan.room.y + plan.room.h / 2;
  
  let angle = 0; // default look at top wall
  let pitch = Math.PI / 4; // 45 degrees down
  
  if (mode === "FRONT_RIGHT") angle = -Math.PI / 6;
  if (mode === "FRONT_LEFT") angle = Math.PI / 6;
  if (mode === "PENINSULA" && plan.peninsula) {
    // If peninsula is on left wall, camera on right, aimed at anchor (left wall)
    const onLeft = plan.peninsula.x < cx;
    angle = onLeft ? -Math.PI / 5 : Math.PI / 5;
  }
  
  const blocks: Block[] = [];
  
  // Floor
  blocks.push({
    id: "floor",
    rect: { x: plan.room.x, y: plan.room.y, w: plan.room.w, h: plan.room.h },
    zBase: 0,
    zHeight: 0,
    color: "#f8f8f8",
    stroke: "#dddddd",
    type: "floor"
  });

  // Base cabinets (approx 36" high)
  plan.baseCabinets.forEach((cab, i) => {
    blocks.push({
      id: `base-${i}`,
      rect: { x: cab.x, y: cab.y, w: cab.w, h: cab.h },
      zBase: 0,
      zHeight: 36,
      color: "#ffffff",
      stroke: "#1a1a1c",
      type: "base"
    });
  });

  // Wall cabinets (approx 54" from floor, 36" high)
  plan.wallCabinets.forEach((cab, i) => {
    blocks.push({
      id: `wall-${i}`,
      rect: { x: cab.x, y: cab.y, w: cab.w, h: cab.h },
      zBase: 54,
      zHeight: 36,
      color: "#f0f0f0",
      stroke: "#000000",
      type: "wall"
    });
  });

  if (plan.island) {
    blocks.push({
      id: "island",
      rect: plan.island,
      zBase: 0,
      zHeight: 36,
      color: CABINET_FILL,
      stroke: "#1a1a1c",
      type: "island"
    });
  }

  if (plan.peninsula) {
    // Peninsula base cabinets
    plan.peninsulaCabinets.forEach((cab, i) => {
      blocks.push({
        id: `peninsula-base-${i}`,
        rect: { x: cab.x, y: cab.y, w: cab.w, h: cab.h },
        zBase: 0,
        zHeight: 36,
        color: "#ffffff",
        stroke: "#1a1a1c",
        type: "peninsula"
      });
    });
  }
  
  // Sort blocks by depth (Y in rotated space)
  blocks.sort((a, b) => {
    // calculate center of blocks
    const acx = a.rect.x + a.rect.w / 2 - cx;
    const acy = a.rect.y + a.rect.h / 2 - cy;
    const adepth = acx * Math.sin(angle) + acy * Math.cos(angle);
    
    const bcx = b.rect.x + b.rect.w / 2 - cx;
    const bcy = b.rect.y + b.rect.h / 2 - cy;
    const bdepth = bcx * Math.sin(angle) + bcy * Math.cos(angle);
    
    if (Math.abs(adepth - bdepth) < 1) {
      return a.zBase - b.zBase;
    }
    return adepth - bdepth; // smaller depth = further away
  });

  const scale = 2.5;
  const canvasW = 1024;
  const canvasH = 1024;
  const offsetX = canvasW / 2;
  const offsetY = canvasH / 2 + 100; // Shift down to fit walls

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      className="bg-white"
      style={{ display: "none" }} // Hidden structural reference
      aria-hidden="true"
    >
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        {blocks.map((block) => {
          const { x, y, w, h } = block.rect;
          const z0 = block.zBase;
          const z1 = block.zBase + block.zHeight;

          // Points of the base rect
          const p1 = project({ x, y, z: z0 }, angle, pitch, scale, cx, cy);
          const p2 = project({ x: x + w, y, z: z0 }, angle, pitch, scale, cx, cy);
          const p3 = project({ x: x + w, y: y + h, z: z0 }, angle, pitch, scale, cx, cy);
          const p4 = project({ x, y: y + h, z: z0 }, angle, pitch, scale, cx, cy);

          // Points of the top rect
          const t1 = project({ x, y, z: z1 }, angle, pitch, scale, cx, cy);
          const t2 = project({ x: x + w, y, z: z1 }, angle, pitch, scale, cx, cy);
          const t3 = project({ x: x + w, y: y + h, z: z1 }, angle, pitch, scale, cx, cy);
          const t4 = project({ x, y: y + h, z: z1 }, angle, pitch, scale, cx, cy);

          return (
            <g key={block.id}>
              {/* Top face */}
              {block.zHeight > 0 && (
                <polygon
                  points={`${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y} ${t4.x},${t4.y}`}
                  fill={block.color}
                  stroke={block.stroke}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              )}
              {/* Front face (approximate) */}
              {block.zHeight > 0 && (
                <polygon
                  points={`${p3.x},${p3.y} ${p4.x},${p4.y} ${t4.x},${t4.y} ${t3.x},${t3.y}`}
                  fill={block.color}
                  stroke={block.stroke}
                  strokeWidth="1"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              )}
              {/* Side face (approximate) */}
              {block.zHeight > 0 && (
                <polygon
                  points={`${p2.x},${p2.y} ${p3.x},${p3.y} ${t3.x},${t3.y} ${t2.x},${t2.y}`}
                  fill={block.color}
                  stroke={block.stroke}
                  strokeWidth="1"
                  strokeLinejoin="round"
                  opacity={0.8}
                />
              )}
              {/* Floor */}
              {block.zHeight === 0 && (
                <polygon
                  points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                  fill={block.color}
                  stroke={block.stroke}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export const PerspectivePreview = memo(PerspectivePreviewImpl);
