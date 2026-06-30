# Layout-Aware Rendering Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one complete, layout-aware Round 1 rendering and prevent microwave placement from inventing a tall cabinet on an island or peninsula.

**Architecture:** Keep the existing single-image generation API. Derive a deterministic camera paragraph and visible-wall set from the frozen layout, then derive microwave presentation from the frozen floor-plan appliance placement. Extend the existing peninsula appliance-placement mechanism with a narrowly scoped island marker for the standalone microwave, preserving all current uncommitted peninsula work.

**Tech Stack:** TypeScript, React 19, Next.js 15, Tailwind CSS, Vitest, OpenAI Images edits endpoint

---

### Task 1: Add layout-aware camera prompt contracts

**Files:**
- Modify: `src/features/round1/rendering-prompt.test.ts`
- Modify: `src/features/round1/rendering-prompt.ts`
- Modify: `src/features/round1/floorplan/spatial-language.ts`

- [ ] **Step 1: Write failing camera tests**

Add tests that build prompts for `ONE_WALL`, `LEFT_L_SHAPE`,
`RIGHT_L_SHAPE`, `U_SHAPE`, `GALLEY`, and `PENINSULA` and assert:

```ts
expect(oneWall).toContain("complete run");
expect(leftL).toContain("open front-right side");
expect(rightL).toContain("open front-left side");
expect(uShape).toContain("all three cabinet runs");
expect(galley).toContain("open end of the galley aisle");
expect(galley).toContain("both opposing parallel cabinet runs");
expect(galley).toContain("On the front wall");
expect(galley).not.toContain("front wall behind the camera");
expect(galley).not.toContain("behind the viewpoint");
expect(peninsula).toContain("peninsula attachment point");
expect(peninsula).toContain("free end");
```

Also assert every layout includes:

```ts
expect(prompt).toContain("Keep every required cabinet run fully inside the frame");
expect(prompt).toContain("corrected verticals");
expect(prompt).toContain("Do not use a fisheye lens");
```

- [ ] **Step 2: Run the prompt tests and verify RED**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: FAIL because the prompt still contains one global one-point camera.

- [ ] **Step 3: Implement deterministic camera policies**

In `rendering-prompt.ts`, add:

```ts
const CAMERA_POLICIES: Record<string, string> = {
  ONE_WALL: "Use a centered front view, pulled back until the complete run and both ends are visible.",
  LEFT_L_SHAPE: "Use a three-quarter view from the open front-right side, aimed toward the inside corner so the complete back and left runs are visible.",
  RIGHT_L_SHAPE: "Use a three-quarter view from the open front-left side, aimed toward the inside corner so the complete back and right runs are visible. Do not mirror the layout.",
  U_SHAPE: "Place the camera centered outside the open end and slightly elevated so all three cabinet runs are visible from the back corners to both open ends.",
  GALLEY: "Place the camera at an open end of the galley aisle, slightly elevated and angled down the aisle so both opposing parallel cabinet runs—the back-wall run and front-wall run—are completely visible together.",
  PENINSULA: "Use a pulled-back three-quarter view from the open side opposite the peninsula anchor, showing the complete wall runs, peninsula attachment point, and free end.",
  ISLAND: "Use a pulled-back three-quarter view that keeps the complete perimeter run and full island inside the frame."
};
```

Map legacy/island variants to the closest policy and prepend a shared camera
contract requiring perspective with corrected verticals, moderate wide angle,
frame margin, no cropping, and no fisheye distortion.

- [ ] **Step 4: Make front-wall language camera-aware**

Replace the fixed `VISIBLE_WALLS` constant with:

```ts
function visibleWallsForLayout(layout: string): Wall[] {
  return layout === "GALLEY"
    ? ["TOP", "BOTTOM"]
    : ["TOP", "LEFT", "RIGHT"];
}
```

Add an optional `{ frontWallVisible?: boolean }` argument to `describeDoor` and
`describeBehindCameraAppliances`. When the galley front wall is visible,
`describeDoor` keeps the door on that wall without saying it is behind the
camera, and `describeBehindCameraAppliances` returns `null` because those
appliances are described by the front-wall walkthrough.

- [ ] **Step 5: Run the prompt tests and verify GREEN**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: PASS.

### Task 2: Encode realistic island/peninsula microwave placement

