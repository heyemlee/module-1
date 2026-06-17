# Round 1 Adjust Positions Flow Design

Date: 2026-06-17

## Context

Round 1 is a showroom intake and customer-confirmation workflow. The layout preview is a deterministic SVG floor plan, and the existing renderer already supports dragging doors, windows, and appliances along their walls through `PositionOverrides`.

The form flow needs to match that interaction model. Instead of asking for every precise position and dimension in the first phase, the app should collect layout-critical answers, show a rough generated plan, then invite sales to adjust visible fixed points directly on the plan before cabinet review.

## Goals

- Add a focused `Adjust Positions` step before cabinet review.
- Keep drag adjustment optional: sales can skip it and continue.
- Show one centralized reminder when entering the adjustment step.
- Highlight draggable objects on the plan for 5 seconds when the user chooses to adjust.
- Temporarily remove first-phase prompts for door width, window width, and MEP movability.
- Keep Round 1 sales-estimate boundaries intact.

## Non-Goals

- Do not change the authoritative geometry algorithm.
- Do not make drag adjustment required.
- Do not add project persistence for manual position overrides yet.
- Do not turn Round 1 into production-ready measurement capture.
- Do not redesign the full visual style of the intake page.

## New Flow

The showroom steps become:

```text
Room -> Openings -> Layout -> Appliances -> Adjust Positions -> Cabinets
```

The current `MEP` step is removed from the first-phase UI. MEP data may remain in defaults and schemas, but sales will not be asked to complete it in this Round 1 flow.

The `Openings` step keeps status and rough location questions:

- Any doors or open passages?
- Door / opening wall
- Any windows in or near the kitchen?
- Window approximate relation

The `Openings` step hides:

- Door width if known
- Window width if known

The `Appliances` step remains the source of coarse initial placement. It keeps size/status and rough relation fields for sink, range, fridge, dishwasher, and oven/microwave choices. These answers generate the initial deterministic layout before manual adjustment.

## Adjust Positions Step

When the user enters `Adjust Positions`, the app displays a modal.

The modal appears the first time `Adjust Positions` becomes active in the current page session. If the user navigates away and returns, the modal should not automatically reopen; the step body still provides `Highlight Draggable Items` for replaying the visual cue.

Modal intent:

- Explain that sales can drag the door, window, sink, range, fridge, and dishwasher on the plan to adjust approximate positions.
- Make clear that adjustment is optional and can be skipped.

Modal actions:

- `Start Adjusting`: closes the modal and triggers a 5-second highlight animation on draggable objects.
- `Skip For Now`: closes the modal without blocking navigation.

The step body should include a compact reminder and two controls:

- `Highlight Draggable Items`: replays the 5-second highlight animation.
- `Reset Positions`: clears manual `PositionOverrides`.

The user can proceed to `Cabinets` without dragging anything.

## Highlight Behavior

The highlighted draggable set is:

- `door`
- `window`
- `sink`
- `range`
- `fridge`
- `dishwasher`

The visual treatment should be noticeable but not disruptive. A short bounce or pulse animation for 5 seconds is enough. It must not use browser alerts, and it must not block dragging.

If a listed object is not present in the current plan, no highlight is rendered for it.

## Component Boundaries

`ShowroomIntakeApp` owns flow-level state:

- current step
- whether the adjust-position modal has already appeared in the current page session
- whether draggable objects should be highlighted
- manual position overrides

`LayoutPreview` remains the SVG renderer and drag interaction surface. It receives position state from the parent instead of owning it internally.

Proposed prop shape:

```ts
type LayoutPreviewProps = {
  normalized: Round1Normalized;
  cabinets: Cabinet[];
  confirmationItems: ConfirmationItem[];
  positionOverrides: PositionOverrides;
  onPositionOverridesChange: (overrides: PositionOverrides) => void;
  highlightDraggableItems?: boolean;
};
```

The existing pointer drag logic remains inside `LayoutPreview`. On pointer movement, it calculates the updated override and calls `onPositionOverridesChange`.

## Data Flow

`ShowroomIntakeApp` creates position override state:

```ts
const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
```

`LayoutPreview` builds the plan with the same deterministic function:

```ts
buildFloorPlan(normalized, cabinets, confirmationItems.length, positionOverrides)
```

Position overrides are preview-level state only for this phase. They do not modify the form schema, normalized JSON, repository payload, or production gate.

## Confirmation Rules

Because the first-phase UI no longer asks for door width, window width, or MEP movability, the first-phase confirmation list should not surface these as active required items:

- `MISSING_DOOR_WIDTH`
- `MISSING_WINDOW_WIDTH`
- `UNKNOWN_MEP_MOVABILITY`

The schema and defaults may still preserve these fields for future phases. Module 2 can reintroduce detailed measurement and MEP checks.

Other Round 1 confirmation behavior remains unchanged. Unknown door/window status can still be flagged, and appliance size gaps can still be flagged when the first-phase UI asks for those details.

## Testing

Add or update focused tests for:

- Step labels include `Adjust Positions` and exclude `MEP`.
- Step order is `Room`, `Openings`, `Layout`, `Appliances`, `Adjust Positions`, `Cabinets`.
- Openings first-phase UI no longer renders door/window width inputs.
- Normalization no longer reports `MISSING_DOOR_WIDTH`, `MISSING_WINDOW_WIDTH`, or `UNKNOWN_MEP_MOVABILITY` for first-phase data.
- `LayoutPreview` accepts parent-owned `positionOverrides` and updates them through `onPositionOverridesChange`.
- Adjust-position modal appears when entering the adjustment step and can be dismissed.
- `Highlight Draggable Items` enables the highlight state for 5 seconds.

Run the standard verification after implementation:

```bash
npm test
npx tsc --noEmit
npm run build
```

For UI behavior, also run browser QA against the local app and confirm:

- The modal appears on the adjustment step.
- The highlighted objects visibly animate for about 5 seconds.
- Dragging door, window, and appliances still recalculates cabinet layout.
- Reset positions clears manual adjustments.
