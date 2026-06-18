# Round 1 Rough Elevations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build visible deterministic Round 1 rough wall elevations below the top-down plan and include the elevation SVG as an additional AI rendering reference image.

**Architecture:** Add a pure elevation scene builder from `FloorPlan`, a stateless React SVG renderer, and a small client-side rasterization helper for multiple SVG references. The existing snapshot remains the only source of geometry, the existing rendering API shape stays unchanged, and rough elevations remain non-editable and not-for-production.

**Tech Stack:** Next.js App Router, React, TypeScript, SVG, Tailwind CSS, Vitest, existing Round 1 domain and floor-plan geometry.

---

## File Structure

- Create `src/features/round1/elevations/elevation-scene.ts`
  - Pure deterministic mapper from `FloorPlan` to rough wall elevation scene data.
  - No React, no DOM, no AI, no persistence.

- Create `src/features/round1/elevations/elevation-scene.test.ts`
  - Unit tests for wall mapping, omitted empty walls, object placement, and Round 1 safety flags.

- Create `src/features/round1/elevations/elevation-preview.tsx`
  - Stateless SVG renderer for all occupied wall elevation scenes in one rasterizable SVG.

- Create `src/features/round1/elevations/elevation-preview.test.tsx`
  - Static markup tests for labels, blue openings, not-for-production stamp, and absence of production details.

- Create `src/features/round1/rendering-references.ts`
  - Browser-side helper to rasterize available SVG references while gracefully falling back if the elevation ref is missing.

- Create `src/features/round1/rendering-references.test.ts`
  - Unit tests for top-down-only fallback and top-down-plus-elevation reference arrays.

- Modify `src/features/round1/showroom-intake-app.tsx`
  - Import `ElevationPreview`.
  - Import `rasterizeRenderingReferences`.
  - Add `referenceElevationRef`.
  - Show `ElevationPreview` below `LayoutPreview` only after `snapshot` exists.
  - Render a hidden `ElevationPreview` tied to `snapshot.floorPlan` for AI rasterization.
  - Send both rasterized references when both refs exist.

- Modify `src/features/round1/showroom-intake-app.test.tsx`
  - Assert the initial app render still hides rough elevations before cabinet fill.

- Modify `ai_ctx.md`
  - Add a short Done entry after implementation and verification.
  - Preserve any existing user edits already present in the file.

---

### Task 1: Pure Elevation Scene Builder

**Files:**
- Create: `src/features/round1/elevations/elevation-scene.ts`
- Create: `src/features/round1/elevations/elevation-scene.test.ts`

- [ ] **Step 1: Write the failing scene-builder tests**

Create `src/features/round1/elevations/elevation-scene.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  type Round1FormInput
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "../showroom-intake-data";
import { buildFloorPlan, type FloorPlan } from "../floorplan/plan-geometry";
import { buildElevationScene } from "./elevation-scene";

function planFor(form: Round1FormInput = createDefaultShowroomForm()): FloorPlan {
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  return buildFloorPlan(
    result.normalized,
    estimate.cabinets,
    result.confirmationItems.length + estimate.confirmationItems.length,
    {}
  );
}

describe("buildElevationScene", () => {
  test("builds deterministic rough wall scenes from the default L-shape plan", () => {
    const plan = planFor();
    const first = buildElevationScene(plan);
    const second = buildElevationScene(plan);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((wall) => wall.notForProduction)).toBe(true);
    expect(first.every((wall) => wall.dimensionConfidence === "ROUGH")).toBe(true);
  });

  test("maps internal walls to customer-facing elevation titles", () => {
    const scene = buildElevationScene(planFor());
    const titles = scene.map((wall) => wall.title);

    expect(titles).toContain("Back Wall");
    expect(titles).toContain("Left Wall");
    expect(titles).not.toContain("Right Wall");
  });

  test("omits walls with no Round 1 objects worth confirming", () => {
    const form = {
      ...createDefaultShowroomForm(),
      openings: {
        doors: { status: "NO", items: [] },
        windows: { status: "NO", items: [] }
      }
    };
    const scene = buildElevationScene(planFor(form));

    expect(scene.every((wall) => wall.items.length > 0)).toBe(true);
    expect(scene.map((wall) => wall.wall)).not.toContain("BOTTOM");
  });

  test("keeps appliances and openings on their source walls", () => {
    const scene = buildElevationScene(planFor());
    const back = scene.find((wall) => wall.wall === "TOP");
    const left = scene.find((wall) => wall.wall === "LEFT");
    const front = scene.find((wall) => wall.wall === "BOTTOM");

    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "sink")).toBe(true);
    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "range")).toBe(true);
    expect(back?.items.some((item) => item.kind === "appliance" && item.symbol === "hood")).toBe(true);
    expect(back?.items.some((item) => item.kind === "opening" && item.symbol === "window")).toBe(true);
    expect(left?.items.some((item) => item.kind === "appliance" && item.symbol === "fridge")).toBe(true);
    expect(front?.items.some((item) => item.symbol === "door")).not.toBe(true);
  });

  test("includes the front wall when a visible Round 1 object exists there", () => {
    const form = {
      ...createDefaultShowroomForm(),
      layoutPreference: "GALLEY" as const
    };
    const scene = buildElevationScene(planFor(form));
    const front = scene.find((wall) => wall.wall === "BOTTOM");

    expect(front?.title).toBe("Front Wall");
    expect(front?.items.some((item) => item.kind === "appliance" && item.symbol === "fridge")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the scene-builder tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/elevations/elevation-scene.test.ts
```