**Files:**
- Modify: `src/features/round1/floorplan/plan-geometry.test.ts`
- Modify: `src/features/round1/floorplan/plan-geometry.ts`
- Modify: `src/features/round1/layout-preview.tsx`
- Test: `src/features/round1/floorplan/plan-geometry.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Add a peninsula test using `MICROWAVE_DRAWER` and:

```ts
const { plan } = planFromForm(peninsulaForm, {
  microwaveOvenCombo: { onPeninsula: true, position: 120 }
});
expect(
  plan.appliances.find((item) => item.key === "microwaveOvenCombo")
).toMatchObject({ onPeninsula: true });
```

Add an island test:

```ts
const { plan } = planFromForm(islandForm, {
  microwaveOvenCombo: { onIsland: true, position: 120 }
});
expect(
  plan.appliances.find((item) => item.key === "microwaveOvenCombo")
).toMatchObject({ onIsland: true });
```

Add a stacked-appliance safety test asserting `ovenMicrowaveStack` is absent
from both island and peninsula eligible-key sets.

- [ ] **Step 2: Run geometry tests and verify RED**

Run:

```bash
npm test -- src/features/round1/floorplan/plan-geometry.test.ts
```

Expected: FAIL because `onIsland` and the restricted eligibility set do not
exist.

- [ ] **Step 3: Add the island placement marker and safe eligibility**

In `plan-geometry.ts`:

- add `onIsland?: boolean` to `ApplianceShape` and `PositionOverride`;
- retain the existing `onPeninsula?: boolean` fields;
- remove `ovenMicrowaveStack` from `PENINSULA_APPLIANCE_KEYS`;
- export `ISLAND_APPLIANCE_KEYS = new Set(["microwaveOvenCombo"])`;
- after `placeIsland`, move the standalone microwave into the island rectangle
  when its override has `onIsland: true`, preserving its size and marking the
  resulting shape with `onIsland: true`.

- [ ] **Step 4: Make the island a microwave drop target**

In `layout-preview.tsx`:

- import `ISLAND_APPLIANCE_KEYS`;
- highlight the island during a standalone-microwave drag;
- in `overrideFromPointer`, return
  `{ onIsland: true, position: pt.x - island.x }` when the pointer falls within
  the island drop margin;
- treat `onIsland` like `onPeninsula` for appliance-symbol orientation.

Keep all existing peninsula dragging and rendering code intact.

- [ ] **Step 5: Run geometry and layout tests**

Run:

```bash
npm test -- src/features/round1/floorplan/plan-geometry.test.ts src/features/round1/layout-preview.test.tsx src/features/round1/full-flow.test.ts
```

Expected: PASS.

### Task 3: Add placement-aware microwave prompt rules

**Files:**
- Modify: `src/features/round1/rendering-prompt.test.ts`
- Modify: `src/features/round1/rendering-prompt.ts`

- [ ] **Step 1: Write failing microwave prompt tests**

Build frozen peninsula and island snapshots whose standalone microwave shapes
have `onPeninsula` and `onIsland` respectively. Assert:

```ts
expect(peninsulaPrompt).toContain("under-counter");
expect(peninsulaPrompt).toContain("peninsula base cabinet");
expect(peninsulaPrompt).toContain("Do not add a tall cabinet");

expect(islandPrompt).toContain("under-counter");
expect(islandPrompt).toContain("island base cabinet");
expect(islandPrompt).toContain("Do not add a tall cabinet");
```

For `WALL_OVEN_MICROWAVE_STACK`, assert the prompt still requires one tall
appliance cabinet and does not contain the island/peninsula under-counter rule.

For `UPPER_CABINET_MICROWAVE` and `COUNTERTOP_MICROWAVE`, assert the prompt
preserves upper-cabinet and countertop placement respectively.

- [ ] **Step 2: Run prompt tests and verify RED**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: FAIL because prompt language currently follows configuration but not
the frozen appliance placement.

- [ ] **Step 3: Implement microwave placement language**

Add a helper that locates `microwaveOvenCombo` in `snapshot.floorPlan`.

- If `onPeninsula`, describe an integrated under-counter microwave or microwave
  drawer in the peninsula base cabinet and forbid a tall/upper cabinet there.
- If `onIsland`, use the same rule for the island base cabinet.
- If configured as `MICROWAVE_DRAWER`, require a base-cabinet drawer appliance.
- If configured as `WALL_OVEN_MICROWAVE_STACK`, require one tall cabinet with
  microwave above wall oven.
- If configured as `UPPER_CABINET_MICROWAVE`, require an upper wall cabinet.
- If configured as `COUNTERTOP_MICROWAVE`, require a freestanding countertop
  appliance and forbid enclosing it as a built-in.

Placement from the frozen floor plan overrides generic standalone-microwave
wording, but never overrides the stacked-appliance configuration because the
geometry no longer permits that stack on an island or peninsula.

- [ ] **Step 4: Run prompt tests and verify GREEN**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: PASS.

### Task 4: Regression verification

**Files:**
- Preserve all existing modified files

- [ ] **Step 1: Run focused regression tests**

```bash
npm test -- \
  src/features/round1/rendering-prompt.test.ts \
  src/features/round1/floorplan/spatial-language.test.ts \
  src/features/round1/floorplan/plan-geometry.test.ts \
  src/features/round1/layout-preview.test.tsx \
  src/features/round1/full-flow.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

```bash
npm test
```

Expected: all non-eval tests pass; the existing live eval remains skipped.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: compilation, linting, type checking, and static generation succeed.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git status --short
```

Confirm the pre-existing peninsula work remains present and no unrelated file
is reverted or staged.

