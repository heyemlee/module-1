# Round 2 Fast Customer Design Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let designers start a detailed customer proposal from Round 1 defaults, edit appliance dimensions directly in the drawing, and publish only after deterministic geometry and minimum field-confirmation checks pass.

**Architecture:** Keep `Round2PrototypeState.measurements` as the single numeric store and add per-field provenance metadata beside it. Extend the existing deterministic `Round2Model` and autofill path rather than introducing a second appliance/design model; both Field Measurement and the proposal editor dispatch measurement actions into the same reducer. Add a pure publish-preflight module that gates customer publication and supplies concise drawing advisories.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Vitest, Zod, SVG drawing components, existing Round 2 reducer/autofill model.

## Global Constraints

- Round 1 values prefill Round 2 but start as `REFERENCE_ONLY`, never `CONFIRMED`.
- Missing appliance dimensions use common defaults and start as `DEFAULT`.
- Field measurements remain authoritative for walls, openings, and offsets.
- Plan, elevation, dimension chains, and schedules derive from the same `Round2Model`.
- Deterministic code owns dimensions and cabinet geometry; AI does not invent either.
- Draft proposals may use defaults; customer publication must pass the preflight defined in the approved spec.
- Direct drawing edits and Field Measurement must update the same value and provenance record.
- An ordinary base/wall cabinet meeting a wall uses filler only; it does not receive an automatic finished panel on that wall side.
- Sink cabinets have no automatic side panels. Dishwashers, refrigerators, and ranges default to independent left/right 3/4-inch panels that the designer can remove or restore.
- A range and its hood projection always remain the same full width; neither may be clipped to fit.
- Do not add a separate appliance-management module, external catalog dependency, or email-delivery integration.
- Preserve sixteenths of an inch as the internal dimension unit.

---

## File Structure

**New files**

- `src/features/round2/model/measurement-provenance.ts` — source/status types, metadata initialization, and confirmation helpers.
- `src/features/round2/handoff/round1-prefill.ts` — converts a Round 1 snapshot into Round 2 reference measurements and appliance defaults.
- `src/features/round2/model/publish-preflight.ts` — pure blocking/advisory validation for customer publication.
- `src/features/round2/model/panel-rules.ts` — filler/finished-panel semantics and per-appliance side-panel defaults.
- `src/features/round2/proposal/appliance-editor.tsx` — focused contextual editor for appliance dimensions and provenance.
- `src/features/round2/drawings/proposal-notes.tsx` — concise advisory notes derived from preflight.

**Primary modified files**

- `src/features/round2/model/round2-model.ts` — appliance measurement keys/fields and measurement application.
- `src/features/round2/model/cabinet-standards.ts` — full common appliance default/preset table.
- `src/features/round2/model/derive-walls.ts` — retain Round 1 appliance keys and reference dimensions.
- `src/features/round2/round2-types.ts` — provenance state and reducer actions.
- `src/features/round2/round2-state.ts` — prefilled initialization, immediate draft proposal, shared edits, local reflow, and publish action.
- `src/features/round2/measurement/measurement-workspace.tsx` — source/status badges and confirmation actions.
- `src/features/round2/proposal/wall-elevation.tsx` — route appliance selections to the appliance editor.
- `src/features/round2/proposal/proposal-workspace.tsx` — allow designer edits on an available draft proposal.
- `src/features/round2/drawings/drawing-review.tsx` and `drawing-sheet.tsx` — publish preflight UI and proposal notes.
- `src/app/(app)/projects/[projectId]/round2/page.tsx` — include normalized room and fixture values in the Round 1 handoff.

---

### Task 1: Add measurement provenance without replacing the numeric store

**Files:**
- Create: `src/features/round2/model/measurement-provenance.ts`
- Create: `src/features/round2/model/measurement-provenance.test.ts`
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-draft-storage.ts`
- Test: `src/features/round2/round2-state.test.ts`
- Test: `src/features/round2/round2-draft-storage.test.ts`

**Interfaces:**
- Produces: `MeasurementSource`, `MeasurementValueStatus`, `MeasurementMeta`, `Round2MeasurementMeta`, `metaForEdit()`, and `confirmMeasurementMeta()`.
- Extends: `Round2PrototypeState` with `measurementMeta: Round2MeasurementMeta` and `applianceDetails: Record<string, { brand: string; model: string }>`.
- Extends: `EDIT_MEASUREMENT` with optional `source` and `status`; adds `CONFIRM_MEASUREMENT` and `EDIT_APPLIANCE_DETAILS`.

- [ ] **Step 1: Write failing provenance tests**

```ts
test("defaults a field edit to confirmed field measurement", () => {
  expect(metaForEdit()).toEqual({
    source: "FIELD_MEASURED",
    status: "CONFIRMED"
  });
});

test("keeps designer edits unconfirmed until their source is confirmed", () => {
  expect(metaForEdit("DESIGNER_EDIT")).toEqual({
    source: "DESIGNER_EDIT",
    status: "REFERENCE_ONLY"
  });
});

