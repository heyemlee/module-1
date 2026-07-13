# Source-Calibrated Cabinet Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace assumed upper, moulding, drawer, and corner values with layout-level nominal dimensions verified from the supplied cabinet reference files.

**Architecture:** Keep `CABINET_STANDARDS` as the single immutable layout-geometry table. Expand its upper, vertical, depth, and corner shapes so model designation and actual cabinet envelope remain distinct, while excluding millimetre panel/cut-list data from this layer.

**Tech Stack:** TypeScript 5, Zod 3, Vitest 3, Next.js 15

---

### Task 1: Define the source-calibrated contract with failing tests

**Files:**
- Modify: `src/features/round2/model/cabinet-standards.test.ts`

- [x] **Step 1: Replace assumed-value assertions**

Remove the `drawerStacksSixteenths` assertion. Replace the upper, vertical, depth, and corner assertions with:

```ts
expect(CABINET_STANDARDS.upper).toEqual({
  standardHeightsSixteenths: [30, 36, 40].map((value) => value * 16),
  hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
    (value) => value * 16
  ),
  refrigeratorHeightsSixteenths: [12, 15, 18].map(
    (value) => value * 16
  )
});
expect(CABINET_STANDARDS.vertical).toEqual({
  counterHeightSixteenths: 34 * 16 + 8,
  backsplashMinSixteenths: 18 * 16,
  flatMoulding: {
    minSixteenths: 2 * 16,
    preferredSixteenths: 3 * 16,
    maxSixteenths: 3 * 16
  }
});
expect(CABINET_STANDARDS.depths).toEqual({
  baseSixteenths: 24 * 16,
  upperSixteenths: 12 * 16,
  refrigeratorUpperSixteenths: 24 * 16,
  tallSixteenths: 24 * 16
});
expect(CABINET_STANDARDS.corner).toEqual({
  lazySusan: {
    modelNominalWidthSixteenths: 36 * 16,
    cabinetEnvelopeWidthSixteenths: 39 * 16,
    heightSixteenths: 34 * 16 + 8,
    depthSixteenths: 24 * 16
  },
  blindBase: {
    cabinetEnvelopeWidthSixteenths: 39 * 16,
    heightSixteenths: 34 * 16 + 8,
    depthSixteenths: 24 * 16,
    adjacentWallPullSixteenths: 3 * 16
  }
});
```

Add schema rejection tests:

```ts
test("rejects an invalid flat-moulding range", () => {
  expect(() =>
    cabinetStandardsSchema.parse({
      ...CABINET_STANDARDS,
      vertical: {
        ...CABINET_STANDARDS.vertical,
        flatMoulding: {
          minSixteenths: 3 * 16,
          preferredSixteenths: 2 * 16,
          maxSixteenths: 3 * 16
        }
      }
    })
  ).toThrow("Flat moulding must satisfy min <= preferred <= max");
});

test("rejects a lazy-Susan envelope narrower than its nominal model", () => {
  expect(() =>
    cabinetStandardsSchema.parse({
      ...CABINET_STANDARDS,
      corner: {
        ...CABINET_STANDARDS.corner,
        lazySusan: {
          ...CABINET_STANDARDS.corner.lazySusan,
          cabinetEnvelopeWidthSixteenths: 33 * 16
        }
      }
    })
  ).toThrow("Lazy Susan envelope must cover its nominal model width");
});
```

