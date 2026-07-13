# Cabinet Span Rebalancing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate only valid 9-inch-or-wider ordinary cabinets while selecting the smallest practical 3–6-inch filler around immutable appliances, openings, and corners.

**Architecture:** Replace the greedy residual calculation for ordinary spans with a small standard-width partition solver. Keep the staged sink-anchor changes intact: they make a centered sink a redistribution boundary. Apply the same minimum-width guard after window/hood cuts in the upper projection, treating seam alignment as a preference instead of permission to create a small upper cabinet.

**Tech Stack:** TypeScript, Vitest, deterministic Round 2 model/autofill solver.

## Global Constraints

- Fixed appliances, windows, doors, and corner reservations are immutable anchors; the autofill solver must not resize them.
- Both base and ordinary upper cabinets have a minimum width of 9 inches.
- Fillers are permitted only from 3 through 6 inches, with 3 inches preferred.
- The 03 Drawings & Review projection continues to use the same deterministic model produced for 02 Design Proposal.
- Preserve the user-staged sink-anchor and re-centering changes; do not unstage, discard, or overwrite them.

---

## File Structure

- Modify: `src/features/round2/model/autofill.ts` — select standard cabinet partitions and classify post-cut upper slivers correctly.
- Modify: `src/features/round2/model/autofill.test.ts` — prove base-span and upper-projection choices, appliance preservation, and blocking behavior.
- Modify: `src/features/round2/model/adjustments.ts` — retain the staged anchored-sink boundary behavior while accepting the solver output.
- Modify: `src/features/round2/model/adjustments.test.ts` — retain staged coverage for the anchored-sink adjustment behavior.

### Task 1: Standard-width base span partitioning

**Files:**

- Modify: `src/features/round2/model/autofill.ts:20-30,506-565`
- Test: `src/features/round2/model/autofill.test.ts`

**Interfaces:**

- Consumes: `CABINET_STANDARDS.base.widthsSixteenths`, `CABINET_STANDARDS.filler`, and the `fillSpan` arguments.
- Produces: `fillSpan` emits ordinary standard-width cabinets plus either no filler or one 3–6-inch filler; an unsolvable span remains a blocking gap.

- [ ] **Step 1: Write failing tests**

Add tests that prove a 42-inch ordinary base span uses standard cabinets with no filler, a 43-inch span uses one 4-inch filler rather than two fillers, and a span that cannot leave 0 or 3–6 inches emits a blocking gap.

```ts
test("repartitions a seven-inch residual into one valid filler", () => {
  const filled = autofillRound2Model(modelWithWall(wallWithLength(43 * 16)));
  const base = baseTier(filled.walls[0]);

  expect(base.filter((segment) => segment.kind === "filler")).toEqual([
    expect.objectContaining({ widthSixteenths: 4 * 16 })
  ]);
  expect(base.filter((segment) => segment.kind === "cabinet").map((segment) => segment.widthSixteenths)).toEqual([24 * 16, 15 * 16]);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: FAIL because the greedy implementation produces a 36-inch cabinet and two fillers (3 inches and 4 inches) for 43 inches.

- [ ] **Step 3: Implement the partition solver**

Replace the greedy `while` loop in `fillSpan` with a helper that searches `CABINET_STANDARDS.base.widthsSixteenths` for an exact cabinet total leaving, in preference order, 0, 3, 4, 5, or 6 inches. For equal leftovers, prefer fewer cabinets, then wider cabinet widths. Return `null` when no valid target is reachable; call the existing blocking-gap decision path rather than splitting a residual beyond 6 inches.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: PASS with all autofill tests green.

### Task 2: Upper post-cut minimum-width enforcement

**Files:**

- Modify: `src/features/round2/model/autofill.ts:716-959`
- Test: `src/features/round2/model/autofill.test.ts`

**Interfaces:**

- Consumes: the post-cut `Piece` stream from `deriveUpperTier` and fixed-point appliance metadata.
- Produces: every ordinary upper is at least 9 inches; post-window fragments of 3–6 inches are fillers, and fragments below 3 inches become blocking gaps.

- [ ] **Step 1: Write the failing test**

Create a wall with a dishwasher or sink whose seam is cut by a window into a 6-inch upper fragment. Assert that the upper tier contains a 6-inch filler at that location and contains no ordinary upper cabinet below 9 inches.

```ts
expect(uppers).toContainEqual(
  expect.objectContaining({ kind: "filler", widthSixteenths: 6 * 16 })
);
expect(
  uppers.some(
    (segment) =>
      segment.kind === "cabinet" && segment.widthSixteenths < 9 * 16
  )
).toBe(false);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: FAIL because the appliance projection currently maps the 6-inch cut directly to an ordinary upper cabinet.

- [ ] **Step 3: Implement the upper-piece guard**

In `mapBaseToUpperPiece`, classify every non-hood, non-tall ordinary upper candidate narrower than `MIN_CABINET_WIDTH_SIXTEENTHS` as `filler` before returning its cabinet piece. Let `residualSegments` emit a valid 3–6-inch filler or a blocking gap, preserving the window, appliance, hood, and tall-unit anchors unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: PASS with all autofill tests green.

### Task 3: Integration verification with staged anchor behavior

**Files:**

- Modify: `src/features/round2/model/adjustments.ts` only if the solver exposes an incompatibility with the staged anchor boundary behavior.
- Test: `src/features/round2/model/adjustments.test.ts`

**Interfaces:**

- Consumes: the user-staged `anchored` field, `recenterSink`, and updated autofill output.
- Produces: appliance width and centered sink placement remain unchanged while adjacent ordinary cabinets/fillers rebalance.

- [ ] **Step 1: Run existing anchor tests before integration changes**

Run: `npm test -- src/features/round2/model/adjustments.test.ts src/features/round2/model/autofill.test.ts`

Expected: the staged anchor tests either pass or identify an exact solver interaction to repair.

- [ ] **Step 2: Add an integration assertion**

Extend the appliance-reservation test so the dishwasher/range/sink widths equal their standards after span rebalancing, and an anchored sink remains centered under its measured window.

```ts
expect(appliance.segment.widthSixteenths).toBe(
  CABINET_STANDARDS.appliances.dishwasher.defaultWidthSixteenths
);
expect(sink.segment.anchored).toBe(true);
```

- [ ] **Step 3: Run the model suites and static checks**

Run: `npm test -- src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts && npx tsc --noEmit && npm run build`

Expected: every listed test passes, TypeScript exits 0, and the production build exits 0.

- [ ] **Step 4: Commit the integrated result**

Run: `git add src/features/round2/model/autofill.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.ts src/features/round2/model/adjustments.test.ts src/features/round2/model/round2-model.ts src/features/round2/round2-state.ts src/features/round2/round2-types.ts src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx docs/superpowers/plans/2026-07-10-cabinet-span-rebalancing.md`

Run: `git commit -m "fix: rebalance cabinet span fillers"`