test("confirms a measurement without changing its numeric value", () => {
  const edited = reduceRound2Prototype(stateWithReferenceValue(), {
    type: "CONFIRM_MEASUREMENT",
    field: "wall.A.length",
    source: "FIELD_MEASURED"
  });
  expect(edited.measurements["wall.A.length"]).toBe(1920);
  expect(edited.measurementMeta["wall.A.length"]).toEqual({
    source: "FIELD_MEASURED",
    status: "CONFIRMED"
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/features/round2/model/measurement-provenance.test.ts src/features/round2/round2-state.test.ts`

Expected: FAIL because the provenance module, state field, and confirmation action do not exist.

- [ ] **Step 3: Implement the provenance model**

```ts
export type MeasurementSource =
  | "ROUND1_REFERENCE"
  | "COMMON_DEFAULT"
  | "FIELD_MEASURED"
  | "APPLIANCE_SPEC"
  | "DESIGNER_EDIT";

export type MeasurementValueStatus =
  | "REFERENCE_ONLY"
  | "DEFAULT"
  | "CONFIRMED"
  | "CONFLICT";

export type MeasurementMeta = {
  source: MeasurementSource;
  status: MeasurementValueStatus;
};

export type Round2MeasurementMeta = Record<string, MeasurementMeta>;

export function metaForEdit(
  source: MeasurementSource = "FIELD_MEASURED",
  status?: MeasurementValueStatus
): MeasurementMeta {
  return {
    source,
    status:
      status ??
      (source === "FIELD_MEASURED" || source === "APPLIANCE_SPEC"
        ? "CONFIRMED"
        : source === "COMMON_DEFAULT"
          ? "DEFAULT"
          : "REFERENCE_ONLY")
  };
}

export function confirmMeasurementMeta(
  source: Extract<MeasurementSource, "FIELD_MEASURED" | "APPLIANCE_SPEC">
): MeasurementMeta {
  return { source, status: "CONFIRMED" };
}
```

Update the reducer so `EDIT_MEASUREMENT` writes both maps atomically, `CONFIRM_MEASUREMENT` changes only metadata, and `EDIT_APPLIANCE_DETAILS` updates brand/model text for one fixed-point ID. Normalize restored drafts with both `measurementMeta: action.state.measurementMeta ?? {}` and `applianceDetails: action.state.applianceDetails ?? {}`.

- [ ] **Step 4: Run state and draft-storage tests**

Run: `npm test -- src/features/round2/model/measurement-provenance.test.ts src/features/round2/round2-state.test.ts src/features/round2/round2-draft-storage.test.ts`

Expected: PASS; older saved drafts restore with an empty metadata map.

- [ ] **Step 5: Commit**

```bash
git add src/features/round2/model/measurement-provenance.ts src/features/round2/model/measurement-provenance.test.ts src/features/round2/round2-types.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/round2-draft-storage.ts src/features/round2/round2-draft-storage.test.ts
git commit -m "feat(round2): track measurement provenance"
```

---

### Task 2: Prefill Round 2 from Round 1 and common appliance standards

**Files:**
- Create: `src/features/round2/handoff/round1-prefill.ts`
- Create: `src/features/round2/handoff/round1-prefill.test.ts`
- Modify: `src/features/round2/model/cabinet-standards.ts`
- Modify: `src/features/round2/model/cabinet-standards.test.ts`
- Modify: `src/features/round2/model/round2-model.ts`
- Modify: `src/features/round2/model/round2-model.test.ts`
- Modify: `src/features/round2/model/derive-walls.ts`
- Modify: `src/features/round2/model/derive-walls.test.ts`
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-fixtures.ts`
- Modify: `src/app/(app)/projects/[projectId]/round2/page.tsx`

**Interfaces:**
- Produces: `Round1ReferenceMeasurements`, `buildRound1ReferenceMeasurements(reference, model)`, appliance dimension keys, and the complete default appliance table.
- Consumes: `Round1ReferenceSource.roomDimensions` and `Round1ReferenceSource.applianceDimensions` populated by the server page.

- [ ] **Step 1: Write failing standards and prefill tests**

```ts
test("defines the agreed common appliance defaults", () => {
  expect(CABINET_STANDARDS.appliances.refrigerator.defaultWidthSixteenths).toBe(36 * 16);
  expect(CABINET_STANDARDS.appliances.range.defaultWidthSixteenths).toBe(30 * 16);
  expect(CABINET_STANDARDS.appliances.dishwasher.defaultWidthSixteenths).toBe(24 * 16);
  expect(CABINET_STANDARDS.appliances.wallOven.defaultWidthSixteenths).toBe(30 * 16);
  expect(CABINET_STANDARDS.appliances.cooktop.widthOptionsSixteenths).toEqual([30 * 16, 36 * 16]);
});

test("prefills room geometry as reference and missing appliances as defaults", () => {
  const result = buildRound1ReferenceMeasurements(referenceWithRoomAndFixtures(), model);
  expect(result.values[wallLengthMeasurementKey("A")]).toBe(120 * 16);
  expect(result.meta[wallLengthMeasurementKey("A")]).toEqual({
    source: "ROUND1_REFERENCE",
    status: "REFERENCE_ONLY"
  });
  expect(result.values[applianceWidthMeasurementKey("top-appliance-fridge")]).toBe(36 * 16);
  expect(result.meta[applianceWidthMeasurementKey("top-appliance-fridge")].status).toBe("DEFAULT");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/handoff/round1-prefill.test.ts src/features/round2/model/round2-model.test.ts`

Expected: FAIL because the additional appliance standards, dimension keys, and prefill helper do not exist.

- [ ] **Step 3: Extend the reference contract and server mapping**

Add to `Round1ReferenceSource`:

```ts
roomDimensions: {
  lengthSixteenths: number | null;
  widthSixteenths: number | null;
  ceilingHeightSixteenths: number | null;
};
applianceDimensions: Record<
  string,
  { widthSixteenths: number | null; heightSixteenths: number | null; depthSixteenths: number | null }
>;
```

Populate it in the server page from `snapshot.normalized.room` and `snapshot.showroomForm.fixtures`. Keys must match the Round 1 appliance keys used by `floorPlan.appliances`, such as `fridge`, `range`, `cooktop`, `dishwasher`, `wallOven`, and `microwaveOvenCombo`.

- [ ] **Step 4: Add measurement keys and fields for appliances**

```ts
export function applianceWidthMeasurementKey(id: string): MeasurementKey {
  return `appliance.${id}.width`;
}
export function applianceHeightMeasurementKey(id: string): MeasurementKey {
  return `appliance.${id}.height`;
}
export function applianceDepthMeasurementKey(id: string): MeasurementKey {
  return `appliance.${id}.depth`;
}
```

Extend `MeasurementFieldKind` with `appliance-width`, `appliance-height`, and `appliance-depth`. Width is required for geometry; height is publish-required only for cabinetry-dependent built-ins; depth remains advisory.

- [ ] **Step 5: Implement common defaults and prefill conversion**

Extend `CABINET_STANDARDS.appliances` with refrigerator `[30,33,36,42,48]`, range `[30,36,48]`, cooktop `[30,36]`, dishwasher `[24]`, sink fixture `[33]`, sink base `[30,33,36,39]` with a 36-inch default, wall oven `[27,30]`, microwave/oven combination `[27,30]`, and beverage refrigerator `[15,18,24]`, all converted to sixteenths. Horizontal cabinet packing continues to reserve the sink-base width; the physical sink width is retained for the appliance/spec record and customer notes.

`buildRound1ReferenceMeasurements()` must:

- map TOP/BOTTOM walls to room length and LEFT/RIGHT walls to room width;
- calculate opening offsets from `positionRatio * wall length`;
- use supplied Round 1 appliance dimensions when present;
- otherwise use the matching common default;
- attach `ROUND1_REFERENCE/REFERENCE_ONLY` or `COMMON_DEFAULT/DEFAULT` metadata;
- never mark a prefilled value confirmed.

Its return type is:

```ts
export type Round1ReferenceMeasurements = {
  values: Record<MeasurementKey, number | null>;
  meta: Round2MeasurementMeta;
};
```

- [ ] **Step 6: Run the handoff/model tests**

Run: `npm test -- src/features/round2/model/cabinet-standards.test.ts src/features/round2/handoff/round1-prefill.test.ts src/features/round2/model/round2-model.test.ts src/features/round2/model/derive-walls.test.ts`

Expected: PASS with exact sixteenth-inch values and provenance.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2/handoff/round1-prefill.ts src/features/round2/handoff/round1-prefill.test.ts src/features/round2/model/cabinet-standards.ts src/features/round2/model/cabinet-standards.test.ts src/features/round2/model/round2-model.ts src/features/round2/model/round2-model.test.ts src/features/round2/model/derive-walls.ts src/features/round2/model/derive-walls.test.ts src/features/round2/round2-types.ts src/features/round2/round2-fixtures.ts 'src/app/(app)/projects/[projectId]/round2/page.tsx'
git commit -m "feat(round2): prefill measurements and appliance defaults"
```

---

### Task 3: Generate an immediate draft proposal while keeping customer publication gated

**Files:**
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`
- Modify: `src/features/round2/round2-task-navigation.tsx`
- Modify: `src/features/round2/round2-task-navigation.test.tsx`
- Modify: `src/features/round2/measurement/measurement-workspace.tsx`
- Modify: `src/features/round2/measurement/measurement-workspace.test.tsx`
- Modify: `src/features/round2/proposal/proposal-workspace.tsx`
- Modify: `src/features/round2/proposal/proposal-workspace.test.tsx`

**Interfaces:**
- Consumes: `buildRound1ReferenceMeasurements()` from Task 2.
- Produces: an autofilled `Round2Model` immediately after `ADOPT_BASIS`; `proposalUnlocked()` means draft geometry exists, not that publication is allowed.

- [ ] **Step 1: Write failing workflow tests**

```ts
test("adopting a basis creates a visible draft proposal from reference/default values", () => {
  const state = lock(createRound2PrototypeState("DESIGNER"));
  expect(proposalUnlocked(state)).toBe(true);
  expect(state.model?.walls.some((wall) => wall.segments.length > 0)).toBe(true);
  expect(state.measurementStatus).toBe("DRAFT");
});

test("allows a designer to edit an available draft proposal", () => {
  const html = renderProposal(lock(createRound2PrototypeState("DESIGNER")));
  expect(html).toContain('data-proposal-editable="true"');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/round2/round2-state.test.ts src/features/round2/round2-task-navigation.test.tsx src/features/round2/proposal/proposal-workspace.test.tsx`

Expected: FAIL because adoption currently creates null measurements and no segments.

- [ ] **Step 3: Autofill on basis adoption**

In `lockReference()`:

```ts
const rawModel = deriveWallsFromRound1(reference.floorPlan);
const prefill = buildRound1ReferenceMeasurements(reference, rawModel);
const model = autofillRound2Model(rawModel, prefill.values, initializeDesignIntent(rawModel));

return {
  ...state,
  model,
  measurements: prefill.values,
  measurementMeta: prefill.meta,
  measurementStatus: "DRAFT",
  proposalStatus: hasBlockingDecisions(model) ? "NEEDS_DECISION" : "READY",
  drawingStatus: "DRAFT"
};
```

Keep the first task as Field Measurement, but allow navigation to Design Proposal as soon as segments exist. Drawings remain gated by blocking geometry decisions; publication gets its own stricter gate in Task 7.

- [ ] **Step 4: Update measurement and proposal copy**

- Replace `Lock Round 1 first` with `Round 1 reference unavailable`.
- Replace the primary action with `Confirm field measurements` / `Update proposal`.
- Change proposal editability to `state.role === "DESIGNER" && proposalUnlocked(state)`.
- Add `data-proposal-editable={canEdit}` for focused tests.
- Show `Draft uses reference/default values` while any layout-critical metadata is not confirmed.

- [ ] **Step 5: Run workflow tests**

Run: `npm test -- src/features/round2/round2-state.test.ts src/features/round2/round2-task-navigation.test.tsx src/features/round2/measurement/measurement-workspace.test.tsx src/features/round2/proposal/proposal-workspace.test.tsx`

Expected: PASS; draft proposal is reachable immediately, while measurement state remains DRAFT.

- [ ] **Step 6: Commit**

```bash
git add src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/round2-task-navigation.tsx src/features/round2/round2-task-navigation.test.tsx src/features/round2/measurement/measurement-workspace.tsx src/features/round2/measurement/measurement-workspace.test.tsx src/features/round2/proposal/proposal-workspace.tsx src/features/round2/proposal/proposal-workspace.test.tsx
git commit -m "feat(round2): open immediate draft proposals"
```

---

### Task 4: Edit appliance dimensions directly from the elevation and sync Field Measurement

**Files:**
- Create: `src/features/round2/proposal/appliance-editor.tsx`
- Create: `src/features/round2/proposal/appliance-editor.test.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx`
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`
- Modify: `src/features/round2/measurement/measurement-workspace.tsx`
- Modify: `src/features/round2/measurement/measurement-workspace.test.tsx`

**Interfaces:**
- Produces: `<ApplianceEditor fixedPoint segment measurements measurementMeta dispatch />`.
- Uses: `EDIT_MEASUREMENT` with `source: "DESIGNER_EDIT"` and `CONFIRM_MEASUREMENT` with `FIELD_MEASURED` or `APPLIANCE_SPEC`.

- [ ] **Step 1: Write failing synchronization tests**

```ts
test("editing an appliance in the proposal updates its shared measurement", () => {
  const state = submittedStateWithFridge();
  const field = applianceWidthMeasurementKey("top-appliance-fridge");
  const next = reduceRound2Prototype(state, {
    type: "EDIT_MEASUREMENT",
    field,
    value: 42 * 16,
    source: "DESIGNER_EDIT"
  });
  expect(next.measurements[field]).toBe(42 * 16);
  expect(next.measurementMeta[field].status).toBe("REFERENCE_ONLY");
  expect(findFixedPoint(next.model, "top-appliance-fridge")?.widthSixteenths).toBe(42 * 16);
});

test("renders appliance presets and confirmation actions", () => {
  const html = renderApplianceEditor(fridgeFixture());
  expect(html).toContain("30″");
  expect(html).toContain("36″");
  expect(html).toContain("42″");
  expect(html).toContain("Confirm from appliance spec");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/round2/proposal/appliance-editor.test.tsx src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/round2-state.test.ts`

Expected: FAIL because no appliance editor exists and edits do not reflow the proposal.

- [ ] **Step 3: Implement the focused appliance editor**

The component must show only:

```tsx
<InchField value={width} onChange={editWidth} ariaLabel={`${label} width`} />
<InchField value={height} onChange={editHeight} ariaLabel={`${label} height`} />
<InchField value={depth} onChange={editDepth} ariaLabel={`${label} depth`} />
<PresetChips values={definition.widthOptionsSixteenths} onSelect={editWidth} />
<input value={details.brand} onChange={editBrand} aria-label={`${label} brand`} />
<input value={details.model} onChange={editModel} aria-label={`${label} model`} />
<StatusBadge meta={measurementMeta[widthKey]} />
<button onClick={() => confirm("FIELD_MEASURED")}>Confirm from field measurement</button>
<button onClick={() => confirm("APPLIANCE_SPEC")}>Confirm from appliance spec</button>
```

Brand/model changes dispatch `EDIT_APPLIANCE_DETAILS` into the same Round 2 state. Do not add catalog search, uploads, or manufacturer-specific clearance forms.

- [ ] **Step 4: Route appliance segments to the editor**

In `WallElevation`, resolve `editingSegment.sourceFixedPointId` against the selected wall. Render `ApplianceEditor` when `segment.kind === "appliance"`; keep `SegmentEditorCard` for cabinets, fillers, panels, and intentional gaps.

- [ ] **Step 5: Apply shared appliance measurements to geometry**

Extend `applyMeasurementsToModel()` so appliance width keys update `Round2FixedPoint.widthSixteenths`. An appliance width edit must rerun autofill and update proposal/drawing status; height and depth update the shared store and preflight but do not alter horizontal packing.

- [ ] **Step 6: Add provenance badges to Field Measurement**

Map statuses to short labels:

```ts
const STATUS_LABEL = {
  REFERENCE_ONLY: "Reference only",
  DEFAULT: "Default",
  CONFIRMED: "Confirmed",
  CONFLICT: "Conflict"
} as const;
```

Both proposal and Field Measurement must display the same current value/status after an edit.

- [ ] **Step 7: Run synchronized UI/state tests**

Run: `npm test -- src/features/round2/proposal/appliance-editor.test.tsx src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/measurement/measurement-workspace.test.tsx src/features/round2/round2-state.test.ts`

Expected: PASS; a single reducer value drives both editing surfaces and the reflowed segment.

- [ ] **Step 8: Commit**

```bash
git add src/features/round2/proposal/appliance-editor.tsx src/features/round2/proposal/appliance-editor.test.tsx src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/round2-types.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/measurement/measurement-workspace.tsx src/features/round2/measurement/measurement-workspace.test.tsx
git commit -m "feat(round2): edit appliance dimensions in proposal"
```

---

### Task 5: Correct filler, finished-panel, and hood projection rules

**Files:**
- Create: `src/features/round2/model/panel-rules.ts`
- Create: `src/features/round2/model/panel-rules.test.ts`
- Modify: `src/features/round2/model/design-intent.ts`
- Modify: `src/features/round2/model/design-intent.test.ts`
- Modify: `src/features/round2/model/autofill.ts`
- Modify: `src/features/round2/model/autofill.test.ts`
- Modify: `src/features/round2/model/adjustments.ts`
- Modify: `src/features/round2/model/adjustments.test.ts`
- Modify: `src/features/round2/proposal/wall-elevation.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`

**Interfaces:**
- Produces: `AppliancePanelSide`, `AppliancePanelChoice`, `appliancePanelIntentKey()`, `defaultAppliancePanelChoice()`, and `resolveApplianceSidePanels()`.
- Extends: `DesignIntentValue` with `"present" | "removed"` for per-side appliance panels.
- Consumes: existing `SET_DESIGN_INTENT` action so panel choices remain deterministic and persist with the proposal.

- [ ] **Step 1: Write failing panel-semantics tests**

```ts
test("distinguishes wall filler from a finished panel", () => {
  expect(defaultAppliancePanelChoice("sink", "left")).toBe("removed");
  expect(defaultAppliancePanelChoice("dishwasher", "left")).toBe("present");
  expect(defaultAppliancePanelChoice("fridge", "right")).toBe("present");
  expect(defaultAppliancePanelChoice("range", "left")).toBe("present");
});

test("uses filler without a finished panel where an ordinary cabinet meets a wall", () => {
  const filled = autofillRound2Model(modelWithWall(wallWithLength(121 * 16)));
  for (const tier of ["base", "upper"] as const) {
    const run = filled.walls[0].segments.filter((segment) => segment.tier === tier);
    expect(run.some((segment) => segment.id.includes("endpanel"))).toBe(false);
    expect(run[run.length - 1]?.kind).toBe("filler");
  }
});

test("adds no panels to a sink and two independent panels to dishwasher fridge and range", () => {
  expect(panelSides(filledWall("sink"))).toEqual([]);
  expect(panelSides(filledWall("dishwasher"))).toEqual(["left", "right"]);
  expect(panelSides(filledWall("fridge"))).toEqual(["left", "right"]);
  expect(panelSides(filledWall("range"))).toEqual(["left", "right"]);
});
```

- [ ] **Step 2: Run panel/autofill tests and verify RED**

Run: `npm test -- src/features/round2/model/panel-rules.test.ts src/features/round2/model/autofill.test.ts`

Expected: FAIL because ordinary wall ends currently get panels, range gets none, dishwasher is hard-coded, and sink/panel semantics are not centralized.

- [ ] **Step 3: Implement the centralized panel rules**

```ts
export type AppliancePanelSide = "left" | "right";
export type AppliancePanelChoice = "present" | "removed";

export function appliancePanelIntentKey(
  fixedPointId: string,
  side: AppliancePanelSide
): string {
  return `appliance.${fixedPointId}.panel.${side}`;
}

export function defaultAppliancePanelChoice(
  symbol: string | undefined,
  _side: AppliancePanelSide
): AppliancePanelChoice {
  return symbol === "dishwasher" || symbol === "fridge" || symbol === "range"
    ? "present"
    : "removed";
}
```

`resolveApplianceSidePanels(point, intent)` returns 12 sixteenths (3/4 inch) for each side whose explicit/default choice is `present`, otherwise zero. Remove `dishwasherSidePanels()` and replace `tallSidePanels()` with this one resolver. Oven/microwave tower appliances do not receive extra automatic appliance-side panels under this rule; their containing tall cabinet is modeled separately.

- [ ] **Step 4: Remove automatic ordinary wall-end panels**

Delete the `baseEndPanelSides()` reservation path and the matching automatic upper `startPanel`/`endPanel` path. Full-wall cabinet runs close to the wall with `fillSpan()` output; the terminal remainder remains a `filler`, not `panel`. Explicit appliance panels remain real segments and may be followed by a wall filler:

```text
appliance -> panel -> filler -> wall
```

Do not change corner cabinet reservations; a true corner is neither an open end nor a wall filler.

- [ ] **Step 5: Write and verify per-side removal tests**

```ts
test("removes only the selected dishwasher panel", () => {
  const intent = intentWith({
    [appliancePanelIntentKey("top-appliance-dishwasher", "left")]: "removed"
  });
  const wall = filledWall("dishwasher", intent);
  expect(panelSides(wall)).toEqual(["right"]);
});

test("restores one range panel without changing the opposite choice", () => {
  const removed = intentWith({
    [appliancePanelIntentKey("top-appliance-range", "left")]: "removed",
    [appliancePanelIntentKey("top-appliance-range", "right")]: "removed"
  });
  const restored = setDesignIntentAnswer(
    removed,
    appliancePanelIntentKey("top-appliance-range", "right"),
    "present"
  );
  expect(panelSides(filledWall("range", restored))).toEqual(["right"]);
});
```

Run: `npm test -- src/features/round2/model/panel-rules.test.ts src/features/round2/model/design-intent.test.ts src/features/round2/model/autofill.test.ts`

Expected: PASS; each side is independently deterministic.

- [ ] **Step 6: Add panel controls to the drawing**

When a panel segment with `sourceFixedPointId` is selected, show:

```tsx
<button
  type="button"
  onClick={() => dispatch({
    type: "SET_DESIGN_INTENT",
    key: appliancePanelIntentKey(segment.sourceFixedPointId!, panelSide(segment)),
    value: "removed"
  })}
>
  Remove panel
</button>
```

The owning appliance editor lists both sides and shows `Restore left panel` or `Restore right panel` for removed sides. The selected side must be visible in the editor title and accessible name. Do not reuse `REMOVE_FILLER`; filler removal and appliance-panel removal remain different actions.

- [ ] **Step 7: Prevent clipped range/hood projections**

Add failing coverage first:

```ts
test("never emits a clipped hood when a 30-inch range conflicts with a corner", () => {
  const filled = autofillRound2Model(rangeConflictingWithCorner());
  const range = applianceSegment(filled, "range");
  const hood = hoodSegment(filled);
  expect(range.widthSixteenths).toBe(30 * 16);
  expect(hood).toBeNull();
  expect(filled.decisionItems).toEqual(
    expect.arrayContaining([expect.objectContaining({ severity: "blocking" })])
  );
});

test("keeps a valid cabinet-insert hood exactly equal to range width", () => {
  const filled = autofillRound2Model(validRangeModel());
  expect(hoodSegment(filled)?.widthSixteenths).toBe(
    applianceSegment(filled, "range").widthSixteenths
  );
});
```

Change upper projection so it emits the complete hood only when the complete range interval lies inside the valid run. An invalid fixed reservation creates a blocking decision and no hood projection; it never becomes a narrow cabinet segment. The last-valid drawing behavior is completed in Task 6.

- [ ] **Step 8: Verify panel UI, autofill, and adjustment behavior**

Run: `npm test -- src/features/round2/model/panel-rules.test.ts src/features/round2/model/design-intent.test.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/round2-state.test.ts`

Expected: PASS; no ordinary wall-end panels, correct appliance defaults, independent delete/restore controls, and no clipped hood fragment.

- [ ] **Step 9: Commit**

```bash
git add src/features/round2/model/panel-rules.ts src/features/round2/model/panel-rules.test.ts src/features/round2/model/design-intent.ts src/features/round2/model/design-intent.test.ts src/features/round2/model/autofill.ts src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.ts src/features/round2/model/adjustments.test.ts src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts
git commit -m "fix(round2): separate filler and appliance panel rules"
```

---

### Task 6: Preserve unaffected walls and retain the last valid drawing on failed edits

**Files:**
- Create: `src/features/round2/model/reflow.ts`
- Create: `src/features/round2/model/reflow.test.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`
- Modify: `src/features/round2/proposal/decision-rail.tsx`
- Modify: `src/features/round2/proposal/decision-rail.test.tsx`

**Interfaces:**
- Produces: `reflowForMeasurement(previousModel, measurements, intent, changedKey): ReflowResult`.
- `ReflowResult = { model: Round2Model; changedWallIds: WallId[]; rejectedChange?: { field; message } }`.
- Consumes: per-side panel intent keys from Task 5; a panel edit identifies the owning appliance wall as the affected wall.

- [ ] **Step 1: Write failing local-reflow tests**

```ts
test("reflows an appliance wall without replacing unaffected wall objects", () => {
  const before = filledUShapeModel();
  const result = reflowForMeasurement(before, changedMeasurements(), intent, applianceWidthMeasurementKey("top-fridge"));
  expect(result.changedWallIds).toEqual(["A"]);
  expect(result.model.walls.find((wall) => wall.id === "B")).toBe(
    before.walls.find((wall) => wall.id === "B")
  );
});

test("retains last valid geometry when an edited wall cannot fit", () => {
  const before = filledOneWallModel();
  const result = reflowForMeasurement(before, oversizedFridgeMeasurements(), intent, applianceWidthMeasurementKey("top-fridge"));
  expect(result.model.walls[0].segments).toEqual(before.walls[0].segments);
  expect(result.rejectedChange?.message).toContain("short");
});

test("absorbs a removed panel into the nearest wall filler", () => {
  const before = filledWallWithRangeAndWallFiller();
  const result = reflowForIntent(
    before,
    intentWithLeftRangePanelRemoved(),
    appliancePanelIntentKey("top-appliance-range", "left")
  );
  expect(panelSides(result.model.walls[0])).toEqual(["right"]);
  expect(wallFillerWidth(result.model.walls[0])).toBe(
    wallFillerWidth(before.walls[0]) + 12
  );
});

test("rejects panel restore when no filler or standard repartition can provide 3/4 inch", () => {
  const before = validWallWithRemovedPanelAndNoCapacity();
  const result = reflowForIntent(
    before,
    intentWithPanelRestored(),
    appliancePanelIntentKey("top-appliance-range", "left")
  );
  expect(result.model.walls[0].segments).toEqual(before.walls[0].segments);
  expect(result.rejectedChange?.message).toContain("3/4");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/round2/model/reflow.test.ts src/features/round2/round2-state.test.ts`

Expected: FAIL because reflow currently regenerates the complete model and has no rejected-change result.

- [ ] **Step 3: Implement deterministic affected-wall merging**

`reflowForMeasurement()` and the parallel `reflowForIntent()` must:

1. Parse the changed measurement key to find its wall/fixed point.
2. Run the existing deterministic autofill against an updated model.
3. Detect blocking overflow/overlap decisions for the affected wall.
4. On success, merge only affected wall objects plus global height profile/decisions.
5. On failure, retain the previous wall segments and add one blocking decision whose message states the shortage in formatted inches.

For appliance-panel intent edits, the solver must first transfer the released/required 12 sixteenths to/from the nearest valid wall filler. If that cannot close the wall, attempt standard-cabinet repartition. If neither works, reject the edit and retain the previous wall. It must not create an unexplained 3/4-inch gap.

Ceiling-height edits may update every elevation vertically. Cabinet-width actions continue using the existing targeted adjustment logic.

- [ ] **Step 4: Surface the failed-edit reason**

Add one Decision Rail card with copy shaped like:

```text
Wall A is 2 1/2 in short after changing Refrigerator to 42 in.
Choose a smaller adjacent cabinet, reduce a filler, change the appliance, or remeasure the wall.
```

- [ ] **Step 5: Run reflow and decision tests**

Run: `npm test -- src/features/round2/model/reflow.test.ts src/features/round2/round2-state.test.ts src/features/round2/proposal/decision-rail.test.tsx`

Expected: PASS; unaffected wall references stay stable and invalid edits do not replace the last valid segment chain.

- [ ] **Step 6: Commit**

```bash
git add src/features/round2/model/reflow.ts src/features/round2/model/reflow.test.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/proposal/decision-rail.tsx src/features/round2/proposal/decision-rail.test.tsx
git commit -m "feat(round2): reflow only affected proposal walls"
```

---

### Task 7: Add customer-publication preflight and concise drawing advisories

**Files:**
- Create: `src/features/round2/model/publish-preflight.ts`
- Create: `src/features/round2/model/publish-preflight.test.ts`
- Create: `src/features/round2/drawings/proposal-notes.tsx`
- Create: `src/features/round2/drawings/proposal-notes.test.tsx`
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`
- Modify: `src/features/round2/drawings/drawing-review.tsx`
- Modify: `src/features/round2/drawings/drawing-sheet.tsx`
- Modify: `src/features/round2/drawings/drawing-sheet.test.tsx`

**Interfaces:**
- Produces: `buildPublishPreflight(input): PublishPreflightResult`.
- `PublishPreflightResult = { canPublish: boolean; blocking: PublishIssue[]; advisory: PublishIssue[] }`.
- Adds: `PUBLISH_CUSTOMER_DESIGN` action and `DrawingStatus` value `CUSTOMER_READY`.

- [ ] **Step 1: Write failing preflight tests**

```ts
test("blocks unconfirmed walls and openings", () => {
  const result = buildPublishPreflight(inputWithReferenceOnlyRoom());
  expect(result.canPublish).toBe(false);
  expect(result.blocking.map((issue) => issue.code)).toContain("UNCONFIRMED_WALL");
});

test("allows a freestanding appliance default with an advisory", () => {
  const result = buildPublishPreflight(inputWithConfirmedRoomAndDefaultRange());
  expect(result.canPublish).toBe(true);
  expect(result.advisory.map((issue) => issue.code)).toContain("DEFAULT_APPLIANCE_SIZE");
});

test("blocks a built-in appliance whose cabinet-dependent height is unknown", () => {
  const result = buildPublishPreflight(inputWithUnconfirmedWallOvenHeight());
  expect(result.canPublish).toBe(false);
  expect(result.blocking.map((issue) => issue.code)).toContain("BUILT_IN_HEIGHT_REQUIRED");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/round2/model/publish-preflight.test.ts src/features/round2/round2-state.test.ts src/features/round2/drawings/drawing-sheet.test.tsx`

Expected: FAIL because the preflight and customer-ready status do not exist.

- [ ] **Step 3: Implement pure preflight rules**

Blocking checks:

- all cabinet-bearing wall lengths have `CONFIRMED` metadata;
- all door/window widths and offsets affecting cabinetry are `CONFIRMED`;
- no metadata is `CONFLICT`;
- no model decision has severity `blocking`;
- every tier segment total is within the wall span and the base/full chain balances exactly;
- ordinary wall ends do not contain finished panels; wall-adjacent remainder is classified as filler;
- sink cabinets have no appliance-side panels;
- range and hood widths are equal whenever the hood is present;
- no fixed appliance or dependent projection is clipped;
- built-in appliance height is confirmed when surrounding cabinetry depends on it.

Advisory checks:

- freestanding appliance width remains `DEFAULT` or `REFERENCE_ONLY`;
- appliance depth is unconfirmed;
- `applianceDetails[fixedPointId].model` is blank; this remains advisory and does not trigger catalog lookup.

- [ ] **Step 4: Add publish UI and reducer guard**

In `DrawingReview`, replace `Mark reviewed` with `Send customer design`. Clicking it opens/shows the compact preflight result. Dispatch `PUBLISH_CUSTOMER_DESIGN` only when `canPublish` is true; the reducer recomputes preflight and refuses stale/invalid calls rather than trusting the UI.

On success set `drawingStatus: "CUSTOMER_READY"`. This task does not send email or mutate an external service.

- [ ] **Step 5: Add concise proposal notes**

`ProposalNotes` receives advisory issues, deduplicates them, and renders one general note on A1:

```text
APPLIANCE SIZES NOTED AS DEFAULT ARE TO BE CONFIRMED BEFORE ORDER.
VERIFY MANUFACTURER CLEARANCES BEFORE FABRICATION OR INSTALLATION.
```

Do not add warning text inside every cabinet elevation.

- [ ] **Step 6: Run preflight/drawing/state tests**

Run: `npm test -- src/features/round2/model/publish-preflight.test.ts src/features/round2/drawings/proposal-notes.test.tsx src/features/round2/drawings/drawing-sheet.test.tsx src/features/round2/round2-state.test.ts`

Expected: PASS; blocking values prevent publication, defaults become advisories, and customer-ready state is reducer-enforced.

- [ ] **Step 7: Commit**

```bash
git add src/features/round2/model/publish-preflight.ts src/features/round2/model/publish-preflight.test.ts src/features/round2/drawings/proposal-notes.tsx src/features/round2/drawings/proposal-notes.test.tsx src/features/round2/round2-types.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts src/features/round2/drawings/drawing-review.tsx src/features/round2/drawings/drawing-sheet.tsx src/features/round2/drawings/drawing-sheet.test.tsx
git commit -m "feat(round2): gate customer proposal publication"
```

---

### Task 8: Prove cross-view dimension consistency and complete the integrated workflow

**Files:**
- Modify: `src/features/round2/round2-visual-prototype.test.tsx`
- Modify: `src/features/round2/proposal/design-plan.test.tsx`
- Modify: `src/features/round2/proposal/wall-elevation.test.tsx`
- Modify: `src/features/round2/drawings/cabinet-schedule.test.tsx`
- Modify: `src/features/round2/drawings/drawing-sheet.test.tsx`
- Modify: `src/features/round2/measurement/measured-plan.test.tsx`

**Interfaces:**
- Consumes: shared measurements, appliance editing, panel/filler rules, local reflow, and publish preflight from Tasks 1–7.
- Produces: end-to-end regression coverage only; no new production abstraction.

- [ ] **Step 1: Add the integrated workflow test**

```ts
test("prefills, edits, confirms, and publishes one coherent customer proposal", () => {
  const state = adoptBasisWithDefaults();
  expect(proposalUnlocked(state)).toBe(true);

  const resized = editFridgeWidth(state, 42 * 16);
  expect(measurementValue(resized, fridgeWidthKey)).toBe(42 * 16);
  expect(segmentWidth(resized.model, "fridge")).toBe(42 * 16);

  const panelRemoved = removeAppliancePanel(resized, "fridge", "left");
  expect(panelSides(findApplianceWall(panelRemoved.model, "fridge"))).toEqual(["right"]);
  expect(allWallChainsBalance(panelRemoved.model)).toBe(true);

  const confirmed = confirmRequiredGeometryAndFridge(panelRemoved);
  const preflight = buildPublishPreflight(preflightInput(confirmed));
  expect(preflight.blocking).toEqual([]);

  const published = reduceRound2Prototype(confirmed, {
    type: "PUBLISH_CUSTOMER_DESIGN"
  });
  expect(published.drawingStatus).toBe("CUSTOMER_READY");
});
```

- [ ] **Step 2: Add exact dimension-chain assertions**

For each solved wall fixture, assert:

```ts
const baseTotal = wall.segments
  .filter((segment) => segment.tier === "base" || segment.tier === "full")
  .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
expect(baseTotal).toBe(wall.lengthSixteenths);
expect(renderedPlanOverall(html, wall.id)).toBe(formatSixteenths(wall.lengthSixteenths));
expect(renderedElevationOverall(html, wall.id)).toBe(formatSixteenths(wall.lengthSixteenths));
expect(scheduleWidthForAppliance(html, "Refrigerator")).toBe("42″");
```

- [ ] **Step 3: Run the entire Round 2 suite**

Run: `npm test -- src/features/round2`

Expected: PASS with no failed tests or unhandled React warnings.

- [ ] **Step 4: Run typecheck and production build**

Run: `npx tsc --noEmit && npm run build`

Expected: both commands exit 0; Next.js completes the production build.

- [ ] **Step 5: Review the Round 2 page manually**

Run: `npm run dev`

Verify at `/projects/<projectId>/round2`:

- Round 1/reference/default values are prefilled with visible status;
- Design Proposal opens without retyping every measurement;
- selecting an appliance opens its dimension editor;
- editing width updates Field Measurement and the affected wall;
- an impossible width retains the previous drawing and shows the shortage;
- unconfirmed walls block `Send customer design`;
- a default freestanding appliance produces only an advisory;
- the final plan, elevation, and schedule agree.

- [ ] **Step 6: Commit integrated verification**

```bash
git add src/features/round2/round2-visual-prototype.test.tsx src/features/round2/proposal/design-plan.test.tsx src/features/round2/proposal/wall-elevation.test.tsx src/features/round2/drawings/cabinet-schedule.test.tsx src/features/round2/drawings/drawing-sheet.test.tsx src/features/round2/measurement/measured-plan.test.tsx
git commit -m "test(round2): verify fast customer design workflow"
```

---

## Final Verification

- [ ] Run `npm test -- src/features/round2` and confirm all Round 2 tests pass.
- [ ] Run `npx tsc --noEmit` and confirm exit 0.
- [ ] Run `npm run build` and confirm exit 0.
- [ ] Run `git status --short` and confirm only intentional files remain.
- [ ] Compare the implementation against every acceptance criterion in `docs/superpowers/specs/2026-07-15-round2-fast-customer-design-flow.md`.
