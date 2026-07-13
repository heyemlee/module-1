# Round 2 Visual Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-fidelity Next.js Round 2 prototype with role-specific Sales measurement and Designer proposal/review workspaces, synchronized plan/elevation views, and a professional fixture drawing set.

**Architecture:** Add a fixture-backed `src/features/round2` feature with a pure reducer controlling role, task, versions, selection, decisions, and stale states. A server route loads the existing project and user, then renders one client composition that delegates to focused measurement, proposal, and drawing modules. Reuse the current Studio tokens and shell conventions while rendering technical plan/elevation sheets as code-native SVG.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix icons, Motion, Vitest, server-rendered markup tests, Browser/IAB visual QA.

---

## File Map

Create:

- `src/app/(app)/projects/[projectId]/round2/page.tsx` — authenticated project route.
- `src/app/(app)/projects/[projectId]/round2/loading.tsx` — route loading state.
- `src/features/round2/round2-types.ts` — prototype types and action contracts.
- `src/features/round2/round2-fixtures.ts` — stable Mike kitchen fixture.
- `src/features/round2/round2-state.ts` — pure reducer and role defaults.
- `src/features/round2/round2-state.test.ts` — version, role, and stale-state tests.
- `src/features/round2/round2-workspace-shell.tsx` — Studio workspace composition.
- `src/features/round2/round2-workspace-shell.test.tsx` — shell region tests.
- `src/features/round2/round2-task-navigation.tsx` — three-task navigation.
- `src/features/round2/round2-task-navigation.test.tsx` — navigation semantics.
- `src/features/round2/round2-visual-prototype.tsx` — client composition and demo controls.
- `src/features/round2/measurement/measurement-workspace.tsx` — Sales workflow.
- `src/features/round2/measurement/measured-plan.tsx` — live measured-plan SVG.
- `src/features/round2/measurement/measured-plan.test.tsx` — SVG state tests.
- `src/features/round2/proposal/proposal-workspace.tsx` — Designer paired-view layout.
- `src/features/round2/proposal/design-plan.tsx` — selectable cabinet plan.
- `src/features/round2/proposal/wall-elevation.tsx` — synchronized elevation.
- `src/features/round2/proposal/proposal-selection.test.tsx` — shared selection tests.
- `src/features/round2/proposal/decision-rail.tsx` — design decision and remeasure UI.
- `src/features/round2/drawings/drawing-review.tsx` — drawing task composition.
- `src/features/round2/drawings/drawing-sheet.tsx` — professional plan/elevation SVG sheets.
- `src/features/round2/drawings/cabinet-schedule.tsx` — fixture cabinet schedule.
- `src/features/round2/drawings/drawing-sheet.test.tsx` — sheet detail tests.
- `src/features/round2/round2-visual-prototype.test.tsx` — integrated markup checks.
- `docs/audits/round2-visual-prototype/fidelity-ledger.md` — visual comparison record.

Modify:

- `src/features/platform/studio-shell.tsx` — add `round2` rail item type and link.
- `src/features/platform/global-sidebar.tsx` — detect the Round 2 route.
- `src/features/platform/project-detail.tsx` — send the Round 2 phase card to the new route.
- `src/features/platform/studio-shell.test.tsx` — verify Round 2 rail behavior.
- `src/features/platform/project-detail.test.tsx` — verify Round 2 phase destination.

## Task 1: Define Fixture State and Version Rules

**Files:**

- Create: `src/features/round2/round2-types.ts`
- Create: `src/features/round2/round2-fixtures.ts`
- Create: `src/features/round2/round2-state.ts`
- Test: `src/features/round2/round2-state.test.ts`

- [ ] **Step 1: Write reducer tests**

```ts
import { describe, expect, test } from "vitest";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "./round2-state";

describe("Round 2 prototype state", () => {
  test("defaults Sales to measurement and Designer to proposal", () => {
    expect(createRound2PrototypeState("SALES").task).toBe("MEASUREMENT");
    expect(createRound2PrototypeState("DESIGNER").task).toBe("PROPOSAL");
  });

  test("keeps submitted measurements read only for Designer", () => {
    const state = createRound2PrototypeState("DESIGNER");
    const next = reduceRound2Prototype(state, {
      type: "EDIT_MEASUREMENT",
      field: "wallA",
      value: 2304
    });
    expect(next.measurements.wallA).toBe(state.measurements.wallA);
  });

  test("remeasure blocks review and a new version makes outputs stale", () => {
    const requested = reduceRound2Prototype(
      createRound2PrototypeState("DESIGNER"),
      { type: "REQUEST_REMEASURE", objectId: "wall-a" }
    );
    expect(requested.measurementStatus).toBe("REMEASURE_REQUESTED");
    expect(requested.proposalStatus).toBe("NEEDS_DECISION");

    const resubmitted = reduceRound2Prototype(requested, {
      type: "SUBMIT_NEW_MEASUREMENT"
    });
    expect(resubmitted.measurementVersion).toBe(4);
    expect(resubmitted.proposalStatus).toBe("STALE");
    expect(resubmitted.drawingStatus).toBe("STALE");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts
```