Expected: FAIL because `src/features/round1/elevations/elevation-scene.ts` and `buildElevationScene` do not exist.

- [ ] **Step 3: Implement the pure scene builder**

Create `src/features/round1/elevations/elevation-scene.ts`:

```ts
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
const OPENING_STROKE_BAND_Y = 70;

export function buildElevationScene(plan: FloorPlan): WallElevationScene[] {
  return WALL_ORDER.map((wall) => buildWallScene(plan, wall)).filter(
    (scene): scene is WallElevationScene => scene !== null
  );
}

function buildWallScene(plan: FloorPlan, wall: Wall): WallElevationScene | null {
  const items: ElevationItem[] = [];

  plan.baseCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .forEach((cabinet, index) => {
      items.push({
        key: `base-${wall}-${index}`,
        kind: "baseCabinet",
        symbol: "baseCabinet",
        label: "Base cabinet",
        wall,
        ...mapRectToBand(plan, wall, cabinet, BASE_Y, BASE_H),
        sourceCode: cabinet.code
      });
    });

  plan.wallCabinets
    .filter((cabinet) => cabinet.wall === wall)
    .forEach((cabinet, index) => {
      items.push({
        key: `wall-${wall}-${index}`,
        kind: "wallCabinet",
        symbol: "wallCabinet",
        label: "Wall cabinet",
        wall,
        ...mapRectToBand(plan, wall, cabinet, WALL_CABINET_Y, WALL_CABINET_H),
        sourceCode: cabinet.code
      });
    });

  plan.wallCorners
    .filter((corner) => cornerTouchesWall(corner.type, wall))
    .forEach((corner, index) => {
      items.push({
        key: `corner-${wall}-${index}`,
        kind: "corner",
        symbol: "corner",
        label: "Corner cabinet",
        wall,
        ...mapRectToBand(plan, wall, corner, BASE_Y, BASE_H)
      });
    });

  plan.appliances
    .filter((appliance) => appliance.wall === wall)
    .forEach((appliance) => {
      const band = applianceBand(appliance);
      items.push({
        key: `appliance-${appliance.key}`,
        kind: "appliance",
        symbol: applianceSymbol(appliance),
        label: appliance.label,
        wall,
        ...mapRectToBand(plan, wall, appliance, band.y, band.h)
      });
    });

  if (plan.window?.wall === wall) {
    items.push({
      key: `opening-window-${wall}`,
      kind: "opening",
      symbol: "window",
      label: "Window",
      wall,
      ...mapRectToBand(plan, wall, plan.window, OPENING_STROKE_BAND_Y, 74)
    });
  }

  if (plan.door?.wall === wall) {
    items.push({
      key: `opening-door-${wall}`,
      kind: "opening",
      symbol: "door",
      label: "Door",
      wall,
      ...mapRectToBand(plan, wall, plan.door.breakRect, 58, 132)
    });
  }

  if (items.length === 0) return null;

  return {
    wall,
    title: WALL_TITLES[wall],
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    items: items.sort((a, b) => a.x - b.x || a.y - b.y),
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH"
  };
}

function mapRectToBand(
  plan: FloorPlan,
  wall: Wall,
  rect: PlanRect,
  y: number,
  h: number
): Pick<ElevationItem, "x" | "y" | "w" | "h"> {
  const axis = wallAxis(plan, wall);
  const start = wall === "LEFT" || wall === "RIGHT"
    ? axis.start + axis.length - (rect.y + rect.h)
    : rect.x;
  const length = wall === "LEFT" || wall === "RIGHT" ? rect.h : rect.w;
  const usable = SCENE_WIDTH - WALL_PADDING_X * 2;
  const x = WALL_PADDING_X + ((start - axis.start) / axis.length) * usable;
  const w = Math.max(14, (length / axis.length) * usable);

  return {
    x: round(clamp(x, WALL_PADDING_X, SCENE_WIDTH - WALL_PADDING_X - 8)),
    y,
    w: round(Math.min(w, SCENE_WIDTH - WALL_PADDING_X - x)),
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

function cornerTouchesWall(
  type: "TL" | "TR" | "BL" | "BR",
  wall: Wall
): boolean {
  return (
    (type === "TL" && (wall === "TOP" || wall === "LEFT")) ||
    (type === "TR" && (wall === "TOP" || wall === "RIGHT")) ||
    (type === "BL" && (wall === "BOTTOM" || wall === "LEFT")) ||
    (type === "BR" && (wall === "BOTTOM" || wall === "RIGHT"))
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export const ELEVATION_FLOOR_Y = FLOOR_Y;
```

