# Confirmed Cabinet Dimensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authoritative DOCX values the complete Phase 6 standard set and remove all guessed appliance widths.

**Architecture:** `CABINET_STANDARDS` keeps only validated nominal layout data in sixteenths. Autofill consumes explicit appliance definitions, uses customer-provided fixed-point widths when present, ignores hood as a base reservation, and emits a blocking decision instead of guessing widths for oven/microwave or unsupported symbols.

**Tech Stack:** TypeScript 5, Zod 3, Vitest 3, Next.js 15

---

### Task 1: Lock the confirmed standards contract with failing tests

**Files:**
- Modify: `src/features/round2/model/cabinet-standards.test.ts`

- [x] **Step 1: Replace the affected value assertions**

Assert the following exact shapes:

```ts
expect(CABINET_STANDARDS.base).toEqual({
  widthsSixteenths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(
    (value) => value * 16
  ),
  heightSixteenths: 34 * 16 + 8,
  doorRule: {
    singleDoorMaxSixteenths: 21 * 16,
    doubleDoorMinSixteenths: 24 * 16
  }
});
expect(CABINET_STANDARDS.upper).toEqual({
  standardHeightsSixteenths: [30, 36, 40, 42].map(
    (value) => value * 16
  ),
  hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
    (value) => value * 16
  ),
  refrigeratorHeightsSixteenths: [12, 15, 18, 21, 24].map(
    (value) => value * 16
  )
});
expect(CABINET_STANDARDS.vertical).toEqual({
  countertopThicknessSixteenths: 1 * 16 + 8,
  finishedCounterHeightSixteenths: 36 * 16,
  backsplashMinSixteenths: 18 * 16,
  flatMoulding: {
    minSixteenths: 2 * 16,
    preferredSixteenths: 3 * 16,
    maxSixteenths: 3 * 16
  }
});
expect(CABINET_STANDARDS.filler).toEqual({
  minSixteenths: 12,
  preferredSixteenths: 3 * 16,
  commonWidthsSixteenths: [3, 4, 5, 6].map((value) => value * 16)
});
expect(CABINET_STANDARDS.corner).toEqual({
  lazySusan: {
    widthOptionsSixteenths: [33, 36].map((value) => value * 16),
    heightSixteenths: 34 * 16 + 8,
    depthSixteenths: 24 * 16
  },
  blindBase: {
    widthOptionsSixteenths: [39, 42, 45].map((value) => value * 16),
    heightSixteenths: 34 * 16 + 8,
    depthSixteenths: 24 * 16,
    adjacentWallPullSixteenths: 3 * 16
  }
});
```

Assert all four appliances use a common option/default shape:

```ts
expect(CABINET_STANDARDS.appliances).toEqual({
  dishwasher: {
    widthOptionsSixteenths: [24 * 16],
    defaultWidthSixteenths: 24 * 16,
    labelPrefix: "DW",
    customerProvided: true
  },
  range: {
    widthOptionsSixteenths: [30, 33].map((value) => value * 16),
    defaultWidthSixteenths: 30 * 16,
    labelPrefix: "RNG",
    customerProvided: true
  },
  sinkBase: {
    widthOptionsSixteenths: [30, 33, 36, 39].map(
      (value) => value * 16
    ),
    defaultWidthSixteenths: 36 * 16,
    labelPrefix: "SB",
    customerProvided: true
  },
  refrigerator: {
    widthOptionsSixteenths: [36 * 16],
    defaultWidthSixteenths: 36 * 16,
    labelPrefix: "REF",
    customerProvided: true
  }
});
```

Add a schema test that changes `finishedCounterHeightSixteenths` to 35 inches and expects `Base height plus countertop thickness must equal finished counter height`. Existing appliance default-option validation must iterate over all four appliance definitions.

- [x] **Step 2: Run the standards test and verify RED**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts
```

Expected: FAIL on the old height semantics, upper options, filler minimum, corner shape, appliance shape, and fallback field.

### Task 2: Implement the confirmed standards schema

**Files:**
- Modify: `src/features/round2/model/cabinet-standards.ts`

- [x] **Step 1: Replace the old schema fields**

Add `base.heightSixteenths`; replace `vertical.counterHeightSixteenths` with `countertopThicknessSixteenths` and `finishedCounterHeightSixteenths`; add `filler.commonWidthsSixteenths`; replace both corner single-width shapes with `widthOptionsSixteenths`.

Replace the appliance schema with:

```ts
const applianceSchema = z.object({
  widthOptionsSixteenths: ascendingDimensionsSchema,
  defaultWidthSixteenths: dimensionSchema,
  labelPrefix: z.string().min(1),
  customerProvided: z.literal(true)
}).strict();
```

Use this schema for dishwasher, range, sink base, and refrigerator. Delete `fallbackWidthSixteenths`.

- [x] **Step 2: Add cross-field validation**

Validate:

```ts
if (
  standards.base.heightSixteenths +
    standards.vertical.countertopThicknessSixteenths !==
  standards.vertical.finishedCounterHeightSixteenths
) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      "Base height plus countertop thickness must equal finished counter height",
    path: ["vertical", "finishedCounterHeightSixteenths"]
  });
}
```

Loop over `dishwasher`, `range`, `sinkBase`, and `refrigerator`; for each definition, require its default to occur in its width options.

- [x] **Step 3: Replace the checked-in values**

Use exactly the values asserted in Task 1, including the question-marked 42-inch standard upper and 24-inch hood upper confirmed by the user.

- [x] **Step 4: Run the standards test and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts
```

