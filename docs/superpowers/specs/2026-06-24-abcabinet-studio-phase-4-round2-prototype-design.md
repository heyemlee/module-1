# ABCabinet Studio Phase 4 — Round 2 Interactive Prototype Design

**Status:** Approved for implementation planning  
**Date:** June 24, 2026  
**Branch:** `phase-4`

## 1. Purpose

Phase 4 designs and implements the frontend experience for Round 2 detailed measured design before the Round 2 backend and production rules exist.

The deliverable is a complete interactive prototype:

- All five Round 2 steps are navigable.
- All authorized project users can edit the local draft.
- Forms, selections, view changes, issue states, undo, redo, and reset work in the browser.
- The page reads the project's existing Round 1 snapshot as its starting reference.
- The prototype does not call Round 2 APIs, write a database record, persist a draft, update project status, approve a design, or create a production package.

The prototype serves two purposes:

1. Give the company a realistic Round 2 workflow to evaluate before backend design.
2. Establish a concrete frontend contract for later Round 2 domain, API, and persistence implementation.

## 2. Non-Negotiable Product Boundary

Round 2 in Phase 4 is a frontend prototype, not a production design system.

The following notice remains visible in the Round 2 project bar and Review Package:

```text
Prototype only · Changes are not saved · Not for production
```

The UI must never claim:

- Saved
- Autosaved
- Approved
- Released
- Production ready
- Ready for manufacturing
- Export complete
- Submitted for production

The strongest positive completion language allowed is:

```text
Prototype review complete
```

This means the local browser draft has no unresolved prototype checks. It does not confer authority on any dimension, cabinet, drawing, or note.

## 3. Scope

### Included

- Project-level Round 2 entry
- Read-only loading of the latest Round 1 snapshot
- Pure conversion of Round 1 snapshot data into a local Round 2 seed
- Complete five-step Round 2 frontend workflow
- Guided and Canvas focus workspace modes
- Plan, Elevations, and Details views
- Local form editing
- Local wall, opening, utility, cabinet, and note selection
- Deterministic prototype plan and elevation SVGs
- Cabinet schedule preview
- Prototype issue derivation
- Undo and redo
- Reset from Round 1
- Dirty-state warnings
- Desktop and iPad layouts
- Keyboard, touch, focus, and reduced-motion states
- Automated tests and browser acceptance testing

### Excluded

- Round 2 database tables or migrations
- Round 2 repositories
- Round 2 API routes
- Saving or autosaving a Round 2 draft
- `localStorage` or IndexedDB draft persistence
- Project-status mutation
- Role-specific Round 2 editing restrictions
- Real approvals
- Real PDF, CAD, drawing, or schedule export
- Pricing or quoting
- Manufacturing cabinet codes
- Shop drawings
- Cut lists
- Hardware schedules
- Ordering data
- Production readiness
- Dimensional authority
- AI-generated authoritative geometry

## 4. Users and Permissions

Round 2 uses the project's existing access rules.

If a user can access the project, that user can open and edit the Round 2 prototype. This applies equally to:

- Admin
- Sales
- Designer

Phase 4 does not introduce a Designer-only workflow or new Round 2 authorization policy.

The server route must still:

1. Require authentication.
2. Load the project through the existing user-scoped project lookup.
3. return not-found for an inaccessible project.

The frontend must not imply that one role has greater Round 2 design authority than another.

## 5. Entry and Routing

Add the project-scoped route:

```text
/projects/:projectId/round2
```

The Project Detail page changes its Round 2 phase row from informational content into a link.

The Round 2 entry does not change the project's stored status. In particular, opening or editing the prototype must not set `ROUND2_MEASURING`.

### With a Round 1 snapshot

The server route loads the latest Round 1 snapshot and passes it to the Round 2 prototype as read-only seed input.

The page opens the Site Measure step with a local Round 2 draft derived from the snapshot.

### Without a Round 1 snapshot

The page displays a truthful empty state:

```text
Round 2 needs a Round 1 cabinet-fill snapshot

Generate Cabinet Fill in Round 1 before starting this prototype. The
Round 1 snapshot provides the room shell, fixed conditions, appliances,
and preliminary cabinet arrangement used as the Round 2 reference.
```