Expected: FAIL because the Round 2 state modules do not exist.

- [ ] **Step 3: Add the state contracts**

```ts
export type Round2DemoRole = "SALES" | "DESIGNER";
export type Round2Task = "MEASUREMENT" | "PROPOSAL" | "DRAWINGS";
export type MeasurementStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REMEASURE_REQUESTED";
export type ProposalStatus = "READY" | "NEEDS_DECISION" | "STALE";
export type DrawingStatus = "DRAFT" | "REVIEW_READY" | "REVIEWED" | "STALE";
export type WallId = "A" | "B" | "C";

export type Round2Measurements = {
  wallA: number;
  wallB: number;
  wallC: number;
  ceiling: number;
  windowWidth: number;
  windowOffset: number;
};

export type Round2PrototypeState = {
  role: Round2DemoRole;
  task: Round2Task;
  measurementVersion: number;
  measurementStatus: MeasurementStatus;
  measurements: Round2Measurements;
  proposalVersion: number;
  proposalStatus: ProposalStatus;
  drawingVersion: number;
  drawingStatus: DrawingStatus;
  selectedWall: WallId;
  selectedObjectId: string | null;
  issueObjectId: string | null;
  activeSheet: "A1" | "A2" | "A3" | "A4" | "S1";
  drawingZoom: number;
};

export type Round2PrototypeAction =
  | { type: "SET_ROLE"; role: Round2DemoRole }
  | { type: "SET_TASK"; task: Round2Task }
  | {
      type: "EDIT_MEASUREMENT";
      field: keyof Round2Measurements;
      value: number;
    }
  | { type: "SUBMIT_MEASUREMENT" }
  | { type: "REQUEST_REMEASURE"; objectId: string }
  | { type: "SUBMIT_NEW_MEASUREMENT" }
  | { type: "SELECT_WALL"; wall: WallId }
  | { type: "SELECT_OBJECT"; objectId: string; wall: WallId }
  | { type: "RESOLVE_DESIGN_DECISION" }
  | {
      type: "SET_SHEET";
      sheet: Round2PrototypeState["activeSheet"];
    }
  | { type: "SET_DRAWING_ZOOM"; zoom: number }
  | { type: "MARK_REVIEWED" };
```

- [ ] **Step 4: Add stable fixture data**

```ts
import type { Round2Measurements, WallId } from "./round2-types";

export const ROUND2_MEASUREMENT_FIXTURE: Round2Measurements = {
  wallA: 2304,
  wallB: 1536,
  wallC: 2112,
  ceiling: 1536,
  windowWidth: 576,
  windowOffset: 672
};

export const ROUND2_CABINET_FIXTURE = [
  { id: "a-01", wall: "A" as WallId, code: "#1", width: 480, kind: "base" },
  { id: "a-02", wall: "A" as WallId, code: "#2", width: 432, kind: "base" },
  { id: "a-03", wall: "A" as WallId, code: "#3", width: 576, kind: "sink" },
  { id: "a-04", wall: "A" as WallId, code: "#4", width: 384, kind: "base" },
  { id: "b-05", wall: "B" as WallId, code: "#5", width: 480, kind: "upper" },
  { id: "b-06", wall: "B" as WallId, code: "#6", width: 192, kind: "filler" },
  { id: "b-07", wall: "B" as WallId, code: "#7", width: 576, kind: "appliance" }
] as const;

export const ROUND2_SHEETS = [
  { id: "A1", label: "Measured floor plan" },
  { id: "A2", label: "Wall A elevation" },
  { id: "A3", label: "Wall B elevation" },
  { id: "A4", label: "Wall C elevation" },
  { id: "S1", label: "Cabinet schedule" }
] as const;
```

- [ ] **Step 5: Implement the pure reducer**

Implement `createRound2PrototypeState()` from the fixture and handle every action. `EDIT_MEASUREMENT` must return the unchanged state for `DESIGNER`. `SET_ROLE` must switch only `role` and the default task. `SUBMIT_NEW_MEASUREMENT` must increment the version and set both downstream statuses to `STALE`.

