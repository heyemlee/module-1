# ABCabinet Studio Round 2 Visual Prototype

**Status:** Approved visual direction
**Date:** July 1, 2026
**Scope:** High-fidelity Next.js visual prototype with fixture data only
**Visual reference:** `docs/design-references/round2-professional-drawing-reference.png`

## 1. Objective

Create a high-fidelity Round 2 prototype that feels like a direct, more precise continuation of the existing Round 1 Studio workspace.

The prototype validates:

- a field-measurement experience optimized for Sales;
- a cabinet-design and review experience optimized for Designers;
- a professional drawing-set presentation based on the supplied reference.

This phase does not introduce a Round 2 database, real AI extraction, production cabinet-planning rules, approval authority, or production drawing export.

## 2. Product Boundary

Round 2 uses one shared project with two role-specific workspaces.

Round 2 cannot start until a complete Round 1 layout snapshot has been
explicitly locked as its reference. The lock is a strict entry gate, not an
optional prefill action.

The locked Round 1 reference supplies:

- layout topology and deterministic floor-plan geometry;
- appliance list and rough appliance positions;
- preliminary cabinet arrangement;
- cabinet style and door color;
- position overrides and unresolved confirmation items.

The Round 1 snapshot remains immutable. Round 2 copies it into a reference
version and records all later precision work as Round 2 proposal versions.

### Sales responsibility

Sales captures and submits authoritative site measurements.

- Sales may lock a complete Round 1 snapshot for Round 2.
- Sales may create and edit measurements before submission.
- Submitting creates a named `Measurement Version`.
- The submitted measurement version is the sole dimensional source of truth for the design.
- Sales receives remeasurement requests tied to a specific wall, opening, utility, appliance, or dimension.

### Designer responsibility

Designers create and review the cabinet design from the submitted measurement version.

- Designers and Admins may lock a complete Round 1 snapshot for Round 2.
- Designers cannot silently edit submitted measurements.
- Designers may adjust exact cabinet positions, widths, appliance relationships,
  island or peninsula placement, color, style, and other design decisions.
- Designer adjustments create new Round 2 proposal versions and never modify
  the historical Round 1 snapshot.
- If measurement data appears wrong or insufficient, the Designer creates a remeasurement request.
- A later Sales measurement version makes affected proposals and drawings stale and requires another design review.

## 3. Visual Language

Application chrome must inherit the existing Round 1 Studio system:

- monochrome liquid-glass surfaces;
- `Space Grotesk` interface typography;
- `JetBrains Mono` for measurements, versions, and technical metadata;
- restrained black, white, and gray palette;
- dark drawing canvas;
- soft shell gradients and subtle glass borders;
- 12–18px radii for application panels;
- compact, precise control typography;
- strong canvas-to-inspector hierarchy.

The final drawing sheet uses a separate technical language:

- white paper background;
- black structural and cabinet linework;
- cyan measurements, dimension chains, openings, and technical annotations;
- orange cabinet boundaries and fillers;
- red cabinet identification numbers;
- print-oriented spacing and a visible sheet border;
- version, scale, sheet name, measurement source, proposal source, and review state.

The professional drawing reference governs information density and drawing appearance. The existing standalone Round 2 HTML does not govern visual styling.

## 4. Information Architecture

The prototype route is:

```text
/projects/:projectId/round2
```

Round 2 has three primary tasks:

1. `Field Measurement`
2. `Design Proposal`
3. `Drawings & Review`

The same project and fixture data flow through all tasks. Role and task determine the default presentation.

### Round 1 handoff gate

Before the three tasks appear, the route checks for a locked Round 1 reference.

- With no locked reference, the user sees only the Handoff screen.
- The screen previews the available complete Round 1 snapshot: layout, plan,
  cabinet style, door color, appliances, and confirmation items.
- Sales, Designer, and Admin may choose `Lock for Round 2`.
- Incomplete Round 1 drafts cannot be locked.
- After locking, the three Round 2 tasks become available.
- The active Round 1 reference remains visible in the Round 2 project header.

The prototype supports replacing the active reference. Replacing it increments
the reference version and marks current measurement mappings, proposals, and
drawings as requiring revalidation. Multi-draft branching for every reference
is not part of this visual prototype.

### Sales default

Sales enters `Field Measurement`.

### Designer default

Designer enters `Design Proposal` when an authoritative measurement version exists.

### Shared visibility

Designers may inspect submitted measurement data in read-only form. Sales may view generated proposals and drawings but cannot modify or approve cabinet-design decisions.

## 5. Field Measurement Workspace

The Sales workspace extends the proven Round 1 layout:

- project bar at the top;
- compact Round 2 task navigation;
- 380px left entry panel;
- large live measured-plan canvas;
- contextual progress, save, and submission state.

### Left panel

The panel presents a guided business-readable checklist rather than a generic object tree.

Sections:

- Room
- Walls
- Openings
- Utilities
- Appliances
- Review & Submit

Each section exposes one focused group at a time. Required values show explicit text state in addition to color.

### Live measured plan

The right canvas updates as the user enters values.

- The current wall or object is emphasized.
- Dimension text uses technical mono typography.
- Missing geometry remains visibly incomplete.
- Confirmed geometry becomes solid.
- Openings, utilities, and appliances use distinct technical marks.
- Open boundaries show no invented diagonal, curved, or dashed closing line.
- Zoom and fit controls remain compact and secondary.

### Submission

The primary completion action is `Submit measurement vN`.

The visual prototype simulates:

- complete submission;
- missing required value;
- remeasurement request;
- newer measurement version.

## 6. Designer Proposal Workspace

The Designer workspace is not a freeform CAD editor. It is a structured design-review environment.

### Persistent header

The header shows:

- project and room;
- proposal version;
- locked measurement version;
- current review state;
- stale state when a newer measurement version exists.
- locked Round 1 reference version and source snapshot time.

### Paired drawing workspace

The main surface shows two synchronized views:

- a larger top-down plan;
- a selected-wall elevation.

The top view remains the primary spatial reference. The selected elevation is large enough to inspect cabinet heights, openings, appliances, fillers, and clearances.

Wall A, Wall B, Wall C, and any additional valid elevations are available through compact tabs or thumbnails.

### Synchronized selection

Selecting a wall or cabinet in either view:

- highlights the same object in both views;
- opens its structured design controls;
- shows associated rule checks and comments;
- reveals any remeasurement request for the same source geometry.

### Decision rail

The right rail contains only contextual design work:

- selected cabinet or run;
- allowed structured adjustments;
- rule-check result;
- design assumption;
- unresolved decision;
- request remeasurement;
- accept or resolve design exception.

Round 2 precision controls may adjust cabinet offsets, run composition,
cabinet width, island or peninsula placement, and appliance relationships.
They may not edit authoritative field dimensions or rewrite the locked Round 1
snapshot.

Submitted measurements are visibly read-only.

## 7. Drawings & Review Workspace

This task presents a professional drawing set rather than simplified preview cards.

Minimum fixture sheets:

- `A1` Measured floor plan
- `A2` Wall A elevation
- `A3` Wall B elevation
- `A4` Wall C elevation
- `S1` Cabinet schedule

The screen provides:

- sheet navigation;
- fit, zoom, and full-sheet inspection;
- issue markers tied to drawing objects;
- drawing version and source-version metadata;
- simulated review state;
- simulated stale state after a new measurement version.

The prototype drawing must visually reproduce the supplied reference's level of detail:

- nested dimension chains;
- overall dimensions;
- cabinet divisions;
- door and drawer conventions;
- appliance and opening linework;
- cabinet numbers;
- fillers and panel widths;
- relevant vertical dimensions on elevations.

The prototype may use one carefully authored fixture drawing. It must not imply arbitrary-room production generation is already implemented.

## 8. Prototype State Model

All state is local fixture state.

```ts
type Round2VisualPrototypeState = {
  referenceLocked: boolean;
  referenceVersion: number;
  referenceSnapshotId: string | null;
  role: "SALES" | "DESIGNER";
  task: "MEASUREMENT" | "PROPOSAL" | "DRAWINGS";
  measurementVersion: number;
  measurementStatus: "DRAFT" | "SUBMITTED" | "REMEASURE_REQUESTED";
  proposalVersion: number | null;
  proposalStatus: "READY" | "NEEDS_DECISION" | "STALE";
  drawingVersion: number | null;
  drawingStatus: "DRAFT" | "REVIEW_READY" | "REVIEWED" | "STALE";
  selectedWall: "A" | "B" | "C";
  selectedObjectId: string | null;
  issueId: string | null;
  cabinetOffsets: Record<string, { x: number; y: number }>;
};
```

The state exists to demonstrate visual behavior, not backend contracts.

## 9. Core Interactions

The visual prototype must support:

- previewing and locking a complete Round 1 reference;
- refusing entry to the three tasks until a reference is locked;
- replacing the reference and showing downstream revalidation state;
- switching among the three primary tasks;
- switching between Sales and Designer demo roles;
- stepping through measurement sections;
- editing representative dimensions;
- updating the measured plan visually;
- submitting a simulated measurement version;
- selecting walls and cabinets in plan and elevation;
- synchronized plan/elevation highlighting;
- changing one allowed cabinet design option;
- adjusting one cabinet's exact Round 2 position without changing Round 1;
- opening and resolving one design decision;
- creating one remeasurement request;
- switching drawing sheets;
- toggling drawing fit and zoom;
- showing reviewed and stale drawing states.