The empty state provides:

- `Open Round 1`
- `Back to project`

It must not load a sample kitchen or fabricated project data.

### Unsupported snapshot

If the snapshot schema cannot be converted safely, display:

```text
This Round 1 reference cannot be opened in the Round 2 prototype.
Return to Round 1 and generate a current cabinet-fill snapshot.
```

Do not guess a conversion or silently discard unsupported fields.

## 6. Round 1 to Round 2 Seed

The Round 2 prototype copies the latest Round 1 snapshot into a new local browser draft.

It does not mutate the Round 1 snapshot.

The pure seed adapter may copy:

- Room length, width, and ceiling height
- Wall identities
- Door and window conditions
- Appliance and fixture positions
- Utility markers
- Preliminary cabinet arrangement
- Layout preference
- Cabinet style and finish reference where present
- Existing Round 1 confirmation items as Round 2 reference issues

Every imported measurement and position begins as unverified.

The adapter must attach source metadata:

```ts
type Round2Source = {
  kind: "ROUND1_SNAPSHOT";
  snapshotId: string;
  snapshotGeneratedAt: string;
  snapshotSchemaVersion: number;
};
```

The local draft must preserve an explicit prototype boundary:

```ts
type Round2PrototypeMeta = {
  prototypeOnly: true;
  persisted: false;
  notForProduction: true;
  dimensionAuthority: "UNVERIFIED";
};
```

## 7. Design Direction

The approved direction is **Precision Workbench**.

It extends the established Round 1 Studio workspace instead of introducing a separate CAD application.

The experience combines:

- Guided five-step navigation
- A large technical canvas
- A contextual inspector
- Plan, Elevations, and Details views
- A persistent local-state and prototype boundary bar

The interface should feel more precise than Round 1, but remain understandable to Admin, Sales, and Designer users without CAD training.

### Visual continuity

Reuse:

- Studio navigation rail
- Studio dark shell
- Sage action color
- Light technical drawing surface
- Shared controls and tokens
- Guided / Canvas focus switch
- Apple-like restrained transition pacing
- Existing focus and reduced-motion rules

### Increased Round 2 precision

Round 2 adds:

- Dimension chains
- Selected-object outlines
- Wall identities
- Verification states
- Multi-view drawing tabs
- Cabinet schedule
- Issue count
- More compact inspector fields

It must not add:

- Command-line CAD interaction
- Dense unlabeled toolbars
- Tiny icon-only actions
- Fake precision grids
- Manufacturing-code styling
- Decorative technical data that has no interaction meaning

## 8. Workspace Structure

### Persistent project bar

The project bar contains:

- Back to project
- Customer and project name
- `Round 2 prototype`
- Guided / Canvas focus switch
- Undo
- Redo
- Reset from Round 1
- Dirty state
- Persistent prototype notice

Undo and redo operate only on local draft edits.

Reset requires confirmation and reconstructs the draft from the original Round 1 seed.

### Guided mode

Desktop and iPad landscape use:

```text
Studio rail | five-step navigation | technical canvas | inspector
```

The canvas keeps the largest share of available width.

When width becomes constrained:

1. Reduce the step-navigation width.
2. Reduce the inspector width.
3. Preserve a usable canvas.

### Canvas focus

Canvas focus:

- Collapses the five-step navigation into a compact progress strip.
- Expands the drawing surface.
- Opens the inspector as a contextual overlay drawer.
- Preserves current step, active view, local draft, selection, history, and scroll/zoom state.

Mode switching changes layout only.

### View tabs

The main workspace provides:

- Plan
- Elevations
- Details

The active step may guide the default view, but users can switch views where the content exists.

View switching does not create an undo-history entry.

## 9. Five-Step Workflow

### Step 1: Site Measure

**Purpose:** Confirm the room shell and identify which imported measurements still need field verification.

#### Local interactions

- Select a wall from the plan or wall list.
- Edit wall length.
- Edit ceiling height.
- Mark a wall measurement as verified or unverified.
- Toggle grid.
- Toggle dimension labels.
- Switch display units only if conversion is deterministic; the underlying prototype draft remains inch-based.
- Reset the draft from Round 1.

