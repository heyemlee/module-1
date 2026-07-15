# Round 2 Fast Customer Design Flow

**Date:** 2026-07-15  
**Status:** Approved

## 1. Objective

Round 2 should let a designer start a detailed customer-facing cabinet proposal immediately from the approved Round 1 layout, without presenting rough layout values as field measurements and without waiting for every appliance specification.

The workflow should minimize duplicate entry:

```text
Round 1 layout reference
  -> prefilled field-measurement workspace
  -> immediate draft proposal using common appliance defaults
  -> direct edits on the drawing
  -> publish preflight
  -> detailed customer design package
```

The customer package is a detailed design proposal. It is not an installation drawing, fabrication drawing, or order authorization.

## 2. Product Decisions

1. Round 1 data is not frozen as authoritative field data. It prefills Round 2 fields as reference-only information.
2. Field measurements remain editable and are the authority for room, wall, opening, and utility geometry.
3. Missing appliance dimensions receive common defaults so design work can begin immediately.
4. The designer edits an appliance or cabinet directly from the plan or elevation. The drawing editor and Field Measurement edit the same underlying value.
5. A draft proposal may exist with default appliance sizes. Publishing a customer proposal invokes a small, explicit preflight gate.
6. Deterministic geometry generates the plan, elevations, dimensions, and cabinet schedule. AI may help extract inputs or render materials, but it does not invent dimensions or cabinet geometry.
7. Filler and finished panels are separate parts with separate responsibilities: filler closes a small cabinet-to-wall remainder; a finished panel covers an exposed cabinet side or forms the specified appliance surround.
8. Sink cabinets have no automatic side panels. Dishwashers, refrigerators, and ranges receive left and right finished panels by default, and each panel can be removed or restored independently by the designer.

## 3. Measurement and Value Authority

Freezing is replaced by value provenance and versioning. Every layout-critical value has a source and status.

### 3.1 Sources

- `ROUND1_REFERENCE`: copied from the approved rough layout; never treated as measured.
- `COMMON_DEFAULT`: supplied by the system when an appliance dimension is missing.
- `FIELD_MEASURED`: entered or confirmed from the site measurement.
- `APPLIANCE_SPEC`: entered from a selected appliance specification or model.
- `DESIGNER_EDIT`: changed directly from the proposal drawing.

### 3.2 Statuses

- `REFERENCE_ONLY`: useful for starting work but requires field verification.
- `DEFAULT`: safe for draft design only.
- `CONFIRMED`: accepted by a person from a field measurement or appliance specification.
- `CONFLICT`: two sources disagree and a person must choose the active value.

The system keeps prior measurement versions for traceability, but designers do not need to lock and unlock a separate copy. Editing an authoritative field creates a new working version and marks dependent proposal output stale until recalculation completes.

### 3.3 Authority rules

- Room shell, wall lengths, openings, and offsets use `FIELD_MEASURED` values for customer publication.
- An appliance value uses `APPLIANCE_SPEC` when available.
- A direct drawing edit writes through as `DESIGNER_EDIT`; it remains unconfirmed until the designer confirms its source.
- Round 1 and common defaults never silently overwrite a confirmed value.
- A conflicting new value creates a visible conflict instead of silently changing the drawing.

## 4. Default Appliance Dimensions

Defaults are starting values, not site facts. The UI displays a compact `Default` badge until the value is confirmed or replaced.

| Item | Default width | Quick alternatives | Default behavior |
|---|---:|---|---|
| Refrigerator | 36 in | 30, 33, 42, 48 in | Tall fixed point |
| Range | 30 in | 36, 48 in | Base-run fixed point |
| Cooktop | 30 in | 36 in | Counter fixed point |
| Dishwasher | 24 in | — | Base-run fixed point |
| Sink | 33 in | common presets | Starts with a 36 in sink cabinet |
| Wall oven | 30 in | 27 in | Tall fixed point |
| Microwave/oven combination | 30 in | 27 in | Tall fixed point |
| Hood | follows cooking appliance | — | Never independently guessed |
| Undercounter beverage refrigerator | 24 in | 15, 18 in | Base-run fixed point |

Width is sufficient to begin the first draft for ordinary freestanding appliances. Height must be confirmed before customer publication when it controls surrounding cabinetry, including refrigerator-overhead cabinets, wall-oven towers, microwave/oven combinations, and other built-ins. Depth and manufacturer clearances can remain pending in a customer proposal, but must be confirmed before ordering or installation documentation.

## 4.1 Filler and Finished-Panel Rules

### Filler

A filler fills the small remaining distance between cabinetry and a wall. It is not decorative side cladding and must not be generated merely because a run has an exposed end.

The ordinary cabinet-to-wall sequence is:

```text
cabinet -> filler -> wall
```