## 10. Component Boundaries

Recommended feature structure:

```text
src/features/round2/
  round2-visual-prototype.tsx
  round2-workspace-shell.tsx
  round2-task-navigation.tsx
  round2-fixtures.ts
  measurement/
    measurement-panel.tsx
    measured-plan.tsx
  proposal/
    proposal-workspace.tsx
    design-plan.tsx
    wall-elevation.tsx
    decision-rail.tsx
  drawings/
    drawing-review.tsx
    drawing-sheet.tsx
    cabinet-schedule.tsx
```

The page route loads project context and renders the client prototype. Static fixture definitions stay outside interactive components.

## 11. Responsive Behavior

### Desktop

- Sales uses a 380px form rail and fluid plan canvas.
- Designer uses top view, selected elevation, and decision rail in one viewport.

### iPad landscape

- Sales preserves the split view with a narrower form rail.
- Designer keeps plan and elevation visible; the decision rail becomes a drawer.

### iPad portrait

- The drawing surface remains primary.
- Entry or decision controls become a bottom sheet.

### Phone

Phone is limited to task status, issue viewing, and remeasurement prompts. Full measurement entry and detailed design review are not prototype acceptance requirements.

## 12. Accessibility

- Every input has a visible label.
- Measurement and issue state is never communicated by color alone.
- Task navigation uses `aria-current`.
- Plan and elevation provide a form/list alternative to graphical selection.
- Synchronized selection is announced through a live status message.
- Drawing tabs are keyboard accessible.
- Focus moves to the relevant field or decision after selecting an issue.
- Pointer targets are at least 44px on iPad layouts.
- Reduced motion disables nonessential transitions.

## 13. Error and Stale States

The visual prototype must make these states explicit:

- Round 1 reference not locked;
- selected Round 1 snapshot incomplete and unavailable for locking;
- new Round 1 reference requiring measurement revalidation;
- required measurement missing;
- value awaiting Sales confirmation;
- Designer remeasurement request;
- proposal based on an older measurement version;
- drawing based on an older proposal or measurement version;
- unresolved design decision blocking review.

Errors appear beside the affected context and in a secondary summary. They do not create another primary workflow stage.

## 14. Verification

### Automated checks

- route renders for an existing fixture project;
- role switch changes the default workspace;
- submitted measurements are read-only for Designer;
- plan/elevation selection stays synchronized;
- remeasurement request marks proposal review as blocked;
- new measurement version marks proposal and drawing stale;
- drawing sheet navigation updates the visible sheet.

### Visual checks

- desktop at 1440×900;
- iPad landscape at 1180×820;
- iPad portrait at 820×1180;
- comparison against Round 1 shell, navigation, typography, and canvas treatment;
- comparison against the supplied professional drawing reference;
- no clipped primary content or accidental horizontal scrolling;
- technical drawing text remains legible at default zoom;
- Sales and Designer workspaces visibly prioritize their different responsibilities.

## 15. Acceptance Criteria

The visual prototype is accepted when:

- it looks like the same product as Round 1;
- the three Round 2 tasks are unavailable until a complete Round 1 reference is
  locked;
- the locked reference visibly carries Round 1 layout, color, appliances, and
  rough plan context into Round 2;
- Sales can understand where and how to enter authoritative measurements;
- Designer sees submitted measurements as locked source data;
- Designer can review the plan and selected elevation at the same time;
- selecting a wall or cabinet visibly connects plan, elevation, and decision context;
- a Designer can request remeasurement without editing Sales data;
- a Designer can make exact cabinet-position adjustments as new Round 2
  proposal versions without rewriting Round 1;
- open room boundaries contain no invented diagonal or curved closure;
- the drawing review surface looks like a professional cabinet drawing set;
- the fixture drawing contains the reference color conventions and information density;
- core interactions work with local state;
- no UI claims that production persistence, AI planning, or drawing export already exists.

## 16. Explicitly Deferred

- Round 2 database schema and persistence
- Real evidence upload and AI extraction
- Production cabinet-planning engine
- General-purpose room geometry
- CAD/DXF integration
- Production PDF generation
- Order, cut-list, or manufacturing output
- Real approval signatures and permissions
- Notifications and append-only audit history
- Persistent multi-draft branching for every historical Round 1 reference