- [ ] **Step 4: Run the scene-builder tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/elevations/elevation-scene.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the scene builder**

Run:

```bash
git add src/features/round1/elevations/elevation-scene.ts src/features/round1/elevations/elevation-scene.test.ts
git commit -m "feat(round1): build rough elevation scenes"
```

---

### Task 2: Rough Elevation SVG Renderer

**Files:**
- Create: `src/features/round1/elevations/elevation-preview.tsx`
- Create: `src/features/round1/elevations/elevation-preview.test.tsx`

- [ ] **Step 1: Write the failing renderer tests**

Create `src/features/round1/elevations/elevation-preview.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  generatePreliminaryCabinetList,
  normalizeRound1Form
} from "@/domain/round1";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "../showroom-intake-data";
import { buildFloorPlan } from "../floorplan/plan-geometry";
import { ElevationPreview } from "./elevation-preview";

function renderElevation() {
  const form = createDefaultShowroomForm();
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
  const plan = buildFloorPlan(
    result.normalized,
    estimate.cabinets,
    result.confirmationItems.length + estimate.confirmationItems.length,
    {}
  );
  return renderToStaticMarkup(<ElevationPreview plan={plan} />);
}

describe("ElevationPreview", () => {
  test("renders the rough elevations section with wall labels", () => {
    const html = renderElevation();

    expect(html).toContain("Rough Wall Elevations");
    expect(html).toContain("Back Wall");
    expect(html).toContain("Left Wall");
    expect(html).toContain("Round 1 rough elevation - not for production");
  });

  test("uses blue styling for openings and keeps cabinet linework neutral", () => {
    const html = renderElevation();

    expect(html).toContain('data-elevation-opening="window"');
    expect(html).toContain('stroke="#0ea5e9"');
    expect(html).toContain('data-elevation-item="baseCabinet"');
    expect(html).toContain('stroke="#1f2937"');
  });

  test("renders coarse appliance symbols without production details", () => {
    const html = renderElevation();

    expect(html).toContain('data-elevation-appliance="sink"');
    expect(html).toContain('data-elevation-appliance="fridge"');
    expect(html).toContain('data-elevation-appliance="range"');
    expect(html).not.toContain("B36");
    expect(html).not.toContain('data-base-cabinet="');
    expect(html).not.toContain('data-wall-cabinet="');
    expect(html).not.toContain("34 1/2");
    expect(html).not.toContain("14 1/4");
  });
});
```

- [ ] **Step 2: Run the renderer tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/elevations/elevation-preview.test.tsx
```

Expected: FAIL because `ElevationPreview` does not exist.

- [ ] **Step 3: Implement the renderer**

Create `src/features/round1/elevations/elevation-preview.tsx`:

```tsx
import type { RefObject } from "react";
import type { FloorPlan } from "../floorplan/plan-geometry";
import {
  ELEVATION_FLOOR_Y,
  buildElevationScene,
  type ElevationItem,
  type WallElevationScene
} from "./elevation-scene";

