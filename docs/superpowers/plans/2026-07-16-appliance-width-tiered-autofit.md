# Appliance-width tiered autofit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Technical Design appliance widths on configured `APPLIANCE WIDTH` options while automatically reducing sink bases before ranges when a base run overflows.

**Architecture:** Replace proportional appliance scaling in `autofill.ts` with a reservation-level tier reducer that derives its allowed widths from `CABINET_STANDARDS`. It will preserve fixed points and panels, reflow positions after reductions, and leave unrecoverable overflows on the current blocking path. Proposal controls and reducer validation will share the same standards mapping, so UI and state cannot introduce arbitrary appliance widths.

**Tech Stack:** TypeScript, React, Vitest, Zod-backed cabinet standards.

## Global Constraints

- Appliance widths must always equal a configured `CABINET_STANDARDS.appliances.*.widthOptionsSixteenths` value.
- Autofit priority is every eligible sink base first, then every eligible range; each change is one option lower.
- Refrigerator and dishwasher widths, door/opening reservations, and the existing blocking overflow decision remain unchanged.
- Proposal UI has no custom appliance-width input, and invalid `SET_APPLIANCE_WIDTH` values are no-ops.

---

### Task 1: Replace proportional scaling with standard-width reservation reduction

**Files:**
- Modify: `src/features/round2/model/autofill.ts:532-907`
- Modify: `src/features/round2/model/autofill.test.ts:1012-1072`

**Interfaces:**
- Consumes: `Reservation`, `Round2Wall`, and `CABINET_STANDARDS.appliances` from the existing autofill model.
- Produces: `fitAppliancesToSpan(reservations, fillStart, fillEnd, wall, decisionItems): Reservation[]`, returning unchanged reservations, or re-positioned reservations whose sink/range widths are standard values and fit the span.

- [ ] **Step 1: Write the failing autofill tests**

Replace the current proportional-scaling test with a standard-width test. Use a 120-inch wall containing a 36-inch fridge, 24-inch dishwasher, 36-inch sink, and 33-inch range. Assert the result closes at 120 inches, the sink is 30 inches, range remains 30 or 33 inches according to the minimum number of reductions, all sink/range widths are members of their configured options, and the warning title reads `Wall A appliances reduced to fit`.

Add a second test using a 105-inch wall with a 36-inch fridge, 24-inch dishwasher, 30-inch sink, and 30-inch range. Assert the existing `Fixed reservation exceeds available wall space` blocking decision remains and no `decision-A-appliance-autofit` warning is created.

```ts
expect(sink!.widthSixteenths).toBe(30 * 16);
expect(CABINET_STANDARDS.appliances.sinkBase.widthOptionsSixteenths).toContain(
  sink!.widthSixteenths
);
expect(filled.decisionItems).toContainEqual(
  expect.objectContaining({
    id: "decision-A-appliance-autofit",
    severity: "warning",
    title: "Wall A appliances reduced to fit"
  })
);
```

- [ ] **Step 2: Verify the tests fail for the intended reason**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: the new assertions fail because current `fitAppliancesToSpan` returns proportionally scaled widths and emits `appliances scaled to fit`.

- [ ] **Step 3: Implement the minimal standard-width reducer**

In `autofill.ts`, remove `APPLIANCE_AUTOFIT_TOLERANCE`, `relabelScaledAppliance`, and proportional calculations. Add a symbol-to-standard helper and a loop that:

```ts
for (const symbol of ["sink", "range"] as const) {
  while (totalWidth(reduced) > span) {
    const candidate = firstReservationWithNextSmallerOption(reduced, symbol);
    if (!candidate) break;
    candidate.width = nextSmallerConfiguredWidth(candidate);
    candidate.desiredStart = candidate.desiredStart;
  }
}
```

Account for bundled side panels by changing only the appliance body portion of `Reservation.width`; retain panel widths exactly. Re-sort by original desired start, lay the reservations out from `fillStart`, and issue `decision-${wall.id}-appliance-autofit` only when the reduced widths fit. Its title must be `Wall ${wall.label} appliances reduced to fit` and its body must name the selected standard appliance labels. If no more configured reduction exists, return the original reservations so `packReservations` emits the existing blocking decision.