An ordinary base or wall cabinet that approaches a wall receives only the required wall filler. It does not also receive a finished panel on that wall side.

### Finished panel

A finished panel covers an exposed cabinet side or forms part of an appliance surround. The ordinary exposed-end sequence is:

```text
cabinet -> finished panel -> open room
```

When a panel-wrapped appliance approaches a wall, both parts may be present because they solve different conditions:

```text
appliance -> finished panel -> filler -> wall
```

The panel surrounds the appliance; the filler closes the remaining wall distance.

### Appliance defaults

| Unit | Left finished panel | Right finished panel | Designer control |
|---|---|---|---|
| Sink cabinet | none | none | not applicable |
| Dishwasher | present by default | present by default | remove/restore each side |
| Refrigerator | present by default | present by default | remove/restore each side |
| Range | present by default | present by default | remove/restore each side |

Each appliance-side panel is an independent 3/4-inch model segment with a stable ID and side (`LEFT` or `RIGHT`). Removing one side must not remove the other.

### Invalid fixed reservations and upper projections

Fixed appliances and their dependent upper elements are never clipped to fit. A 30-inch range always reserves 30 inches, and its cabinet-insert hood zone remains the full 30 inches. If the range conflicts with a corner, window, opening, or available wall span, the solver returns a blocking issue and retains the last valid drawing. It must not emit a 4-inch hood fragment, undersized appliance, or misleading completed elevation.

## 5. Simplified User Flow

### 5.1 Enter Round 2

The system creates the working measurement record from Round 1:

- Room and openings are prefilled as `Reference only`.
- Appliance types and approximate positions are carried forward.
- Missing appliance widths receive `Default` values.
- A draft plan appears immediately; the user does not face an empty canvas.

The primary action is `Review field measurements`, not `Lock reference`.

### 5.2 Field Measurement

Field Measurement is a compact checklist for values that affect geometry:

- walls and ceiling;
- doors, windows, and offsets;
- utilities when they constrain placement;
- appliance dimensions and specification status.

Round 1 values are already in the fields. Site staff overwrite or confirm them rather than re-entering the entire room.

The user may proceed to a draft proposal before every appliance field is confirmed. Customer publication remains unavailable until the publish gate passes.

### 5.3 Design Proposal

The plan and elevation are live editors backed by the same measurement/model data.

Selecting an appliance opens a small contextual editor with:

- width, height, and depth;
- common-size shortcuts;
- brand and model fields when known;
- source/status;
- `Confirm from field measurement` and `Confirm from appliance spec` actions.

Selecting a cabinet presents only valid standard cabinet widths and relevant cabinet options. Free-form cabinet widths are not the default interaction.

Selecting an appliance-side finished panel presents `Remove panel`. A removed panel remains a stored per-side design choice and presents `Restore panel` from the owning appliance editor or drawing selection. The drawing must make the selected side explicit.

When an appliance or cabinet changes, the solver recalculates the affected wall only. The UI previews which adjacent cabinets or fillers changed and preserves unaffected walls.

Edits made here immediately appear in Field Measurement. There is no separate proposal-only copy of an appliance dimension.

### 5.4 Publish to Customer

`Send customer design` runs a preflight rather than requiring a separate freeze step.

Blocking conditions:

- any wall length used by cabinetry is not field-confirmed;
- a door/window size or offset affecting cabinetry is not field-confirmed;
- cabinet, appliance, opening, panel, and filler widths exceed the usable wall span;
- objects overlap or cross a wall/corner boundary;
- a built-in appliance lacks a dimension needed to size its surrounding cabinet;
- a source conflict remains unresolved;
- a deterministic solver decision remains blocking.

Advisory conditions:

- a freestanding appliance still uses a common default width;
- depth or manufacturer clearance is not yet confirmed;
- a model number has not been selected.

Advisories do not block the customer proposal. The drawing places a concise note such as `Appliance size to be confirmed` in the general notes or appliance schedule rather than cluttering each elevation.

## 6. Drawing Generation

All customer drawing views derive from one current `Round2Model`:

- dimensioned floor plan;
- wall elevations;
- appliance schedule;
- cabinet schedule;
- proposal notes and unresolved advisory items.

Each wall obeys this invariant:

```text
corner reservations
+ cabinet widths
+ appliance/opening widths
+ panels and fillers
+ intentional open space
= usable wall span
```

Filler placement also obeys these invariants:

- wall fillers sit at cabinet-to-wall boundaries;
- a filler is not inserted at an open run end in place of a finished panel;
- an ordinary cabinet against a wall does not receive both filler and finished panel;
- an appliance with a required/default panel may use `appliance -> panel -> filler -> wall`;
- no filler or finished panel may be silently omitted from the dimension chain.

