# Round 2 Cabinet Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Round 2 cabinet-dimension and appliance hardcoding with one deeply readonly, Zod-validated `CABINET_STANDARDS` object consumed by autofill and constrained adjustments.

**Architecture:** A focused model module owns the schema, inferred type, validation refinements, immutable data, and no rendering or state behavior. Autofill and adjustments import the single object directly, and the obsolete model constants are removed once both consumers migrate. All dimensions remain integer sixteenths of an inch.

**Tech Stack:** TypeScript 5, Zod 3, Vitest 3, Next.js 15

---

### Task 1: Add the validated cabinet standards table

**Files:**
- Create: `src/features/round2/model/cabinet-standards.test.ts`
- Create: `src/features/round2/model/cabinet-standards.ts`

- [x] **Step 1: Write the failing standards tests**

Create tests that import the not-yet-existing module and assert:

```ts
expect(cabinetStandardsSchema.parse(CABINET_STANDARDS)).toEqual(
  CABINET_STANDARDS
);
expect(CABINET_STANDARDS.base.widthsSixteenths).toEqual(
  [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((value) => value * 16)
);
expect(CABINET_STANDARDS.base.doorRule).toEqual({
  singleDoorMaxSixteenths: 21 * 16,
  doubleDoorMinSixteenths: 24 * 16
});
expect(CABINET_STANDARDS.base.drawerStacksSixteenths).toEqual([
  [6, 12, 12].map((value) => value * 16),
  [6, 6, 9, 9].map((value) => value * 16)
]);
expect(CABINET_STANDARDS.upper.heightsSixteenths).toEqual(
  [30, 36, 42].map((value) => value * 16)
);
expect(CABINET_STANDARDS.vertical).toEqual({
  counterHeightSixteenths: 34 * 16 + 8,
  backsplashMinSixteenths: 18 * 16,
  flatMouldingAllowanceSixteenths: 3 * 16
});
expect(CABINET_STANDARDS.filler).toEqual({
  minSixteenths: 8,
  preferredSixteenths: 3 * 16
});
expect(CABINET_STANDARDS.depths).toEqual({
  baseSixteenths: 24 * 16,
  upperSixteenths: 12 * 16,
  tallSixteenths: 24 * 16
});
```

Add these remaining assertions:

```ts
expect(CABINET_STANDARDS.corner).toEqual({
  lazySusan: {
    wallASixteenths: 36 * 16,
    wallBSixteenths: 36 * 16
  },
  blindBase: {
    minCabinetWidthSixteenths: 39 * 16,
    adjacentWallPullSixteenths: 3 * 16
  }
});
expect(CABINET_STANDARDS.appliances).toEqual({
  dishwasher: { widthSixteenths: 24 * 16, label: "DW24" },
  range: { widthSixteenths: 30 * 16, label: "RNG30" },
  sinkBase: {
    widthOptionsSixteenths: [30, 33, 36].map((value) => value * 16),
    defaultWidthSixteenths: 36 * 16,
    labelPrefix: "SB"
  },
  refrigerator: { widthSixteenths: 36 * 16, label: "REF36" },
  fallbackWidthSixteenths: 30 * 16
});
expect(Object.isFrozen(CABINET_STANDARDS)).toBe(true);
expect(Object.isFrozen(CABINET_STANDARDS.base.widthsSixteenths)).toBe(true);
expect(Object.isFrozen(CABINET_STANDARDS.appliances.sinkBase)).toBe(true);

expect(() =>
  cabinetStandardsSchema.parse({
    ...CABINET_STANDARDS,
    base: {
      ...CABINET_STANDARDS.base,
      widthsSixteenths: [12 * 16, 9 * 16]
    }
  })
).toThrow();

expect(() =>
  cabinetStandardsSchema.parse({
    ...CABINET_STANDARDS,
    base: {
      ...CABINET_STANDARDS.base,
      doorRule: {
        singleDoorMaxSixteenths: 24 * 16,
        doubleDoorMinSixteenths: 21 * 16
      }
    }
  })
).toThrow();
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts
```

Expected: FAIL because `./cabinet-standards` does not exist.