```ts
import { ROUND2_MEASUREMENT_FIXTURE } from "./round2-fixtures";
import type {
  Round2DemoRole,
  Round2PrototypeAction,
  Round2PrototypeState
} from "./round2-types";

export function createRound2PrototypeState(
  role: Round2DemoRole
): Round2PrototypeState {
  return {
    role,
    task: role === "SALES" ? "MEASUREMENT" : "PROPOSAL",
    measurementVersion: 3,
    measurementStatus: "SUBMITTED",
    measurements: ROUND2_MEASUREMENT_FIXTURE,
    proposalVersion: 2,
    proposalStatus: "NEEDS_DECISION",
    drawingVersion: 1,
    drawingStatus: "REVIEW_READY",
    selectedWall: "A",
    selectedObjectId: "a-03",
    issueObjectId: "a-03",
    activeSheet: "A1",
    drawingZoom: 1
  };
}

export function reduceRound2Prototype(
  state: Round2PrototypeState,
  action: Round2PrototypeAction
): Round2PrototypeState {
  switch (action.type) {
    case "SET_ROLE":
      return {
        ...state,
        role: action.role,
        task: action.role === "SALES" ? "MEASUREMENT" : "PROPOSAL"
      };
    case "SET_TASK":
      return { ...state, task: action.task };
    case "EDIT_MEASUREMENT":
      return state.role === "DESIGNER"
        ? state
        : {
            ...state,
            measurementStatus: "DRAFT",
            measurements: {
              ...state.measurements,
              [action.field]: action.value
            }
          };
    case "SUBMIT_MEASUREMENT":
      return { ...state, measurementStatus: "SUBMITTED" };
    case "REQUEST_REMEASURE":
      return {
        ...state,
        measurementStatus: "REMEASURE_REQUESTED",
        proposalStatus: "NEEDS_DECISION",
        issueObjectId: action.objectId
      };
    case "SUBMIT_NEW_MEASUREMENT":
      return {
        ...state,
        measurementVersion: state.measurementVersion + 1,
        measurementStatus: "SUBMITTED",
        proposalStatus: "STALE",
        drawingStatus: "STALE"
      };
    case "SELECT_WALL":
      return { ...state, selectedWall: action.wall };
    case "SELECT_OBJECT":
      return {
        ...state,
        selectedWall: action.wall,
        selectedObjectId: action.objectId
      };
    case "RESOLVE_DESIGN_DECISION":
      return { ...state, proposalStatus: "READY", issueObjectId: null };
    case "SET_SHEET":
      return { ...state, activeSheet: action.sheet };
    case "SET_DRAWING_ZOOM":
      return {
        ...state,
        drawingZoom: Math.min(1.5, Math.max(0.75, action.zoom))
      };
    case "MARK_REVIEWED":
      return state.proposalStatus === "READY"
        ? { ...state, drawingStatus: "REVIEWED" }
        : state;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 6: Run the reducer tests**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2/round2-types.ts src/features/round2/round2-fixtures.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts
git commit -m "feat(round2): add visual prototype state"
```

## Task 2: Add the Round 2 Studio Shell and Task Navigation

**Files:**

- Create: `src/features/round2/round2-workspace-shell.tsx`
- Create: `src/features/round2/round2-workspace-shell.test.tsx`
- Create: `src/features/round2/round2-task-navigation.tsx`
- Create: `src/features/round2/round2-task-navigation.test.tsx`

- [ ] **Step 1: Write shell and navigation tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round2WorkspaceShell } from "./round2-workspace-shell";
import { Round2TaskNavigation } from "./round2-task-navigation";