The drawing renderer scales the view to fit the sheet. It never rescales individual cabinets or changes their numeric dimensions to fit the canvas. Every dimension label is computed from model geometry, and dimension-chain totals must equal the overall wall dimension.

Photorealistic or material renderings may use the same model as references, but they cannot become the source of dimensions, cabinet counts, or schedules.

## 7. Recalculation and Error Handling

### 7.1 Successful edit

1. Validate the edited numeric value.
2. Update the shared measurement/appliance record and provenance.
3. Recalculate the affected wall.
4. Preserve valid fixed points and standard cabinet widths.
5. Absorb residual space with valid filler/panel rules.
6. Update plan, elevation, schedules, and publish status together.

### 7.2 Removing or restoring an appliance panel

Removing a panel releases its 3/4-inch width and triggers a deterministic reflow of the affected wall:

1. Record the owning appliance ID, side, and `REMOVED` choice.
2. Remove that panel's 3/4-inch reservation.
3. Move the adjacent cabinet/appliance boundary to close the removed panel position.
4. Add the released width to the nearest valid cabinet-to-wall filler.
5. If no wall filler can accept it, try a valid standard-cabinet repartition.
6. If neither operation closes the wall, retain the last valid drawing and create one blocking design decision; never leave an unexplained 3/4-inch gap.

Restoring a panel performs the inverse operation:

1. Reserve 3/4 inch on the selected appliance side.
2. Take that width from the nearest valid wall filler.
3. If the filler is insufficient, try a valid standard-cabinet repartition.
4. If the wall cannot accommodate the panel, reject the restore action, retain the last valid drawing, and report the exact shortage.

The filler dimension shown in the plan, elevation, and schedule is always its recalculated installed width, including non-standard cut widths produced by this absorption rule.

### 7.3 Unresolved edit

If the wall cannot be solved, the system does not create an undersized cabinet or hide the overflow. It keeps the last valid geometry, shows the proposed change, and gives one focused reason, for example:

```text
Wall A is 2 1/2 in short after changing the refrigerator to 42 in.
```

The designer can choose a valid adjacent cabinet width, reduce a filler, change the appliance, or request a field remeasurement.

### 7.4 Changed field measurement

When a field measurement changes after a proposal exists:

- the proposal remains visible;
- affected output is marked `Updating` and then `Ready` or `Needs attention`;
- unchanged walls remain stable;
- the system summarizes changed cabinets before customer publication.

## 8. Minimal Interface Scope

To keep the workflow fast, the first implementation should contain only:

- prefilled measurement fields with source/status badges;
- common appliance defaults and presets;
- direct appliance editing from plan/elevation;
- direct standard-width cabinet editing from elevation;
- per-side removal/restoration of dishwasher, refrigerator, and range panels;
- affected-wall recalculation;
- a compact publish preflight;
- deterministic customer drawing output.

It should not add a separate appliance-management module, a complex approval workflow, a second proposal measurement store, or a mandatory model-number catalog.

## 9. Testing and Acceptance Criteria

### 9.1 Data behavior

- Round 1 values prefill Round 2 as `REFERENCE_ONLY`, never `CONFIRMED`.
- Missing appliance widths receive the specified common defaults.
- A confirmed field/spec value cannot be overwritten by a later default or extraction.
- Editing an appliance from the drawing updates the corresponding Field Measurement value and provenance.

### 9.2 Geometry behavior

- A width change recalculates only affected wall geometry.
- Fixed openings and confirmed appliance dimensions are never silently resized.
- Range and hood widths remain equal; neither is clipped by a corner or wall boundary.
- Wall-adjacent ordinary cabinets use filler without an additional finished panel.
- Open ordinary cabinet sides use a finished panel without an automatic open-end filler.
- Sink cabinets have no automatic side panels.
- Dishwashers, refrigerators, and ranges begin with independent left/right 3/4-inch panels.
- Removing one appliance panel preserves the other and transfers the released 3/4 inch to the nearest wall filler or a valid repartition.
- Restoring a panel consumes wall-filler/repartition capacity or fails without changing the last valid drawing.
- Every solved wall exactly balances to its usable span.
- Unsolvable edits produce a blocking decision and retain the last valid drawing.
- Plan, elevation, dimension chains, and schedules show identical dimensions.

### 9.3 Workflow behavior

- A draft proposal can be viewed with default appliance widths.
- Customer publication is blocked by unconfirmed wall/opening geometry, overflow, overlap, conflicts, or missing built-in dimensions.
- A freestanding appliance default produces an advisory rather than a block.
- Resolving the final blocking issue immediately enables customer publication.

### 9.4 Success measure

A designer can enter Round 2, correct field measurements, adjust key appliance or cabinet sizes directly in the drawing, and produce a coherent customer proposal without duplicate entry or manual reconciliation between the plan and elevations.