- [x] **Step 3: Implement the schema and immutable table**

Create `cabinet-standards.ts` with:

```ts
import { z } from "zod";

const dimensionSchema = z.number().int().positive();
const ascendingDimensionsSchema = z
  .array(dimensionSchema)
  .min(1)
  .superRefine((values, context) => {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimensions must be unique and strictly ascending"
        });
        return;
      }
    }
  });
```

Define and export `cabinetStandardsSchema` for the complete nested design shape. Add an object-level refinement requiring `singleDoorMaxSixteenths < doubleDoorMinSixteenths` and requiring each sink default width to occur in its option list.

Define a recursive `DeepReadonly<T>` type and `deepFreeze<T>()` helper that freezes arrays and objects. Export:

```ts
export type CabinetStandards = DeepReadonly<
  z.infer<typeof cabinetStandardsSchema>
>;

export const CABINET_STANDARDS: CabinetStandards = deepFreeze(
  cabinetStandardsSchema.parse({
    base: {
      widthsSixteenths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(
        (value) => value * 16
      ),
      doorRule: {
        singleDoorMaxSixteenths: 21 * 16,
        doubleDoorMinSixteenths: 24 * 16
      },
      drawerStacksSixteenths: [
        [6, 12, 12].map((value) => value * 16),
        [6, 6, 9, 9].map((value) => value * 16)
      ]
    },
    upper: {
      heightsSixteenths: [30, 36, 42].map((value) => value * 16)
    },
    vertical: {
      counterHeightSixteenths: 34 * 16 + 8,
      backsplashMinSixteenths: 18 * 16,
      flatMouldingAllowanceSixteenths: 3 * 16
    },
    filler: {
      minSixteenths: 8,
      preferredSixteenths: 3 * 16
    },
    corner: {
      lazySusan: {
        wallASixteenths: 36 * 16,
        wallBSixteenths: 36 * 16
      },
      blindBase: {
        minCabinetWidthSixteenths: 39 * 16,
        adjacentWallPullSixteenths: 3 * 16
      }
    },
    appliances: {
      dishwasher: { widthSixteenths: 24 * 16, label: "DW24" },
      range: { widthSixteenths: 30 * 16, label: "RNG30" },
      sinkBase: {
        widthOptionsSixteenths: [30, 33, 36].map((value) => value * 16),
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "SB"
      },
      refrigerator: { widthSixteenths: 36 * 16, label: "REF36" },
      fallbackWidthSixteenths: 30 * 16
    },
    depths: {
      baseSixteenths: 24 * 16,
      upperSixteenths: 12 * 16,
      tallSixteenths: 24 * 16
    }
  })
);
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts
```

Expected: the new test file passes with no warnings.

### Task 2: Characterize and migrate autofill

**Files:**
- Modify: `src/features/round2/model/autofill.test.ts`
- Modify: `src/features/round2/model/autofill.ts`

- [x] **Step 1: Add an appliance characterization test**

Add a table-driven test that creates one measured wall per supported appliance symbol and verifies the generated base appliance segment width and label against `CABINET_STANDARDS.appliances`:

```ts
test.each([
  {
    symbol: "dishwasher",
    expected: CABINET_STANDARDS.appliances.dishwasher
  },
  { symbol: "range", expected: CABINET_STANDARDS.appliances.range },
  {
    symbol: "sink",
    expected: {
      widthSixteenths:
        CABINET_STANDARDS.appliances.sinkBase.defaultWidthSixteenths,
      label: `${CABINET_STANDARDS.appliances.sinkBase.labelPrefix}36`
    }
  },
  {
    symbol: "fridge",
    expected: CABINET_STANDARDS.appliances.refrigerator
  }
])("preserves the $symbol appliance reservation", ({ symbol, expected }) => {
  const wall = wallWithLength(120 * 16);
  wall.fixedPoints = [{
    id: `fixed-${symbol}`,
    type: "appliance",
    label: symbol,
    sourceWall: "TOP",
    order: 0,
    positionRatio: 0.5,
    symbol
  }];

  const filled = autofillRound2Model(modelWithWall(wall));
  const appliance = filled.walls[0].segments.find(
    (segment) => segment.tier === "base" && segment.kind === "appliance"
  );

  expect(appliance).toMatchObject(expected);
});
```