Expected: all standards tests pass.

### Task 3: Remove appliance fallback behavior

**Files:**
- Modify: `src/features/round2/model/autofill.test.ts`
- Modify: `src/features/round2/model/autofill.ts`
- Modify: `src/features/round2/model/adjustments.test.ts`

- [x] **Step 1: Add failing autofill tests**

Update known-appliance expectations to read each definition's default and label prefix. Add:

```ts
test("uses a customer-provided fixed-point width over the default", () => {
  const wall = wallWithAppliance("range", 33 * 16);
  const filled = autofillRound2Model(modelWithWall(wall));
  const range = filled.walls[0].segments.find(
    (segment) => segment.sourceFixedPointId === "fixed-range"
  );

  expect(range).toMatchObject({
    widthSixteenths: 33 * 16,
    label: "RNG33"
  });
});

test("does not reserve base width for a hood", () => {
  const filled = autofillRound2Model(
    modelWithWall(wallWithAppliance("hood"))
  );

  expect(
    filled.walls[0].segments.some(
      (segment) => segment.sourceFixedPointId === "fixed-hood"
    )
  ).toBe(false);
  expect(filled.decisionItems).toHaveLength(0);
});

test.each(["oven", "microwave"])(
  "blocks %s autofill when no customer width is available",
  (symbol) => {
    const filled = autofillRound2Model(
      modelWithWall(wallWithAppliance(symbol))
    );

    expect(
      filled.walls[0].segments.some(
        (segment) => segment.sourceFixedPointId === `fixed-${symbol}`
      )
    ).toBe(false);
    expect(filled.decisionItems).toContainEqual(
      expect.objectContaining({
        objectId: `fixed-${symbol}`,
        severity: "blocking",
        title: "Appliance width required"
      })
    );
  }
);
```

Add a `wallWithAppliance(symbol, widthSixteenths?)` helper that creates a 120-inch wall with one appliance fixed point at ratio 0.5.

Change the filler-warning test to expect `3/4` instead of `1/2`. Update the adjustment decision test to expect the same configured minimum wording.

- [x] **Step 2: Run autofill and adjustment tests and verify RED**

Run:

```bash
npm test -- src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts
```

Expected: FAIL because known definitions still use the old shape, hood uses the fallback, oven/microwave silently receive 30 inches, and warning text still says 1/2 inch.

- [x] **Step 3: Implement explicit appliance mapping**

Make `applianceStandard` return `{ widthSixteenths; label } | null`. Use `point.widthSixteenths` when positive; otherwise use the explicit definition default for sink/range/fridge/dishwasher. Build labels as `${labelPrefix}${widthSixteenths / 16}`. Return `null` for hood, oven, microwave, and unsupported symbols with no supplied width.

Filter null entries from `applianceReservations`. Before filling each wall, add one blocking decision for every non-hood appliance point that has neither an explicit definition nor a positive customer-provided width:

```ts
{
  id: `decision-${point.id}-appliance-width`,
  objectId: point.id,
  wallId: wall.id,
  severity: "blocking",
  title: "Appliance width required",
  body: `${point.label} needs a customer-confirmed width before autofill.`
}
```

Use `formatSixteenths(CABINET_STANDARDS.filler.minSixteenths)` in autofill and adjustment warning bodies instead of a hardcoded fraction.

- [x] **Step 4: Run focused model tests and verify GREEN**

Run:

```bash
npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts src/features/round2/round2-state.test.ts
```

Expected: all selected tests pass.

### Task 4: Synchronize documentation and verify

**Files:**
- Modify: `todo.md`
- Modify: `docs/superpowers/plans/2026-07-06-confirmed-cabinet-dimensions.md`

- [x] **Step 1: Replace superseded Phase 6 values**

Document the confirmed height semantics, 30/36/40/42 standard uppers, confirmed hood and refrigerator-upper options, 3/4-inch filler minimum and common widths, corner option sets, customer-provided appliance options, and absence of an unknown fallback.

- [x] **Step 2: Correct future solver requirements**

In Phase 8, consume the selected lazy-Susan width (33 or 36) on both walls and the selected blind-base width (39, 42, or 45) plus its 3-inch adjacent pull. Replace the filler 1/2-inch threshold with 3/4 inch.

- [x] **Step 3: Audit obsolete fields and values**

Run:

```bash
rg -n "fallbackWidthSixteenths|counterHeightSixteenths|cabinetEnvelopeWidthSixteenths|modelNominalWidthSixteenths|minSixteenths: 8|narrower than 1/2" src/features/round2 todo.md
```

Expected: no obsolete Phase 6 field, fallback, or old filler wording remains.

- [x] **Step 4: Run fresh full verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all tests pass, TypeScript exits 0, and the production build exits 0.

- [x] **Step 5: Review and commit**

Run `git diff --check`, inspect the complete diff, and commit:

```bash
git commit -m "fix(round2): apply confirmed cabinet dimensions"
```