#### Canvas

The Plan view displays:

- Room shell
- Wall labels
- Overall dimensions
- Selected-wall dimension
- Imported fixed conditions as subdued references
- Verification styling

Verification must use text or icon plus color, never color alone.

#### Inspector

The selected wall inspector includes:

- Wall name
- Length
- Height
- Verification state
- Source: `Imported from Round 1`
- Local-change indicator

### Step 2: Openings & Utilities

**Purpose:** Coordinate fixed conditions before cabinet-level work.

#### Supported local objects

- Door
- Open passage
- Window
- Plumbing
- Electric
- Gas
- Vent

#### Local interactions

- Select an object from the plan or object list.
- Edit wall.
- Edit offset along wall.
- Edit opening width.
- Edit sill or head height where relevant.
- Add a local prototype utility marker.
- Remove a locally added marker.
- Mark an object for site verification.

Imported objects may be edited locally without changing Round 1.

#### Canvas

Objects use a consistent icon and text legend. Hover may enhance feedback on desktop, but all information remains available through selection and labels.

#### Inspector

Fields depend on selected object type. Unsupported fields must not render as disabled decorative controls.

### Step 3: Cabinet Layout

**Purpose:** Explore a cabinet-level draft from the preliminary Round 1 arrangement.

#### Local interactions

- Select a cabinet from plan, elevation, or schedule.
- Edit cabinet kind:
  - Base
  - Wall
  - Tall
- Edit nominal width.
- Edit depth.
- Edit a human-readable prototype label.
- Assign the cabinet to a wall run.
- Add a cabinet locally.
- Duplicate a cabinet locally.
- Remove a cabinet locally.
- Reorder cabinets within a wall run using explicit handles or controls.

The prototype does not promise drag-to-manufacture positioning or precision snapping.

Every spatial edit must have a numeric or list-based alternative.

#### Labels

Use local prototype identifiers such as:

```text
B-01
W-03
T-01
```

Do not present real manufacturing codes such as product catalog or ordering codes.

#### Canvas

The Plan view displays:

- Wall runs
- Cabinet footprints
- Appliances and openings
- Selected cabinet
- Local sequence labels
- Basic clearances where they can be derived deterministically

#### Schedule

The cabinet schedule preview includes:

- Prototype label
- Kind
- Wall
- Nominal width
- Depth
- Verification or issue state

It is not an order list, cut list, or production schedule.

### Step 4: Elevations & Details

**Purpose:** Review the local draft wall by wall and annotate visible coordination details.

#### Elevation navigation

Provide:

- Back
- Left
- Right
- Front

Use the existing TOP / LEFT / RIGHT / BOTTOM wall mapping internally.

#### Local interactions

- Select a cabinet, opening, utility, or note.
- Edit cabinet display height.
- Toggle prototype panel requirement.
- Toggle prototype filler requirement.
- Add and edit a detail note.
- Remove a locally added detail note.
- Toggle dimensions.
- Toggle labels.
- Toggle utilities.

Panel and filler flags are prototype coordination prompts only. They are not construction decisions.

#### Canvas

Elevation SVGs are derived deterministically from the local draft.

They may show:

- Wall outline
- Floor and ceiling reference
- Cabinet blocks
- Openings
- Appliances
- Utility markers
- Selected object
- Prototype dimensions
- Notes

Each elevation carries:

```text
Round 2 frontend prototype · Unverified · Not for production
```

### Step 5: Review Package

**Purpose:** Review frontend completeness and expose unresolved prototype issues.

#### Content

- Prototype summary counts
- Unverified measurement count
- Unresolved fixed-condition count
- Cabinet issue count
- Detail-note count
- Plan thumbnail
- Four elevation thumbnails
- Cabinet schedule preview
- Issue list

#### Issue behavior

Selecting an issue:

1. Navigates to the related step.
2. Opens the relevant view.
3. Selects the related object when it still exists.
4. Moves keyboard focus to the inspector heading or relevant field.

