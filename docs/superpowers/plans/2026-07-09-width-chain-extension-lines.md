# Width-chain Extension Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every horizontal width dimension in a Round 2 wall elevation use clearly visible, 8-unit endpoint extension lines.

**Architecture:** Keep the existing SVG structure and coordinate system intact. Add one shared constant in the elevation renderer, then use it for the overall guide and each width-chain guide variant so ordinary, corner-return, and corner-breakdown dimensions remain visually consistent.

**Tech Stack:** React 19, TypeScript, SVG, Vitest, React server rendering.

## Global Constraints

- Endpoint extension length is exactly 8 SVG units.
- Horizontal guide span, label placement, labels, colours, and stroke widths do not change.
- Vertical height dimensions and cabinet geometry do not change.

---

## File Structure

- Modify: `src/features/round2/proposal/wall-elevation.tsx` — defines the shared extension constant and applies it to all horizontal width-chain SVG paths.
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx` — proves above, below, overall, and corner-breakdown guides use the extended endpoint length.

### Task 1: Width-chain endpoint extensions

**Files:**

- Modify: `src/features/round2/proposal/wall-elevation.test.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.tsx`

**Interfaces:**

- Consumes: the existing `WallElevation` renderer and `data-chain-guide` / `data-corner-breakdown-guide` SVG attributes.
- Produces: all horizontal dimension-chain endpoint strokes extend 8 SVG units toward their associated cabinet run.

- [x] **Step 1: Write the failing test**

Add this test after `draws width-chain guide linework for unstaggered upper and lower labels`:

```ts
test("extends every horizontal dimension guide endpoint by eight SVG units", () => {
  const html = renderCornerModel("A", { includeUpperCorner: true });

  expect(tagFor(html, "path", 'data-chain-guide="overall"')).toContain("V 37");
  expect(tagFor(html, "path", 'data-chain-guide="a-upper-corner-ls"')).toMatch(/V 55/);
  expect(tagFor(html, "path", 'data-chain-guide="a-corner-ls"')).toMatch(/V 350/);
  expect(tagFor(html, "path", 'data-corner-breakdown-guide="a-upper-corner-ls"')).toMatch(/V 77/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: FAIL because current ordinary and corner horizontal width-chain endpoints only extend 4 SVG units.

- [x] **Step 3: Write minimal implementation**

In `src/features/round2/proposal/wall-elevation.tsx`, add the shared constant alongside `DIMENSION_STROKE_WIDTH`:

```ts
const WIDTH_CHAIN_EXTENSION_LENGTH = 8;
```

Replace the literals that define endpoint extension strokes for the overall guide, both `data-chain-guide={segment.id}` branches, and `data-corner-breakdown-guide={segmentId}` with `WIDTH_CHAIN_EXTENSION_LENGTH`. Preserve direction: above-run guides use `guideY + WIDTH_CHAIN_EXTENSION_LENGTH`; below-run guides use `guideY - WIDTH_CHAIN_EXTENSION_LENGTH`. Update the upper-chain clearance assertion to require its endpoint to remain above `ceilingLineY(html)`; the longer endpoint is y=55 while the ceiling is y=62.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: PASS with all `WallElevation` tests green.

- [x] **Step 5: Run focused static checks**

Run: `npx tsc --noEmit && npm run build`

Expected: both commands exit with status 0.

- [ ] **Step 6: Validate the rendered page**

Open `http://localhost:3000/projects/c2efc764-016d-4d61-b81f-6a3f86f2ed8a/round2`, select each wall tab, and confirm every horizontal width dimension has visibly longer endpoint extensions without overlap or clipping at desktop and a mobile viewport.

- [x] **Step 7: Commit**

Run: `git add src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx docs/superpowers/plans/2026-07-09-width-chain-extension-lines.md`

Run: `git commit -m "fix: extend width dimension chain endpoints"`

### Task 2: Proposal elevation label suppression

**Files:**

- Modify: `src/features/round2/proposal/wall-elevation.test.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.tsx`
- Modify: `ai_ctx.md`

**Interfaces:**

- Consumes: `WallElevation`'s existing segment rendering, semantic appliance glyphs, and the shared Round 2 project context.
- Produces: the 02 Design Proposal elevation hides cabinet numbers/codes and appliance codes such as `RNG30` and `DW24`; appliance glyphs and semantic role tags remain visible. The 03 drawing-sheet output remains unchanged.

- [x] **Step 1: Write the failing tests**

Replace the two `data-display-label` assertions in the F-coded filler and narrow filler tests with `not.toContain("data-display-label=")`. Add this focused test after `identifies appliance cabinets with glyphs and role tags`:

```ts
test("hides cabinet and appliance codes in the proposal elevation", () => {
  const html = render(
    elevationModel([
      { ...cabinet("cabinet-one", 36 * 16), code: "#1", label: "#1" },
      { ...cabinet("range", 30 * 16, "appliance"), code: "RNG30", label: "RNG30" },
      { ...cabinet("dishwasher", 24 * 16, "appliance"), code: "DW24", label: "DW24" }
    ])
  );

  expect(html).not.toContain("data-display-label=");
  expect(html).not.toContain(">#1</text>");
  expect(html).not.toContain(">RNG30</text>");
  expect(html).not.toContain(">DW24</text>");
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: FAIL because the proposal elevation still emits `data-display-label` text for cabinet and appliance codes.

- [x] **Step 3: Write the minimal implementation**

In `src/features/round2/proposal/wall-elevation.tsx`, remove the proposal-only in-box label calculation and its `data-display-label` text block. Remove the now-unused `IN_BOX_LABEL_CHAR_PX`, `IN_BOX_LABEL_PADDING_PX`, `segmentDisplayLabel`, and `compactLabelCandidates` helpers. Keep the `ApplianceGlyph` and the existing `data-role-tag` semantic role text. Do not change `src/features/round2/drawings/drawing-sheet.tsx`.

In `ai_ctx.md`, retain the Round 2 appliance identity context and state explicitly that the 02 Design Proposal workspace hides cabinet numbers/codes (including `RNG30` and `DW24`) while 03 Drawings & Review is the stage that exposes them.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/features/round2/proposal/wall-elevation.test.tsx`

Expected: PASS with all `WallElevation` tests green.

- [x] **Step 5: Run static checks and build**

Run: `npx tsc --noEmit && npm run build`

Expected: both commands exit with status 0.

- [ ] **Step 6: Validate the rendered workflow**

Open `http://localhost:3000/projects/c2efc764-016d-4d61-b81f-6a3f86f2ed8a/round2`. Verify that the 02 elevation shows cabinet faces, appliance glyphs, dimensions, and role tags but no cabinet numbers, `RNG30`, or `DW24`; confirm that entering the 03 Drawings & Review output still shows the cabinet codes.

- [x] **Step 7: Commit**

Run: `git add src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx ai_ctx.md docs/superpowers/plans/2026-07-09-width-chain-extension-lines.md`

Run: `git commit -m "fix: hide proposal cabinet codes"`