type ElevationPreviewProps = {
  plan: FloorPlan;
  svgRef?: RefObject<SVGSVGElement | null>;
  className?: string;
};

const INK = "#1f2937";
const MUTED = "#64748b";
const OPENING = "#0ea5e9";
const PANEL_W = 360;
const PANEL_H = 250;
const GAP = 18;
const COLUMNS = 2;

export function ElevationPreview({
  plan,
  svgRef,
  className = ""
}: ElevationPreviewProps) {
  const scenes = buildElevationScene(plan);
  if (scenes.length === 0) return null;

  const rows = Math.ceil(scenes.length / COLUMNS);
  const width = COLUMNS * PANEL_W + (COLUMNS - 1) * GAP;
  const height = rows * PANEL_H + (rows - 1) * GAP;

  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
          Rough Wall Elevations
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Round 1 rough wall elevations, not for production"
        className="block h-auto w-full bg-white"
      >
        {scenes.map((scene, index) => {
          const col = index % COLUMNS;
          const row = Math.floor(index / COLUMNS);
          return (
            <WallPanel
              key={scene.wall}
              scene={scene}
              x={col * (PANEL_W + GAP)}
              y={row * (PANEL_H + GAP)}
            />
          );
        })}
      </svg>
    </section>
  );
}

function WallPanel({
  scene,
  x,
  y
}: {
  scene: WallElevationScene;
  x: number;
  y: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} data-elevation-wall={scene.wall}>
      <rect
        x="0"
        y="0"
        width={PANEL_W}
        height={PANEL_H}
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth="1"
      />
      <text x="14" y="22" fontSize="13" fontWeight="700" fill={INK}>
        {scene.title}
      </text>
      <text x="14" y="238" fontSize="9" fill={MUTED}>
        Round 1 rough elevation - not for production
      </text>
      <line x1="20" y1={ELEVATION_FLOOR_Y} x2="340" y2={ELEVATION_FLOOR_Y} stroke={INK} strokeWidth="1.2" />
      {scene.items.map((item) => (
        <ElevationShape key={item.key} item={item} />
      ))}
    </g>
  );
}