Users may acknowledge a local issue. Acknowledgement is browser-memory state only.

#### Completion

When all required prototype checks are resolved, show:

```text
Prototype review complete
```

The Export action remains visibly unavailable with:

```text
Export will be added when Round 2 storage and production rules are implemented.
```

No downloadable fake package should be generated.

## 10. Local State Architecture

Round 2 has one local source of truth.

Recommended top-level state:

```ts
type Round2PrototypeState = {
  seed: Round2PrototypeSeed;
  history: {
    past: Round2Draft[];
    present: Round2Draft;
    future: Round2Draft[];
  };
  ui: {
    step: Round2Step;
    maxVisitedStep: Round2Step;
    workspaceMode: "GUIDED" | "CANVAS_FOCUS";
    activeView: "PLAN" | "ELEVATIONS" | "DETAILS";
    activeElevationWall: "TOP" | "LEFT" | "RIGHT" | "BOTTOM";
    selection: Round2Selection | null;
    inspectorState: "CLOSED" | "COLLAPSED" | "EXPANDED";
    showGrid: boolean;
    showDimensions: boolean;
    showLabels: boolean;
    showUtilities: boolean;
    acknowledgedIssueIds: string[];
  };
};
```

### Draft

The editable local draft contains:

- Walls
- Openings
- Utilities
- Cabinets
- Detail notes
- Verification states

### History

- Store a maximum of 50 past draft states.
- A new draft edit clears the redo stack.
- Undo and redo do not change the original seed.
- Step, view, selection, panel position, and workspace-mode changes do not enter draft history.
- Reset clears history and restores the initial seed.

### Dirty state

The draft is dirty when `history.present` differs from the original seeded draft.

Dirty state appears as:

```text
Local changes · Not saved
```

Clean initial state appears as:

```text
Round 1 reference loaded · Not saved
```

Neither state uses `Saved`.

### Selection

Supported selection types:

```ts
type Round2Selection =
  | { type: "WALL"; id: string }
  | { type: "OPENING"; id: string }
  | { type: "UTILITY"; id: string }
  | { type: "CABINET"; id: string }
  | { type: "DETAIL_NOTE"; id: string };
```

Selection rules:

- Canvas, list, schedule, elevation, and inspector share the same selection.
- Deleting a selected item chooses the next sensible sibling or clears selection.
- Jumping to a step clears a selection that cannot be displayed in that step.
- Selection is UI state and does not make the draft dirty.

## 11. Component Boundaries

Round 2 should be implemented as a separate feature directory:

```text
src/features/round2/
```

Recommended boundaries:

### Server entry

`Round2Page`

- Authenticates user.
- Loads project through existing access rules.
- Loads the latest Round 1 snapshot.
- Passes project identity and snapshot seed to the client prototype.
- Performs no Round 2 write.

### Seed adapter

`round2-seed.ts`

- Validates supported Round 1 snapshot version.
- Converts snapshot into a Round 2 prototype seed.
- Adds source and prototype metadata.
- Contains no React code.

### State reducer

`round2-reducer.ts`

- Applies draft actions.
- Applies UI actions.
- Maintains bounded history.
- Supports undo, redo, and reset.
- Contains no DOM or network logic.

### Derived review model

`round2-review.ts`

- Derives unresolved issues.
- Derives step status.
- Derives summary counts.
- Maps each issue to a target step, view, selection, and focus target.

### Geometry

`round2-plan-scene.ts`

- Derives technical plan geometry from the local draft.

`round2-elevation-scene.ts`

- Derives four wall elevations from the same local draft.

The Plan and Elevations views must use the same draft source. They must not maintain separate cabinet positions.

### Workspace shell

`round2-prototype-app.tsx`

- Owns the reducer.
- Coordinates step, view, mode, history, and selection.
- Adds dirty-exit protection.
- Contains no fetch call.

### Presentational components

- `round2-project-bar.tsx`
- `round2-step-navigation.tsx`
- `round2-workspace-shell.tsx`
- `round2-view-tabs.tsx`
- `round2-plan-canvas.tsx`
- `round2-elevation-canvas.tsx`
- `round2-inspector.tsx`
- `round2-cabinet-schedule.tsx`
- `round2-review-package.tsx`
- `round2-empty-state.tsx`
- `round2-prototype-notice.tsx`