describe("Round 2 workspace chrome", () => {
  test("orders header, tasks, and workspace", () => {
    const html = renderToStaticMarkup(
      <Round2WorkspaceShell
        projectBar={<div>Project bar</div>}
        taskBar={<div>Tasks</div>}
      >
        <div>Workspace</div>
      </Round2WorkspaceShell>
    );
    expect(html.indexOf("Project bar")).toBeLessThan(html.indexOf("Tasks"));
    expect(html.indexOf("Tasks")).toBeLessThan(html.indexOf("Workspace"));
  });

  test("marks the current task", () => {
    const html = renderToStaticMarkup(
      <Round2TaskNavigation
        task="PROPOSAL"
        onTaskChange={() => {}}
      />
    );
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Design Proposal");
    expect(html).toContain("Drawings &amp; Review");
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
npx vitest run src/features/round2/round2-workspace-shell.test.tsx src/features/round2/round2-task-navigation.test.tsx
```

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the shell**

```tsx
"use client";

import type { ReactNode } from "react";

export function Round2WorkspaceShell({
  projectBar,
  taskBar,
  children
}: {
  projectBar: ReactNode;
  taskBar: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-void text-studio-ink">
      <div
        data-round2-region="project"
        className="border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl"
      >
        {projectBar}
      </div>
      <div
        data-round2-region="tasks"
        className="border-b border-studio-line bg-white/45 backdrop-blur-md"
      >
        {taskBar}
      </div>
      <section data-round2-region="workspace" className="min-h-0 flex-1">
        {children}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Implement the navigation**

Use `Button`-like semantics without nesting buttons. Each task button must include a two-digit index, label, meta label, and `aria-current`.

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { Round2Task } from "./round2-types";

const TASKS = [
  { id: "MEASUREMENT", label: "Field Measurement", meta: "SALES" },
  { id: "PROPOSAL", label: "Design Proposal", meta: "DESIGNER" },
  { id: "DRAWINGS", label: "Drawings & Review", meta: "OUTPUT" }
] as const;

export function Round2TaskNavigation({
  task,
  onTaskChange
}: {
  task: Round2Task;
  onTaskChange: (task: Round2Task) => void;
}) {
  return (
    <nav aria-label="Round 2 tasks">
      <ol className="grid grid-cols-3">
        {TASKS.map((item, index) => {
          const active = item.id === task;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onTaskChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b-2 px-[18px] py-[12px] text-left",
                  active
                    ? "border-studio-ink bg-white/70"
                    : "border-transparent hover:bg-white/40"
                )}
              >
                <span className={cn(
                  "grid size-7 place-items-center rounded-full font-mono text-[10px]",
                  active ? "bg-studio-ink text-white" : "bg-white/65 text-studio-quiet"
                )}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.label}
                  </span>
                  <span className="block font-mono text-[9px] tracking-[0.12em] text-studio-quiet">
                    {item.meta}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 5: Run the tests**

Run:

```bash
npx vitest run src/features/round2/round2-workspace-shell.test.tsx src/features/round2/round2-task-navigation.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/round2/round2-workspace-shell.tsx src/features/round2/round2-workspace-shell.test.tsx src/features/round2/round2-task-navigation.tsx src/features/round2/round2-task-navigation.test.tsx
git commit -m "feat(round2): add Studio workspace shell"
```

## Task 3: Build the Sales Measurement Workspace

**Files:**

- Create: `src/features/round2/measurement/measured-plan.tsx`
- Create: `src/features/round2/measurement/measured-plan.test.tsx`
- Create: `src/features/round2/measurement/measurement-workspace.tsx`

- [ ] **Step 1: Write measured-plan state tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND2_MEASUREMENT_FIXTURE } from "../round2-fixtures";
import { MeasuredPlan } from "./measured-plan";

describe("MeasuredPlan", () => {
  test("labels the authoritative dimensions and active wall", () => {
    const html = renderToStaticMarkup(
      <MeasuredPlan
        measurements={ROUND2_MEASUREMENT_FIXTURE}
        selectedWall="A"
        selectedObjectId="wall-a"
        onSelectWall={() => {}}
      />
    );
    expect(html).toContain('aria-label="Measured kitchen plan"');
    expect(html).toContain('data-wall="A"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("12′ 0″");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npx vitest run src/features/round2/measurement/measured-plan.test.tsx
```

Expected: FAIL because `MeasuredPlan` is missing.

- [ ] **Step 3: Implement the measured plan**

Create a responsive SVG with `viewBox="0 0 760 560"`. Use a dark canvas, off-white wall lines, cyan measurement chains, and code-native buttons layered beside the SVG for keyboard wall selection. Render formatted fixture dimensions through:

```ts
function formatSixteenths(value: number) {
  const inches = Math.floor(value / 16);
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${feet}′ ${remainder}″`;
}
```

The top wall path must carry:

```tsx
<path
  data-wall="A"
  data-selected={selectedWall === "A"}
  d="M 160 130 H 600"
  className={selectedWall === "A"
    ? "stroke-cyan-300"
    : "stroke-[#f0f0eb]"}
  strokeWidth="12"
  fill="none"
/>
```

Keep all view elements inside one `<svg role="img" aria-label="Measured kitchen plan">`.

- [ ] **Step 4: Implement the measurement panel**

`MeasurementWorkspace` receives `state` and `dispatch`. Use a 380px left rail and a fluid canvas. Render the six fixture fields in the approved order and dispatch numeric sixteenth-inch values.

```tsx
<input
  aria-label="Wall A overall length"
  value={state.measurements.wallA / 16}
  onChange={(event) =>
    dispatch({
      type: "EDIT_MEASUREMENT",
      field: "wallA",
      value: Math.round(Number(event.target.value) * 16)
    })
  }
  className="h-11 w-full rounded-studio-control border border-studio-line-strong bg-white px-3 font-mono text-[13px]"
/>
```

Add section progress, explicit `Required`, `Confirmed`, and `Remeasure requested` text, plus a primary submission button that dispatches `SUBMIT_MEASUREMENT`. When the demo role is Designer, controls render disabled with `Submitted measurement vN · read only`.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npx vitest run src/features/round2/measurement/measured-plan.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/round2/measurement/measured-plan.tsx src/features/round2/measurement/measured-plan.test.tsx src/features/round2/measurement/measurement-workspace.tsx
git commit -m "feat(round2): build Sales measurement workspace"
```

## Task 4: Build Synchronized Designer Plan and Elevation Views

**Files:**

- Create: `src/features/round2/proposal/design-plan.tsx`
- Create: `src/features/round2/proposal/wall-elevation.tsx`
- Create: `src/features/round2/proposal/proposal-workspace.tsx`
- Test: `src/features/round2/proposal/proposal-selection.test.tsx`

- [ ] **Step 1: Write shared selection tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ROUND2_CABINET_FIXTURE } from "../round2-fixtures";
import { DesignPlan } from "./design-plan";
import { WallElevation } from "./wall-elevation";

describe("Round 2 proposal selection", () => {
  test("marks the same cabinet selected in plan and elevation", () => {
    const plan = renderToStaticMarkup(
      <DesignPlan
        cabinets={ROUND2_CABINET_FIXTURE}
        selectedObjectId="a-03"
        onSelect={() => {}}
      />
    );
    const elevation = renderToStaticMarkup(
      <WallElevation
        wall="A"
        cabinets={ROUND2_CABINET_FIXTURE}
        selectedObjectId="a-03"
        onSelect={() => {}}
      />
    );
    expect(plan).toContain('data-cabinet-id="a-03"');
    expect(plan).toContain('data-selected="true"');
    expect(elevation).toContain('data-cabinet-id="a-03"');
    expect(elevation).toContain('data-selected="true"');
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npx vitest run src/features/round2/proposal/proposal-selection.test.tsx
```

Expected: FAIL because both drawing components are missing.

- [ ] **Step 3: Implement `DesignPlan`**

Render a dark-canvas SVG using the fixture cabinet identities. Every cabinet group must expose `data-cabinet-id`, `data-selected`, a keyboard-accessible alternative button, and an `onSelect(id, wall)` callback. Use off-white structural lines, gray cabinets, cyan selected outlines, orange fillers, and red issue markers.

- [ ] **Step 4: Implement `WallElevation`**

Render the selected wall on a white technical sheet. Filter fixture cabinets by wall and calculate widths from the fixture. Each cabinet group uses the same identity as the plan.

```tsx
const wallCabinets = cabinets.filter((cabinet) => cabinet.wall === wall);
let cursor = 70;

return wallCabinets.map((cabinet) => {
  const width = cabinet.width / 4;
  const x = cursor;
  cursor += width;
  return (
    <g
      key={cabinet.id}
      data-cabinet-id={cabinet.id}
      data-selected={selectedObjectId === cabinet.id}
      onClick={() => onSelect(cabinet.id, wall)}
    >
      <rect
        x={x}
        y={170}
        width={width}
        height={120}
        fill="#fbfbf8"
        stroke={selectedObjectId === cabinet.id ? "#31aeb2" : "#262626"}
        strokeWidth={selectedObjectId === cabinet.id ? 3 : 1.5}
      />
      <text x={x + width / 2} y={235} textAnchor="middle" fill="#d52b24">
        {cabinet.code}
      </text>
    </g>
  );
});
```

- [ ] **Step 5: Compose the approved paired workspace**

Use:

```text
desktop: minmax(0,1.18fr) minmax(360px,.82fr) 320px
iPad landscape: minmax(0,1.1fr) minmax(320px,.9fr)
iPad portrait: one drawing column + bottom-sheet controls
```

The Designer workspace header must show `Measurement vN · locked`. Wall tabs dispatch `SELECT_WALL`; selecting a cabinet dispatches `SELECT_OBJECT`.

- [ ] **Step 6: Run the selection tests**

Run:

```bash
npx vitest run src/features/round2/proposal/proposal-selection.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2/proposal/design-plan.tsx src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/proposal-workspace.tsx src/features/round2/proposal/proposal-selection.test.tsx
git commit -m "feat(round2): add synchronized design views"
```

## Task 5: Add the Decision Rail and Remeasurement Loop

**Files:**

- Create: `src/features/round2/proposal/decision-rail.tsx`
- Modify: `src/features/round2/proposal/proposal-workspace.tsx`
- Modify: `src/features/round2/round2-state.test.ts`

- [ ] **Step 1: Extend reducer tests for decision behavior**

Add:

```ts
test("does not approve drawings while a design decision remains", () => {
  const state = createRound2PrototypeState("DESIGNER");
  const blocked = reduceRound2Prototype(state, { type: "MARK_REVIEWED" });
  expect(blocked.drawingStatus).toBe("REVIEW_READY");

  const resolved = reduceRound2Prototype(state, {
    type: "RESOLVE_DESIGN_DECISION"
  });
  const reviewed = reduceRound2Prototype(resolved, {
    type: "MARK_REVIEWED"
  });
  expect(reviewed.drawingStatus).toBe("REVIEWED");
});
```

- [ ] **Step 2: Run the reducer test and confirm the new assertion**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts
```

Expected: PASS if Task 1 reducer behavior is intact; change the reducer only if this assertion exposes a mismatch.

- [ ] **Step 3: Implement `DecisionRail`**

Render:

- selected object metadata;
- one hood-clearance decision;
- one allowed sink-cabinet width control;
- `Resolve decision`;
- `Request remeasure`;
- locked measurement notice.

`Request remeasure` dispatches the selected object identity. When `measurementStatus === "REMEASURE_REQUESTED"`, show the affected object and a Sales-only `Submit measurement v{n+1}` demo action.

- [ ] **Step 4: Integrate the rail without shrinking iPad drawings**

At `max-width: 1180px`, replace the fixed rail with a `Dialog` or existing bottom-sheet-compatible panel triggered by a `Decisions` button. Keep plan and elevation visible together.

- [ ] **Step 5: Run related tests**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts src/features/round2/proposal/proposal-selection.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/round2/proposal/decision-rail.tsx src/features/round2/proposal/proposal-workspace.tsx src/features/round2/round2-state.test.ts
git commit -m "feat(round2): add design decisions and remeasure loop"
```

## Task 6: Build the Professional Drawing Set

**Files:**

- Create: `src/features/round2/drawings/drawing-sheet.tsx`
- Create: `src/features/round2/drawings/cabinet-schedule.tsx`
- Create: `src/features/round2/drawings/drawing-review.tsx`
- Test: `src/features/round2/drawings/drawing-sheet.test.tsx`

- [ ] **Step 1: Write drawing-detail tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { DrawingSheet } from "./drawing-sheet";

describe("Round 2 drawing sheets", () => {
  test("renders professional A1 annotations", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet sheet="A1" measurementVersion={3} proposalVersion={2} />
    );
    expect(html).toContain("MEASUREMENT v3");
    expect(html).toContain("PROPOSAL v2");
    expect(html).toContain('data-drawing-layer="dimensions"');
    expect(html).toContain('data-drawing-layer="cabinet-numbers"');
    expect(html).toContain("#13");
  });

  test("renders elevation dimensions on A2", () => {
    const html = renderToStaticMarkup(
      <DrawingSheet sheet="A2" measurementVersion={3} proposalVersion={2} />
    );
    expect(html).toContain("WALL A ELEVATION");
    expect(html).toContain("95 13/16");
    expect(html).toContain("36");
  });
});
```

- [ ] **Step 2: Run the drawing test and confirm failure**

Run:

```bash
npx vitest run src/features/round2/drawings/drawing-sheet.test.tsx
```

Expected: FAIL because the drawing modules are missing.

- [ ] **Step 3: Implement the technical sheet frame**

Use one SVG coordinate system per sheet with:

- white paper and black border;
- black structural line layer;
- cyan dimension layer `#079ca5`;
- orange cabinet-boundary layer `#f28c28`;
- red cabinet-number layer `#e12821`;
- title block and source versions.

Use groups with stable attributes:

```tsx
<g data-drawing-layer="dimensions" stroke="#079ca5" fill="#079ca5">
  {dimensionChains}
</g>
<g data-drawing-layer="cabinet-boundaries" stroke="#f28c28">
  {cabinetBoundaries}
</g>
<g data-drawing-layer="cabinet-numbers" fill="#e12821">
  {cabinetNumbers}
</g>
```

Implement A1 as a plan sheet and A2–A4 as elevations with nested dimension chains, cabinet splits, window/appliance linework, fillers, and cabinet numbers. Keep fixture geometry explicit and deterministic in this visual phase.

- [ ] **Step 4: Implement the schedule**

Render a code-native table for S1 with columns:

```text
ID | Wall | Type | Width | Height | Depth | Notes
```

Use the same fixture cabinet identities as plan and elevation.

- [ ] **Step 5: Implement drawing review controls**

Add sheet tabs, fit/zoom buttons, review/stale badge, current source versions, and a `Mark reviewed` action. Disable review until `proposalStatus === "READY"`.

- [ ] **Step 6: Run drawing tests**

Run:

```bash
npx vitest run src/features/round2/drawings/drawing-sheet.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2/drawings/drawing-sheet.tsx src/features/round2/drawings/cabinet-schedule.tsx src/features/round2/drawings/drawing-review.tsx src/features/round2/drawings/drawing-sheet.test.tsx
git commit -m "feat(round2): add professional drawing set"
```

## Task 7: Compose the Prototype and Add the Project Route

**Files:**

- Create: `src/features/round2/round2-visual-prototype.tsx`
- Create: `src/features/round2/round2-visual-prototype.test.tsx`
- Create: `src/app/(app)/projects/[projectId]/round2/page.tsx`
- Create: `src/app/(app)/projects/[projectId]/round2/loading.tsx`

- [ ] **Step 1: Write integrated markup tests**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Round2VisualPrototype } from "./round2-visual-prototype";

describe("Round2VisualPrototype", () => {
  test("renders the approved three-task workflow", () => {
    const html = renderToStaticMarkup(
      <Round2VisualPrototype
        projectId="p1"
        projectName="Main Kitchen"
        customerName="Mike"
        actualRole="DESIGNER"
      />
    );
    expect(html).toContain("Field Measurement");
    expect(html).toContain("Design Proposal");
    expect(html).toContain("Drawings &amp; Review");
    expect(html).toContain("Measurement v3");
    expect(html).toContain("Visual prototype");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npx vitest run src/features/round2/round2-visual-prototype.test.tsx
```

Expected: FAIL because the composition is missing.

- [ ] **Step 3: Implement the client composition**

Use `useReducer(reduceRound2Prototype, createRound2PrototypeState(defaultRole))`. Map `SALES` to Sales and map `DESIGNER`, `ADMIN`, and `OWNER` to Designer for the initial demo role. Provide an explicit `View as Sales / View as Designer` prototype control. Render the correct workspace by `state.task`.

- [ ] **Step 4: Implement the authenticated route**

```tsx
import { notFound, redirect } from "next/navigation";
import { Round2VisualPrototype } from "@/features/round2/round2-visual-prototype";
import { getCurrentUser } from "@/server/platform/auth-service";
import { getProjectForUser } from "@/server/platform/project-repository";

export default async function ProjectRound2Page({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { projectId } = await params;
  const project = await getProjectForUser(projectId, user);
  if (!project) notFound();

  return (
    <Round2VisualPrototype
      projectId={projectId}
      projectName={project.projectName}
      customerName={project.customerName}
      actualRole={user.role}
    />
  );
}
```

- [ ] **Step 5: Add a Studio loading state**

Use the same route skeleton language as `round1/loading.tsx`, with one 380px rail skeleton and a fluid paired-canvas skeleton. Do not introduce new loading copy.

- [ ] **Step 6: Run integrated tests**

Run:

```bash
npx vitest run src/features/round2/round2-visual-prototype.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(app)/projects/[projectId]/round2/page.tsx' 'src/app/(app)/projects/[projectId]/round2/loading.tsx' src/features/round2/round2-visual-prototype.tsx src/features/round2/round2-visual-prototype.test.tsx
git commit -m "feat(round2): add visual prototype route"
```

## Task 8: Connect Project Navigation

**Files:**

- Modify: `src/features/platform/studio-shell.tsx`
- Modify: `src/features/platform/global-sidebar.tsx`
- Modify: `src/features/platform/project-detail.tsx`
- Modify: `src/features/platform/studio-shell.test.tsx`
- Modify: `src/features/platform/project-detail.test.tsx`

- [ ] **Step 1: Add failing navigation assertions**

Add assertions that:

```ts
expect(html).toContain(`/projects/${projectId}/round2`);
expect(html).toContain("Round 2");
```

In the project-detail test, assert that the third phase links to `/projects/p1/round2` instead of Round 1.

- [ ] **Step 2: Run the focused platform tests**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx
```

Expected: FAIL because the Round 2 destination is not connected.

- [ ] **Step 3: Add the rail item and active route**

Extend `StudioNavItem` and `GlobalSidebar` with `"round2"`. Insert:

```ts
{
  id: "round2",
  href: projectId ? `/projects/${projectId}/round2` : "/projects",
  label: "Round 2",
  section: "project",
  visible: Boolean(projectId)
}
```

Detect `parts[3] === "round2"` before the overview fallback.

- [ ] **Step 4: Update the project phase destination**

Change the Round 2 phase to:

```ts
href: `/projects/${project.id}/round2`
```

Keep the current project-status gating and label behavior unchanged.

- [ ] **Step 5: Run the platform tests**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/platform/studio-shell.tsx src/features/platform/global-sidebar.tsx src/features/platform/project-detail.tsx src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx
git commit -m "feat(round2): connect project navigation"
```

## Task 9: Complete Automated and Visual Verification

**Files:**

- Create: `docs/audits/round2-visual-prototype/fidelity-ledger.md`
- Modify only when verification reveals a concrete defect: files created in Tasks 1–8

- [ ] **Step 1: Run the full Round 2 test set**

Run:

```bash
npx vitest run src/features/round2
```

Expected: all Round 2 tests pass with zero failures.

- [ ] **Step 2: Run affected platform tests**

Run:

```bash
npx vitest run src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run type checking**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and the Round 2 route appears in the build output.

- [ ] **Step 5: Verify in Browser/IAB at desktop**

Open an accessible project at:

```text
http://127.0.0.1:3000/projects/{projectId}/round2
```

At 1440×900 verify:

- Sales role shows a 380px form rail and large dark measured-plan canvas.
- Designer role shows plan, selected elevation, and decision rail in one viewport.
- selecting Wall B updates the elevation;
- selecting a cabinet highlights it in both drawings;
- requesting remeasurement shows the Sales handoff state;
- resolving the decision enables review;
- drawing sheets use the reference color system and technical density.

- [ ] **Step 6: Verify iPad layouts**

At 1180×820 verify the decision rail becomes a drawer without hiding either drawing. At 820×1180 verify the controls become a bottom sheet and no primary drawing content clips.

- [ ] **Step 7: Compare visual sources and write the fidelity ledger**

Create `fidelity-ledger.md` with this exact structure:

```md
# Round 2 Visual Prototype Fidelity Ledger

## Sources

- Round 1 workspace: current `/projects/:id/round1`
- Approved specification: `docs/superpowers/specs/2026-07-01-round2-visual-prototype-design.md`
- Drawing reference: `docs/design-references/round2-professional-drawing-reference.png`

## Comparison

| Area | Source expectation | Render evidence | Result |
| --- | --- | --- | --- |
| Studio shell | Round 1 typography, glass, chrome density | desktop screenshot | Pass |
| Sales workspace | 380px rail + live plan | Sales screenshot | Pass |
| Designer workspace | synchronized plan/elevation | Designer screenshot | Pass |
| Drawing language | black/cyan/orange/red technical sheet | A1/A2 screenshot | Pass |
| iPad behavior | drawings preserved; controls collapse | iPad screenshots | Pass |

## Copy Diff

No unapproved above-the-fold copy.

## Intentional Deviations

- Fixture drawing geometry only; no arbitrary-room production generation.
- No real persistence, AI extraction, approval authority, or export.
```

Replace any `Pass` with the actual defect and fix it before completion.

- [ ] **Step 8: Run final repository checks after visual fixes**

Run:

```bash
npx vitest run src/features/round2 src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx && npx tsc --noEmit && npm run build
```

Expected: zero test failures, TypeScript exit 0, build exit 0.

- [ ] **Step 9: Commit verification evidence**

```bash
git add docs/audits/round2-visual-prototype src/features/round2 src/features/platform/studio-shell.tsx src/features/platform/global-sidebar.tsx src/features/platform/project-detail.tsx
git commit -m "test(round2): verify visual prototype"
```

## Revision Task 10: Add the Strict Round 1 Handoff Gate

**Files:**

- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`
- Modify: `src/features/round2/round2-fixtures.ts`
- Create: `src/features/round2/handoff/round1-handoff.tsx`
- Create: `src/features/round2/handoff/round1-handoff.test.tsx`
- Modify: `src/features/round2/round2-visual-prototype.tsx`

- [ ] **Step 1: Add failing state tests**

Test that the initial state has no locked reference, `SET_TASK` cannot enter a
Round 2 task before lock, `LOCK_REFERENCE` unlocks the tasks, and
`REPLACE_REFERENCE` increments the reference version while marking proposal
and drawing stale.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts
```

Expected: FAIL because reference state and actions do not exist.

- [ ] **Step 3: Add reference state**

Add:

```ts
type Round1ReferenceFixture = {
  id: string;
  generatedAt: string;
  complete: boolean;
  layoutLabel: string;
  styleLabel: string;
  colorLabel: string;
  appliances: readonly string[];
};
```

Add `referenceLocked`, `referenceVersion`, and `referenceSnapshotId` to
`Round2PrototypeState`, plus `LOCK_REFERENCE` and `REPLACE_REFERENCE` actions.
`SET_TASK` must return unchanged state when `referenceLocked` is false.

- [ ] **Step 4: Write the failing Handoff component test**

Assert that the Handoff screen renders layout, style, color, appliances,
snapshot version, and `Lock for Round 2`, without rendering the three task
workspaces.

- [ ] **Step 5: Implement the Handoff screen**

Use the approved Studio visual system. Show one complete Round 1 snapshot card
with a real miniature plan, source metadata, and role-permitted lock action.
Do not add a marketing hero or generic empty-state illustration.

- [ ] **Step 6: Gate the prototype composition**

Render `Round1Handoff` instead of task navigation and workspaces until a
reference is locked. After lock, show the reference version in the project
header and render the existing three-task workflow.

- [ ] **Step 7: Verify**

Run:

```bash
npx vitest run src/features/round2/round2-state.test.ts src/features/round2/handoff/round1-handoff.test.tsx src/features/round2/round2-visual-prototype.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/round2
git commit -m "feat(round2): gate workflow on locked Round 1 reference"
```

## Revision Task 11: Remove Invented Boundaries and Add Precision Adjustment

**Files:**

- Modify: `src/features/round2/measurement/measured-plan.tsx`
- Modify: `src/features/round2/measurement/measured-plan.test.tsx`
- Modify: `src/features/round2/proposal/design-plan.tsx`
- Modify: `src/features/round2/proposal/decision-rail.tsx`
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`

- [ ] **Step 1: Add failing measured-plan assertions**

Assert that measured-plan markup contains no `OPEN SIDE`, no diagonal closing
path, and no dashed closure.

- [ ] **Step 2: Verify the measured-plan test fails**

Run:

```bash
npx vitest run src/features/round2/measurement/measured-plan.test.tsx
```

Expected: FAIL against the current open-side annotation and dashed path.

- [ ] **Step 3: Remove the invented closure**

Delete the diagonal/dashed path and the `OPEN SIDE · NO WALL` label from both
measurement and proposal plan drawings. Preserve only real walls and opening
marks.

- [ ] **Step 4: Add a failing cabinet-offset reducer test**

Dispatch:

```ts
{ type: "SET_CABINET_OFFSET", objectId: "a-03", x: 2.5, y: 0 }
```

Assert the offset is stored and `proposalVersion` increments.

- [ ] **Step 5: Implement precision state and controls**

Add `cabinetOffsets` to state and the offset action. Add numeric X/Y controls
to the Decision rail for the selected cabinet. Apply the selected cabinet's
offset in the proposal plan and elevation without changing Round 1 reference
geometry or Sales measurements.

- [ ] **Step 6: Verify**

Run:

```bash
npx vitest run src/features/round2
npx tsc --noEmit
```

Expected: all Round 2 tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2
git commit -m "feat(round2): add precise proposal adjustments"
```

## Revision Task 12: Re-run Visual Fidelity Verification

- [ ] Verify the strict Handoff gate at 1440×900.
- [ ] Lock the Round 1 reference as Sales and confirm task navigation appears.
- [ ] Verify the reference version remains visible in all three tasks.
- [ ] Confirm measured and proposal plans have no invented diagonal closure.
- [ ] Adjust a cabinet offset and confirm both plan and elevation update.
- [ ] Replace the reference and confirm proposal/drawing stale states.
- [ ] Repeat desktop and iPad screenshots and update the fidelity ledger.
- [ ] Run:

```bash
npx vitest run src/features/round2 src/features/platform/studio-shell.test.tsx src/features/platform/project-detail.test.tsx && npx tsc --noEmit && npm run build
```

Expected: zero test failures, TypeScript exit 0, build exit 0.
