import type { Wall as Round1Wall } from "@/features/round1/floorplan/plan-geometry";
import type { Round2Model, Round2Wall } from "./round2-model";

export type CornerId = "TL" | "TR" | "BR" | "BL";
export type CornerEnd = "start" | "end";

export type Round2Corner = {
  id: CornerId;
  /** Wall that hosts the corner cabinet (lazy Susan / blind base). */
  primary: Round2Wall;
  /** Wall that yields clearance for the corner cabinet body. */
  secondary: Round2Wall;
  primaryEnd: CornerEnd;
  secondaryEnd: CornerEnd;
  intentKey: string;
  objectId: string;
};

const CORNER_DEFINITIONS: readonly {
  id: CornerId;
  walls: readonly [Round1Wall, Round1Wall];
}[] = [
  { id: "TL", walls: ["TOP", "LEFT"] },
  { id: "TR", walls: ["TOP", "RIGHT"] },
  { id: "BR", walls: ["BOTTOM", "RIGHT"] },
  { id: "BL", walls: ["BOTTOM", "LEFT"] }
];

// Wall runs are measured left-to-right for TOP/BOTTOM and top-to-bottom for
// LEFT/RIGHT, so the corner sits at the run start or end depending on which
// wall it meets.
function cornerEnd(wall: Round1Wall, other: Round1Wall): CornerEnd {
  if (wall === "TOP" || wall === "BOTTOM") {
    return other === "LEFT" ? "start" : "end";
  }
  return other === "TOP" ? "start" : "end";
}

export function deriveCorners(model: Round2Model | null): Round2Corner[] {
  if (!model) return [];
  const wallBySource = new Map(
    model.walls.map((wall) => [wall.sourceWall, wall])
  );
  return CORNER_DEFINITIONS.flatMap((definition) => {
    const primary = wallBySource.get(definition.walls[0]);
    const secondary = wallBySource.get(definition.walls[1]);
    if (!primary || !secondary) return [];
    return [
      {
        id: definition.id,
        primary,
        secondary,
        primaryEnd: cornerEnd(definition.walls[0], definition.walls[1]),
        secondaryEnd: cornerEnd(definition.walls[1], definition.walls[0]),
        intentKey: `corner.${definition.id}.strategy`,
        objectId: `corner-${definition.id.toLowerCase()}`
      }
    ];
  });
}