Inspector fields may be split by object type when a single file becomes difficult to understand.

## 12. Network and Persistence Rules

The Round 2 client feature must contain no:

- `fetch`
- server action
- form action
- mutation hook
- storage write
- project-status request

The only server data access happens while rendering the route:

- Existing project lookup
- Existing latest Round 1 snapshot lookup

The route may read from the existing database through current repositories. It must not write.

### Browser exit

When the draft is dirty:

- Navigating back to the project requires a discard confirmation.
- Reset requires a confirmation.
- Browser refresh or close uses `beforeunload`.

The warning must say that changes will be discarded, not that they are unsaved server changes.

## 13. Responsive Design

### Desktop

- Persistent Studio rail.
- Full five-step navigation.
- Large canvas.
- Fixed contextual inspector.
- Plan / Elevations / Details tabs remain visible.
- Project bar actions stay on one line where practical.

### iPad landscape

- Preserve guided navigation, canvas, and inspector.
- Reduce navigation and inspector widths before shrinking canvas.
- Use 44px minimum targets.
- Avoid controls that require hover.

### iPad portrait

- Studio rail uses its existing narrow behavior.
- Steps become a horizontally scrollable progress strip.
- Canvas remains the main surface.
- Inspector becomes a bottom sheet.
- Bottom sheet supports:
  - Collapsed
  - Expanded
- The collapsed sheet shows selected-object identity and key values.
- The expanded sheet shows full editing controls.
- The primary field or action remains reachable without precise dragging.

### Canvas focus on iPad

- The step strip remains available.
- Inspector opens as an overlay or bottom sheet.
- Switching orientation must not reset draft or selection.

### Phone

Full Round 2 editing is not a Phase 4 target.

Phones may show:

- Prototype notice
- Project identity
- Current review summary
- A message recommending desktop or iPad

Do not compress the full editing workspace into a phone layout.

## 14. Canvas Interaction Rules

- Tap or click selects.
- Selection has a high-contrast outline and text identification.
- Pan and zoom feedback may be prototyped.
- Zoom controls must be keyboard accessible.
- Touch objects and handles are at least 44px.
- Drag is reserved for:
  - Canvas pan
  - Explicit reorder handles
  - Interactions that also have a numeric alternative
- Do not imply precision snapping if the prototype does not implement it deterministically.
- Do not use hover as the only way to discover object identity or actions.

## 15. Motion and Feedback

Continue the approved Studio motion language:

- Press feedback: 120–160ms
- Hover/focus: 160–200ms
- Panel and mode transitions: 240–320ms
- Selection transition: opacity, color, and restrained transform
- Bottom sheet: transform-based transition

Do not animate technical geometry during ordinary field edits in a way that makes dimensions appear unstable.

### Reduced motion

With `prefers-reduced-motion: reduce`:

- Mode changes are immediate.
- Bottom-sheet changes are immediate.
- No spring overshoot.
- No pulsing selection.
- No perpetual shimmer.
- State remains understandable through text and static styling.

## 16. Accessibility

- WCAG AA contrast for text, controls, dimensions, and selection.
- Visible focus for every action and editable field.
- Logical focus order: project bar, steps, view tabs, canvas/list, inspector, footer status.
- Canvas objects have accessible labels.
- Selection changes are announced through a polite live region.
- Errors and invalid numeric values connect to their fields.
- Issue jump moves focus to useful content.
- Verification state is not conveyed by color alone.
- Disabled Export includes an explanation.
- Bottom sheet preserves focus when expanded or collapsed.
- Reset and dirty-exit confirmations use accessible dialogs.
- Keyboard users can complete every prototype interaction without dragging.

## 17. Error, Empty, and Edge States

### Required states

- Loading latest Round 1 reference
- No Round 1 snapshot
- Unsupported snapshot
- Seed conversion failure
- Empty object list
- No selection
- Invalid numeric input
- Dirty local draft
- Reset confirmation
- Discard-exit confirmation
- No issues
- Unresolved issues
- Prototype review complete
- Disabled Export explanation