This is a characterization test for a refactor: it documents current externally visible behavior before changing the data source. The RED/GREEN proof for the newly introduced behavior belongs to Task 1.

- [x] **Step 2: Run the characterization test and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/autofill.test.ts
```

Expected: PASS, proving the pre-refactor appliance behavior is captured.

- [x] **Step 3: Replace autofill hardcoding**

Import `CABINET_STANDARDS`. Derive the descending greedy-fill list from `base.widthsSixteenths`. Replace the filler threshold with `filler.minSixteenths`, replace the loop minimum with the smallest configured width, and replace appliance width/label branches with lookups in `appliances`.

Keep compatibility aliases only as derived values:

```ts
export const STANDARD_CABINET_WIDTHS_SIXTEENTHS = [
  ...CABINET_STANDARDS.base.widthsSixteenths
].sort((a, b) => b - a);

export const FILLER_MIN_SIXTEENTHS =
  CABINET_STANDARDS.filler.minSixteenths;
```

Unknown appliance symbols use `fallbackWidthSixteenths` and retain `point.label`.

- [x] **Step 4: Run standards and autofill tests and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/autofill.test.ts
```

Expected: both files pass.

### Task 3: Characterize and migrate constrained adjustments

**Files:**
- Modify: `src/features/round2/model/adjustments.test.ts`
- Modify: `src/features/round2/model/adjustments.ts`

- [x] **Step 1: Add a width-options characterization assertion**

Add:

```ts
test("offers exactly the widths from the shared cabinet standards", () => {
  expect(standardWidthOptionsSixteenths()).toEqual(
    CABINET_STANDARDS.base.widthsSixteenths
  );
});
```

Import `CABINET_STANDARDS` and `standardWidthOptionsSixteenths`.

- [x] **Step 2: Run the adjustment test and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/adjustments.test.ts
```

Expected: PASS, proving the existing public width options are captured before the source-only refactor.

- [x] **Step 3: Import the standards object directly**

Change `adjustments.ts` to import `CABINET_STANDARDS` from `./cabinet-standards`. Return a mutable copy of `base.widthsSixteenths` from `standardWidthOptionsSixteenths()` and use `filler.minSixteenths` in decision generation. No reducer or action signature changes.

Once all internal imports are migrated, remove the compatibility aliases from `autofill.ts` and update `autofill.test.ts` to read the standards object directly.

- [x] **Step 4: Run model tests and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts src/features/round2/round2-state.test.ts
```

Expected: all selected files pass.

### Task 4: Audit, document completion, and verify

**Files:**
- Modify: `todo.md`

- [x] **Step 1: Audit duplicate model standards**

Run:

```bash
rg -n "STANDARD_CABINET_WIDTHS|FILLER_MIN|function applianceWidth|function applianceLabel|\\[(9|12|15|18|21|24|27|30|33|36)," src/features/round2/model
```

Expected: no independently maintained standard list, filler constant, or appliance mapping remains outside `cabinet-standards.ts`; numeric values in behavioral fixtures are permitted.

- [x] **Step 2: Mark Phase 6 complete**

Change only the Phase 6 checklist items in `todo.md` from `[ ]` to `[x]`. Preserve all unrelated user edits.

- [x] **Step 3: Run fresh full verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass, TypeScript exits 0, and the production build exits 0.

- [x] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff -- src/features/round2/model/cabinet-standards.ts src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/autofill.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.ts src/features/round2/model/adjustments.test.ts todo.md
```

Expected: no whitespace errors, no unrelated modifications, and every Phase 6 acceptance criterion is represented.

- [x] **Step 5: Commit only Phase 6 files**

Stage the new standards files, the autofill and adjustment migrations, this plan, and the Phase 6 checklist hunks. Do not stage the pre-existing `inch-field` or measurement-workspace changes.

Commit:

```bash
git commit -m "feat(round2): centralize cabinet standards"
```