- [ ] **Step 4: Verify the focused autofill suite passes**

Run: `npm test -- src/features/round2/model/autofill.test.ts`

Expected: PASS, including both standard-width and unrecoverable-overflow cases.

- [ ] **Step 5: Commit the completed model change**

```bash
git add src/features/round2/model/autofill.ts src/features/round2/model/autofill.test.ts
git commit -m "fix(round2): reduce appliance widths by standard tiers"
```

### Task 2: Restrict proposal editing and state changes to configured widths

**Files:**
- Modify: `src/features/round2/round2-state.ts:457-522`
- Modify: `src/features/round2/round2-state.test.ts:323-416`
- Modify: `src/features/round2/proposal/wall-elevation.tsx:1804-2000`
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx:596-656`

**Interfaces:**
- Consumes: selected appliance segment, owning wall fixed point, and `CABINET_STANDARDS.appliances`.
- Produces: `SET_APPLIANCE_WIDTH` applies only configured options; `SegmentEditorCard` exposes only corresponding option buttons.

- [ ] **Step 1: Write the failing state and UI tests**

In `round2-state.test.ts`, dispatch `SET_APPLIANCE_WIDTH` for a range with `31 * 16` and assert strict identity (`expect(result).toBe(seeded)`). Preserve the existing success test but use an allowed refrigerator option or update the fixture to a sink/range value from its configured options.

In `wall-elevation.test.tsx`, update the appliance editor assertion to require the expected width-chip labels and assert it does not contain `aria-label="Custom appliance width"`.

```ts
const invalid = reduceRound2Prototype(seeded, {
  type: "SET_APPLIANCE_WIDTH",
  objectId: range.id,
  widthSixteenths: 31 * 16
});
expect(invalid).toBe(seeded);
expect(applianceEditor).not.toContain('aria-label="Custom appliance width"');
```

- [ ] **Step 2: Verify the tests fail for the intended reason**

Run: `npm test -- src/features/round2/round2-state.test.ts src/features/round2/proposal/wall-elevation.test.tsx`

Expected: the invalid state update changes the model under the current numeric clamp, and the rendered card contains the custom width field.

- [ ] **Step 3: Validate state against standards and remove the custom field**

In `round2-state.ts`, replace the `MIN_APPLIANCE_WIDTH_SIXTEENTHS` / `MAX_APPLIANCE_WIDTH_SIXTEENTHS` clamp with a helper that maps the fixed-point symbol to its appliance standard and tests `widthOptionsSixteenths.includes(widthSixteenths)`. Return the original state when the symbol is unknown or the width is not an allowed option.

In `wall-elevation.tsx`, keep `applianceWidthOptions` as the rendering source and delete the `InchField` with `ariaLabel="Custom appliance width"`. Do not alter ordinary cabinet custom-width behavior.

- [ ] **Step 4: Verify focused state and UI suites pass**

Run: `npm test -- src/features/round2/round2-state.test.ts src/features/round2/proposal/wall-elevation.test.tsx`

Expected: PASS; allowed options still reflow the proposal and invalid widths are ignored.

- [ ] **Step 5: Commit the completed interaction change**

```bash
git add src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx
git commit -m "fix(round2): restrict appliance width edits to standards"
```

### Task 3: Run integration verification

**Files:**
- Verify only: `src/features/round2/model/autofill.test.ts`
- Verify only: `src/features/round2/round2-state.test.ts`
- Verify only: `src/features/round2/proposal/wall-elevation.test.tsx`

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: fresh evidence that autofit and Proposal behavior meet the approved specification.

- [ ] **Step 1: Run the complete affected test set**

Run: `npm test -- src/features/round2/model/autofill.test.ts src/features/round2/round2-state.test.ts src/features/round2/proposal/wall-elevation.test.tsx`

Expected: PASS with no failing tests.

- [ ] **Step 2: Run static verification**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Inspect the final diff against the approved constraints**

Run: `git diff HEAD~2..HEAD -- src/features/round2/model/autofill.ts src/features/round2/round2-state.ts src/features/round2/proposal/wall-elevation.tsx`

Expected: no proportional width calculation or custom appliance-width input remains; sink-before-range tier reduction and option validation are present.