function ElevationShape({ item }: { item: ElevationItem }) {
  if (item.kind === "opening") {
    return <OpeningShape item={item} />;
  }

  if (item.kind === "appliance") {
    return <ApplianceShape item={item} />;
  }

  return (
    <g data-elevation-item={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#ffffff"
        stroke={INK}
        strokeWidth="1.1"
      />
      {item.kind === "baseCabinet" && (
        <line
          x1={item.x}
          y1={item.y + 10}
          x2={item.x + item.w}
          y2={item.y + 10}
          stroke={INK}
          strokeWidth="0.8"
        />
      )}
    </g>
  );
}

function OpeningShape({ item }: { item: ElevationItem }) {
  return (
    <g data-elevation-opening={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill="#eff6ff"
        stroke={OPENING}
        strokeWidth="1.5"
      />
      {item.symbol === "window" && (
        <>
          <line x1={item.x + item.w / 2} y1={item.y} x2={item.x + item.w / 2} y2={item.y + item.h} stroke={OPENING} strokeWidth="1" />
          <line x1={item.x} y1={item.y + item.h / 2} x2={item.x + item.w} y2={item.y + item.h / 2} stroke={OPENING} strokeWidth="1" />
        </>
      )}
    </g>
  );
}

function ApplianceShape({ item }: { item: ElevationItem }) {
  return (
    <g data-elevation-appliance={item.symbol}>
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill={item.symbol === "hood" ? "#f8fafc" : "#ffffff"}
        stroke={INK}
        strokeWidth="1.2"
      />
      {item.symbol === "range" && (
        <line x1={item.x + 5} y1={item.y + 13} x2={item.x + item.w - 5} y2={item.y + 13} stroke={INK} strokeWidth="0.8" />
      )}
      {item.symbol === "sink" && (
        <ellipse cx={item.x + item.w / 2} cy={item.y + 14} rx={Math.max(6, item.w * 0.28)} ry="6" fill="none" stroke={INK} strokeWidth="1" />
      )}
      {item.symbol === "fridge" && (
        <line x1={item.x + item.w / 2} y1={item.y} x2={item.x + item.w / 2} y2={item.y + item.h} stroke={INK} strokeWidth="0.8" />
      )}
    </g>
  );
}
```

- [ ] **Step 4: Run the renderer tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/elevations/elevation-preview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the renderer**

Run:

```bash
git add src/features/round1/elevations/elevation-preview.tsx src/features/round1/elevations/elevation-preview.test.tsx
git commit -m "feat(round1): render rough wall elevations"
```

---

### Task 3: Rendering Reference Helper

**Files:**
- Create: `src/features/round1/rendering-references.ts`
- Create: `src/features/round1/rendering-references.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/features/round1/rendering-references.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { rasterizeRenderingReferences } from "./rendering-references";

describe("rasterizeRenderingReferences", () => {
  test("rasterizes the top-down reference when it is the only available SVG", async () => {
    const topDown = {} as SVGSVGElement;
    const rasterize = vi.fn(async () => "top-down-png");

    const result = await rasterizeRenderingReferences([topDown, null], rasterize);

    expect(result).toEqual(["top-down-png"]);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  test("rasterizes top-down and elevation references in order", async () => {
    const topDown = { id: "top" } as unknown as SVGSVGElement;
    const elevation = { id: "elevation" } as unknown as SVGSVGElement;
    const rasterize = vi
      .fn<(svg: SVGSVGElement) => Promise<string>>()
      .mockResolvedValueOnce("top-down-png")
      .mockResolvedValueOnce("elevation-png");

    const result = await rasterizeRenderingReferences([topDown, elevation], rasterize);

    expect(result).toEqual(["top-down-png", "elevation-png"]);
    expect(rasterize).toHaveBeenNthCalledWith(1, topDown);
    expect(rasterize).toHaveBeenNthCalledWith(2, elevation);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/rendering-references.test.ts
```

Expected: FAIL because `rendering-references.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/features/round1/rendering-references.ts`:

```ts
"use client";

import { rasterizeSvgElement } from "./rasterize-svg";

export async function rasterizeRenderingReferences(
  svgs: Array<SVGSVGElement | null | undefined>,
  rasterize: (svg: SVGSVGElement) => Promise<string> = rasterizeSvgElement
): Promise<string[]> {
  const images: string[] = [];

  for (const svg of svgs) {
    if (!svg) continue;
    images.push(await rasterize(svg));
  }

  return images;
}
```

- [ ] **Step 4: Run the helper tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/rendering-references.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper**

Run:

```bash
git add src/features/round1/rendering-references.ts src/features/round1/rendering-references.test.ts
git commit -m "feat(round1): collect rendering reference images"
```

---

### Task 4: App Integration

**Files:**
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-app.test.tsx`

- [ ] **Step 1: Write the failing app-level test**

Modify the `describe("ShowroomIntakeApp snapshot gating", ...)` block in `src/features/round1/showroom-intake-app.test.tsx` by adding this test:

```tsx
  test("hides rough elevations before cabinet fill is generated", () => {
    const html = renderToStaticMarkup(<ShowroomIntakeApp />);

    expect(html).not.toContain("Rough Wall Elevations");
    expect(html).not.toContain("Round 1 rough elevation - not for production");
  });
```

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx
```

Expected: PASS before implementation because the app does not show elevations yet. This is a regression guard for the pre-snapshot state.

- [ ] **Step 2: Update imports and refs in the app**

Modify the imports at the top of `src/features/round1/showroom-intake-app.tsx`:

```tsx
import { ElevationPreview } from "./elevations/elevation-preview";
import { LayoutPreview } from "./layout-preview";
import { rasterizeRenderingReferences } from "./rendering-references";
```

Remove the direct import of `rasterizeSvgElement`.

Add this ref next to `referenceTopDownRef`:

```tsx
  const referenceElevationRef = useRef<SVGSVGElement | null>(null);
```

- [ ] **Step 3: Send both available rendering references**

Replace the first lines inside `handleGenerateRendering` with:

```tsx
    const referenceTopDownSvg = referenceTopDownRef.current;
    const referenceElevationSvg = referenceElevationRef.current;
    const projectId = projectIdRef.current;
    if (!referenceTopDownSvg || !projectId || !snapshot) return;
```

Replace:

```tsx
      const referenceImagesBase64 = [await rasterizeSvgElement(referenceSvg)];
```

with:

```tsx
      const referenceImagesBase64 = await rasterizeRenderingReferences([
        referenceTopDownSvg,
        referenceElevationSvg
      ]);
```

This keeps the top-down plan required and makes the elevation reference optional.

- [ ] **Step 4: Show visible rough elevations after snapshot generation**

Insert this immediately after the visible `<LayoutPreview ... />` block and before `<RenderingControls ... />`:

```tsx
          {snapshot && <ElevationPreview plan={snapshot.floorPlan} />}
```

This ensures elevations appear only after `Generate Cabinet Fill` creates the frozen snapshot.

- [ ] **Step 5: Add the hidden elevation reference SVG**

Inside the existing hidden `snapshot && (...)` reference container, after the hidden `LayoutPreview`, add:

```tsx
              <ElevationPreview
                plan={snapshot.floorPlan}
                svgRef={referenceElevationRef}
              />
```

Keep the existing hidden container style unchanged so both SVGs are available for rasterization and neither adds visible duplicate UI.

- [ ] **Step 6: Run app and reference tests**

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx src/features/round1/rendering-references.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit app integration**

Run:

```bash
git add src/features/round1/showroom-intake-app.tsx src/features/round1/showroom-intake-app.test.tsx
git commit -m "feat(round1): show rough elevations in intake preview"
```

---

### Task 5: Full Verification and Context Update

**Files:**
- Modify: `ai_ctx.md`

- [ ] **Step 1: Run all automated checks**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected:

- `npm test`: all tests pass.
- `npx tsc --noEmit`: exits 0.
- `npm run build`: exits 0.

- [ ] **Step 2: Run browser QA**

Start the dev server:

```bash
npm run dev
```

Open `http://127.0.0.1:3000/` and verify:

- Initial load shows the empty room shell and no `Rough Wall Elevations`.
- Walk through Room, Openings, Layout, Appliances, and Adjust Positions.
- Run `Generate Cabinet Fill`.
- `Rough Wall Elevations` appears below `Top-Down Layout Plan`.
- Default L-shape shows at least Back Wall and Left Wall elevations.
- Elevations show coarse cabinets/appliances/openings and the not-for-production stamp.
- Elevations do not show cabinet codes, production dimension chains, or exact filler schedules.
- Run `Generate Rendering` with a configured image key.
- The request succeeds and the output remains non-authoritative and marked against the snapshot timestamp.

Stop the dev server after QA.

- [ ] **Step 3: Update `ai_ctx.md`**

Add a concise Done entry under Active Work:

```md
Done (2026-06-18): Round 1 rough wall elevations are implemented. A deterministic elevation scene builder (`src/features/round1/elevations/elevation-scene.ts`) maps `snapshot.floorPlan` into coarse Back/Left/Right/Front wall views, and `ElevationPreview` renders visible CAD-like rough elevations below the top-down plan only after `Generate Cabinet Fill`. The elevations stay Module 1 only: rough, not editable, no cabinet codes, no production dimensions, no filler schedule, and stamped not-for-production. The concept rendering flow now rasterizes both the clean top-down reference and the rough elevation reference when available via `referenceImagesBase64`, with top-down-only fallback if the elevation ref is unavailable. Verified: `npm test`, `npx tsc --noEmit`, `npm run build`, and browser QA.
```

If `ai_ctx.md` already contains user edits, preserve them and add only this entry.

- [ ] **Step 4: Commit context update**

Run:

```bash
git add ai_ctx.md
git commit -m "docs: update round1 rough elevations context"
```

---

## Self-Review

Spec coverage:

- Visible deterministic rough elevations: Task 2 and Task 4.
- Uses `snapshot.floorPlan` as the geometry source: Task 1 and Task 4.
- Keeps Module 1 boundaries and not-for-production labeling: Task 1 tests, Task 2 tests, Task 5 QA.
- Adds elevations as an AI rendering reference without API changes: Task 3 and Task 4.
- Fallback when elevation SVG is unavailable: Task 3 and Task 4.
- Verification and browser QA: Task 5.

Placeholder scan:

- No placeholder markers or incomplete sections are present.
- Every file to create or modify is listed with concrete code or exact edits.

Type consistency:

- `buildElevationScene(plan: FloorPlan): WallElevationScene[]` is used consistently by tests and renderer.
- `ElevationPreview` accepts `plan: FloorPlan` and `svgRef?: RefObject<SVGSVGElement | null>`.
- `rasterizeRenderingReferences` returns `Promise<string[]>`, matching the existing rendering route body.