- [x] **Step 2: Run the standards test and verify RED**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts
```

Expected: FAIL because the production object still exposes `drawerStacksSixteenths`, `upper.heightsSixteenths`, a scalar moulding allowance, and the old corner shape.

### Task 2: Implement the calibrated schema and table

**Files:**
- Modify: `src/features/round2/model/cabinet-standards.ts`

- [x] **Step 1: Replace the affected schema fields**

Remove `base.drawerStacksSixteenths`. Define:

```ts
upper: z.object({
  standardHeightsSixteenths: ascendingDimensionsSchema,
  hoodHeightsSixteenths: ascendingDimensionsSchema,
  refrigeratorHeightsSixteenths: ascendingDimensionsSchema
}).strict(),
vertical: z.object({
  counterHeightSixteenths: dimensionSchema,
  backsplashMinSixteenths: dimensionSchema,
  flatMoulding: z.object({
    minSixteenths: dimensionSchema,
    preferredSixteenths: dimensionSchema,
    maxSixteenths: dimensionSchema
  }).strict()
}).strict(),
corner: z.object({
  lazySusan: z.object({
    modelNominalWidthSixteenths: dimensionSchema,
    cabinetEnvelopeWidthSixteenths: dimensionSchema,
    heightSixteenths: dimensionSchema,
    depthSixteenths: dimensionSchema
  }).strict(),
  blindBase: z.object({
    cabinetEnvelopeWidthSixteenths: dimensionSchema,
    heightSixteenths: dimensionSchema,
    depthSixteenths: dimensionSchema,
    adjacentWallPullSixteenths: dimensionSchema
  }).strict()
}).strict(),
depths: z.object({
  baseSixteenths: dimensionSchema,
  upperSixteenths: dimensionSchema,
  refrigeratorUpperSixteenths: dimensionSchema,
  tallSixteenths: dimensionSchema
}).strict()
```

Extend the top-level `superRefine` with:

```ts
const moulding = standards.vertical.flatMoulding;
if (
  moulding.minSixteenths > moulding.preferredSixteenths ||
  moulding.preferredSixteenths > moulding.maxSixteenths
) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Flat moulding must satisfy min <= preferred <= max",
    path: ["vertical", "flatMoulding"]
  });
}

const lazySusan = standards.corner.lazySusan;
if (
  lazySusan.cabinetEnvelopeWidthSixteenths <
  lazySusan.modelNominalWidthSixteenths
) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Lazy Susan envelope must cover its nominal model width",
    path: ["corner", "lazySusan", "cabinetEnvelopeWidthSixteenths"]
  });
}
```

- [x] **Step 2: Replace the affected checked-in data**

Use exactly the values asserted in Task 1: common uppers 30/36/40 inches, hood uppers 12/15/18/21/24, refrigerator uppers 12/15/18 at 24-inch depth, moulding min/preferred/max 2/3/3, lazy-Susan nominal/envelope 36/39, and both base corner families at 34 1/2-inch height and 24-inch depth.

- [x] **Step 3: Run focused model tests and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts src/features/round2/round2-state.test.ts
```

Expected: all selected test files pass.

### Task 3: Synchronize planning documentation

**Files:**
- Modify: `todo.md`

- [x] **Step 1: Correct Phase 6 values**

Replace the Phase 6 upper-height description with common 30/36/40-inch, hood 12/15/18/21/24-inch, and refrigerator-upper 12/15/18-inch options. Replace the moulding wording with a 2–3-inch range. Replace the lazy-Susan 36-by-36 wording with 36-inch nominal/39-inch envelope, and note that unsupported drawer-stack proportions were removed.

- [x] **Step 2: Correct future Phase 8 corner consumption**

Change both Phase 8 references that say a lazy Susan consumes 36 inches per wall to 39 inches per wall, matching the approved cabinet envelope.

- [x] **Step 3: Update verification metadata**

After final verification, update the validation count at the top of `todo.md` to the fresh Vitest result while keeping the current date and completed Phase 6 status.

### Task 4: Verify and commit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-06-source-calibrated-cabinet-standards.md`

- [x] **Step 1: Audit removed assumptions**

Run:

```bash
rg -n "drawerStacksSixteenths|\\b42\\b|flatMouldingAllowance|wallASixteenths|wallBSixteenths|minCabinetWidthSixteenths" src/features/round2/model todo.md
```

Expected: no obsolete standard fields or 42-inch common-upper rule remain. Test fixtures unrelated to cabinet standards may contain the number 42 and must be evaluated by context.

- [x] **Step 2: Run fresh full verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass, TypeScript exits 0, and the production build exits 0.

- [x] **Step 3: Review and commit**

Run `git diff --check`, inspect the complete diff, and commit only the standards calibration, tests, plan, and `todo.md`:

```bash
git commit -m "fix(round2): calibrate cabinet standards"
```