### Invalid values

Invalid field input:

- Remains local to the field until corrected.
- Shows an inline message.
- Does not update the draft scene.
- Does not create an undo-history entry.

### Removing referenced objects

If an issue references an object that is later removed:

- Recompute the issue list.
- Remove obsolete derived issues.
- Clear or move selection according to the selection rules.

## 18. Testing Strategy

### Pure unit tests

Test the Round 1 snapshot adapter:

- Supported schema converts.
- Source metadata is retained.
- Imported measurements are unverified.
- Round 1 object is not mutated.
- Unsupported schema fails explicitly.

Test reducer behavior:

- Field edit
- Add object
- Duplicate cabinet
- Remove object
- Reorder run
- Verification toggle
- Add/remove detail note
- Undo
- Redo
- Redo clearing after a new edit
- Reset
- 50-state history bound
- UI-only action does not enter history

Test review derivation:

- Unverified walls
- Unverified fixed conditions
- Invalid or missing cabinet values
- Detail issue counts
- Issue acknowledgement
- Issue target step/view/selection
- Prototype review complete

Test geometry:

- Plan is deterministic.
- All four elevations use the same draft.
- Selection identifiers remain stable.
- Removing a cabinet removes it from plan, elevation, and schedule.

### Markup tests

Verify:

- Persistent prototype notice
- All five steps
- Plan / Elevations / Details tabs
- Empty state links
- Disabled Export explanation
- Review-complete wording
- No `Saved`, `Approved`, or `Production ready`
- Touch-target and focus classes
- Accessible dialog labels

### Source-level boundary tests

The `src/features/round2` client code must contain no:

```text
fetch(
localStorage.setItem
indexedDB
"use server"
```

The project route must import no Round 2 mutation service or repository.

### Browser acceptance

Verify on:

- Desktop 1440 × 900
- iPad landscape 1024 × 768
- iPad portrait 820 × 1180

Required browser scenarios:

1. Open a project with a Round 1 snapshot.
2. Confirm initial Round 2 draft reflects the project.
3. Edit all five steps.
4. Synchronize selection across canvas, schedule/list, and inspector.
5. Undo and redo.
6. Reset with confirmation.
7. Switch Guided and Canvas focus without losing state.
8. Rotate between landscape and portrait without losing state.
9. Jump from Review Package issue to the correct object.
10. Complete all prototype checks.
11. Confirm Export remains unavailable.
12. Confirm dirty exit warning.
13. Confirm reduced-motion behavior.
14. Confirm the network panel contains no Round 2 write request.

## 19. Acceptance Criteria

Phase 4 design implementation is accepted when:

- All authorized project users can open and edit the prototype.
- Project Detail links to Round 2.
- No project status changes when Round 2 opens.
- Round 1 snapshot is the only project-specific seed.
- No snapshot produces a truthful empty state.
- Five-step workflow is complete and interactive.
- Guided and Canvas focus modes preserve state.
- Plan, elevations, details, schedule, and review use the same local draft.
- Canvas and inspector selection remain synchronized.
- Undo, redo, reset, dirty warning, and discard confirmation work.
- Desktop and iPad layouts pass visual QA.
- Every drag interaction has an accessible non-drag alternative.
- Reduced motion is honored.
- Prototype notice remains visible.
- Export remains unavailable and explained.
- No Round 2 API, database, persistence, approval, or production feature is added.
- No UI copy implies saved or authoritative production data.
- Automated tests, TypeScript, and production build pass.

## 20. Future Backend Handoff

Phase 4 intentionally stops before backend design.

A later Round 2 implementation phase may use this prototype to define:

- Persistent Round 2 schema
- Measurement provenance
- Draft versioning
- Role and approval rules
- Validation authority
- Project-status transitions
- Production drawing generation
- Real exports
- Audit history

Those decisions must not be inferred from the frontend prototype alone.

When persistence is introduced, the local reducer and pure geometry can remain useful, but server authority, concurrency, validation, and production eligibility require a separate design specification.

