# Proposal Wall-overflow Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a red dashed wall boundary, diagonal overflow hatch, and exact overage in editable Proposal elevations while relying on the existing blocking gate to prevent final Technical Design drawings.

**Architecture:** Add a focused geometry helper to `wall-elevation.tsx` that derives the overrun for each elevation tier from its rendered segment widths and measured wall length. A presentation-only SVG component will draw the selected warning treatment at the physical wall end; it does not alter `drawing-sheet.tsx`. The current `hasBlockingDecisions` gates in round-two state remain the source of truth for drawing eligibility.

**Tech Stack:** TypeScript, React SVG, Vitest.

## Global Constraints

- Warning visuals appear only in editable Proposal `WallElevation` output, never in final drawing sheets.
- Every overflow is measured against `wall.lengthSixteenths`; an exactly closed run has no warning.
- The wall end is a red dashed line, the overrun is pale-red diagonal hatch, and the label is `OVER WALL BY +X″`.
- Existing blocking decisions prevent entering Drawings and cannot be resolved by acknowledgement.

---

### Task 1: Render tier-specific proposal overflow warnings

**Files:**
- Modify: `src/features/round2/proposal/wall-elevation.tsx:220-560,760-850`
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx:1-670`

**Interfaces:**
- Consumes: a wall's `lengthSixteenths`, base/upper segment arrays, `VerticalLayout`, and `mirrored` elevation orientation.
- Produces: `resolveRunOverflow(segments, wallLengthSixteenths)` and `<WallOverflowWarning>` SVG output with `data-elevation-layer="wall-overflow"`, `data-overflow-tier`, and `data-overflow-sixteenths` attributes.

- [ ] **Step 1: Write failing visual tests**

Create an overfull elevation fixture whose base segments total 126 inches against a 120-inch measured wall. Render it with `canEdit={true}` and assert the markup includes:

```ts
expect(html).toContain('data-elevation-layer="wall-overflow"');
expect(html).toContain('data-overflow-tier="base"');
expect(html).toContain('data-overflow-sixteenths="96"');
expect(html).toContain("OVER WALL BY +6″");
expect(html).toContain('stroke-dasharray="5 4"');
```

Render the existing exactly closed fixture and assert no `data-elevation-layer="wall-overflow"` exists. Add a mirrored-wall case that asserts the warning's dashed boundary is placed at the left run endpoint rather than the right endpoint.

- [ ] **Step 2: Verify the visual tests fail**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: the new overfull fixture has no `wall-overflow` layer because the component does not yet render one.

- [ ] **Step 3: Implement pure overflow geometry and SVG presentation**

Add a helper beside `ElevationRun`:

```ts
function resolveRunOverflow(
  segments: readonly WallSegment[],
  wallLengthSixteenths: number | null | undefined
): number {
  if (wallLengthSixteenths == null) return 0;
  return Math.max(
    0,
    segments.reduce((sum, segment) => sum + segment.widthSixteenths, 0) -
      wallLengthSixteenths
  );
}
```

Add a separate `WallOverflowWarning` component after the two `ElevationRun` calls. For each tier with positive overrun, calculate `overflowPx = overflowSixteenths / total * RUN_WIDTH`; use `RUN_LEFT + RUN_WIDTH` as the dashed boundary for normal elevations and `RUN_LEFT` for mirrored elevations. Draw a pale-red `pattern` rectangle only on the outside of that boundary, a red dashed vertical boundary line with `strokeDasharray="5 4"`, and an outside `OVER WALL BY +${formatSixteenths(overflowSixteenths)}` label. Use the tier's base/upper vertical bounds so upper and base warnings remain visually separate.

Do not import this component into `src/features/round2/drawings/drawing-sheet.tsx`.

- [ ] **Step 4: Verify the visual suite passes**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: PASS, including normal, overfull, and mirrored cases.

- [ ] **Step 5: Commit the Proposal visualization**

```bash
git add src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx
git commit -m "feat(round2): show proposal wall overflow warnings"
```

### Task 2: Verify final-drawing blocking remains enforced

**Files:**
- Modify: `src/features/round2/round2-state.test.ts:595-620`
- Verify only: `src/features/round2/round2-state.ts:88-103,245-258`
- Verify only: `src/features/round2/drawings/drawing-sheet.tsx`

**Interfaces:**
- Consumes: an overfull model produced by `STEP_CABINET_WIDTH`, `hasBlockingDecisions`, and the existing `SET_TASK`/`RESOLVE_DESIGN_DECISION` guards.
- Produces: regression evidence that an overflow cannot enter Drawings or be acknowledged away, while final sheets contain no proposal-only visual markers.

- [ ] **Step 1: Extend the existing failing-state scenario with exact overflow evidence**

In the existing `hard-gates a blocking overflow` test, assert the blocking decision has `title: "Fixed reservation exceeds available wall space"` and that the attempted `SET_TASK` action leaves the state outside `DRAWINGS`.

```ts
expect(overflowed.model!.decisionItems).toContainEqual(
  expect.objectContaining({
    severity: "blocking",
    title: "Fixed reservation exceeds available wall space"
  })
);
expect(nav.task).not.toBe("DRAWINGS");
```

- [ ] **Step 2: Run the state and drawing verification suites**

Run: `npm test -- src/features/round2/round2-state.test.ts src/features/round2/drawings/drawing-sheet.test.tsx`

Expected: PASS. The existing reducer gate already satisfies the state requirement; drawing-sheet tests remain free of proposal-only overflow markup.

- [ ] **Step 3: Commit the regression assertion**

```bash
git add src/features/round2/round2-state.test.ts
git commit -m "test(round2): cover drawing gate for wall overflow"
```

### Task 3: Final verification

**Files:**
- Verify only: `src/features/round2/proposal/wall-elevation.test.tsx`
- Verify only: `src/features/round2/round2-state.test.ts`
- Verify only: `src/features/round2/drawings/drawing-sheet.test.tsx`

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: fresh evidence that Proposal warnings render and final Technical Design drawings remain locked for overflow.

- [ ] **Step 1: Run affected tests**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/round2-state.test.ts src/features/round2/drawings/drawing-sheet.test.tsx`

Expected: PASS with zero failures.

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Inspect the final scope**

Run: `git diff HEAD~2..HEAD -- src/features/round2/proposal/wall-elevation.tsx src/features/round2/drawings/drawing-sheet.tsx src/features/round2/round2-state.ts`

Expected: overflow graphics are confined to `wall-elevation.tsx`; drawing-sheet and state guard implementations have no warning-rendering changes.
