# ABCabinet Studio Phase 4: Round 2 AI Agent Design

**Status:** Revised draft for user review
**Revised:** June 25, 2026
**Branch:** `phase-4`

## 1. Product Definition

Round 2 is not a cabinet design application.

It is an AI-assisted workflow that helps Sales, field staff, Designers, and customers move from site measurements to a reviewed kitchen design package with fewer handoffs and less repetitive drafting.

The intended workflow is:

```text
Field measurements and evidence
  → AI organizes the material
  → Designer or staff verifies normalized data
  → AI proposes the cabinet arrangement
  → deterministic code generates standard drawings
  → staff make limited corrections
  → issues are assigned and resolved
  → Admin or Designer performs final review
  → reviewed drawings + JSON + prompt generate renderings
```

The AI Agent should perform as much routine coordination and drafting work as possible. The Designer should not need to recreate every wall, opening, appliance, cabinet, dimension chain, and elevation manually.

Human responsibility is concentrated on:

- Supplying trustworthy site evidence
- Confirming extracted measurements
- Resolving missing or conflicting information
- Reviewing design judgment and exceptions
- Approving the final drawing version

## 2. Phase 4 Boundary

Phase 4 creates the complete frontend design and interaction prototype for this workflow.

It does not add:

- Round 2 database tables
- Round 2 API routes
- Persistent task history
- Real AI extraction
- Real AI cabinet planning
- Real drawing export
- Real approval authority
- Real rendering requests

All Phase 4 interactions use local state and representative project fixtures. The UI must identify itself as a prototype and must not claim that data or approvals have been saved.

The persistent notice is:

```text
Round 2 prototype · Changes are not saved
```

Generated drawing previews in Phase 4 carry:

```text
Prototype drawing · Review required
```

The prototype is nevertheless designed around the future production workflow. Its information architecture, object model, issue flow, versioning, and review states should be suitable foundations for later backend implementation.

## 3. Product Principles

### 3.1 Agent-led, not tool-led

Users should describe, upload, verify, and review. They should not be expected to operate a general CAD system.

### 3.2 Structured data before drawings

AI never creates authoritative geometry directly from prose or images.

The sequence is:

```text
Evidence → normalized JSON → validation → deterministic geometry → drawing
```

### 3.3 Drawings are deterministic

The same reviewed JSON must always produce the same plan, elevations, dimensions, labels, and schedule.

AI may propose JSON values and design decisions. Deterministic code owns drawing geometry and dimension chains.

### 3.4 AI suggestions require provenance

Every extracted or proposed value records:

- Source evidence
- Submitted by
- Extraction method
- Confidence
- Confirmation status
- Last editor
- Last edit time

### 3.5 Exceptions become tasks

Missing measurements, conflicting evidence, design-rule failures, and human review comments become explicit issues with owners and status.

### 3.6 Final review remains human

Only Admin and Designer may complete final review.

Any later change that affects a drawing automatically invalidates the previous review.

## 4. Users and Permissions

Existing project access rules continue to apply.

### Admin

- Enter and edit measurements
- Upload or paste field evidence
- Confirm AI-extracted values
- Adjust design parameters
- Create and assign issues
- Resolve design-review issues
- Complete final review

### Designer

- Enter and edit measurements
- Upload or paste field evidence
- Confirm AI-extracted values
- Review the proposed cabinet design
- Make limited design corrections
- Create and assign issues
- Resolve design-review issues
- Complete final review

### Sales

- Enter and edit measurements
- Upload field evidence
- Confirm straightforward site data
- View drawings and issues
- Receive remeasurement tasks
- Submit replacement measurements and evidence
- Mark assigned field tasks as ready for design review

Sales cannot:

- Close a design conflict
- Complete final review
- Restore a superseded approved version

### Shared edit responsibility

Admin, Designer, and Sales may all change input data.

Every change must appear in the future append-only activity history. There are no anonymous edits and no silent overwrites.

## 5. End-to-End Workflow

Round 2 uses six workflow stages:

```text
1. Collect
2. Organize
3. Verify
4. Generate
5. Resolve
6. Review & Render
```

These are task stages, not drawing-tool modes.

### Stage 1: Collect

Gather field measurements and evidence.

### Stage 2: Organize

AI maps unstructured evidence into the standard measurement schema.

### Stage 3: Verify

People confirm extracted values, resolve conflicts, and complete required fields.

### Stage 4: Generate

The Agent proposes a cabinet design and deterministic code generates the drawing package.

### Stage 5: Resolve

System conflicts and human review comments are assigned, remeasured, corrected, and rechecked.

### Stage 6: Review & Render

Admin or Designer reviews a specific drawing version. Reviewed drawings become eligible to seed rendering generation.

## 6. Entry and Project Integration

Add:

```text
/projects/:projectId/round2
```

The Project Detail Round 2 row becomes an entry point.

Opening Round 2 must not silently change the stored project status.

Round 1 remains a useful reference, but Round 2 does not simply copy rough Round 1 geometry and call it measured data.

Round 1 may prefill:

- Customer preferences
- Layout preference
- Appliance list
- Cabinet style
- Finish selection
- Rough room and opening references
- Existing confirmation items

Every Round 1-derived measurement begins as:

```text
Reference only · Field verification required
```

Round 2 can also start without a Round 1 snapshot when field measurement data is supplied independently.

## 7. Dual Intake

The approved intake model is dual-track:

```text
Standard entry
AI organize evidence
```

Both paths write into the same normalized Round 2 schema.

### 7.1 Standard entry

Designers or staff enter measurements directly into structured forms.

### 7.2 AI organize evidence

The future AI intake accepts:

- Free-form notes
- Voice transcription
- Handwritten measurement-sheet images
- Site photographs
- PDF files
- Excel or CSV files
- Appliance specification documents
- Customer or Sales messages

AI does not send extracted data directly to drawing generation.

It creates a review queue:

```text
Original evidence
  ↔ extracted field
  ↔ confidence and source
  ↔ confirm / correct / reject
```

All AI-extracted values default to `NEEDS_CONFIRMATION`.

## 8. Measurement Entry Experience

The measurement interface is object-based rather than one long form.

### Workspace layout

Desktop and iPad landscape use:

```text
Object navigator | live measured-plan preview | current-object form
```

The navigator groups:

- Project and visit
- Room shell
- Walls
- Openings
- Utilities
- Appliances
- Design standards
- Evidence

The center preview updates from valid draft values.

The form shows only fields relevant to the selected object.

### Fast-entry patterns

- Keyboard-friendly field order
- Numeric keypad-compatible inputs
- Inches and fractional-inch entry
- Feet/inches parsing
- Copy object
- Repeat last offset or height
- Common appliance-size presets
- Add another similar utility point
- Previous/next object navigation
- Save-and-add-next behavior in the future persistent version
- Inline source and confirmation state
- Immediate missing-field feedback

Convenience values may populate fields, but they never become `MEASURED` without human confirmation.

## 9. Standard Measurement Schema

### 9.1 Site visit

- Measurement date
- Measured by
- Unit system
- Site notes
- Source files

### 9.2 Room shell

- Room name
- Ceiling height
- Finished-floor status
- Wall sequence
- Wall-to-wall relationships
- Inside/outside corner types
- Ceiling or soffit conditions

Rooms are not restricted to a four-wall rectangle. The schema supports an ordered wall polygon.

### 9.3 Wall

- Wall ID
- Measured length
- Height
- Thickness where known
- Start corner
- End corner
- Plumb/level note
- Available cabinet zone
- Verification status

### 9.4 Opening

- Type: window, door, open passage
- Wall ID
- Offset from wall start
- Width
- Height
- Sill height
- Header height
- Swing direction where applicable
- Trim or casing allowance
- Verification status

### 9.5 Utility

- Type: water, drain, electric, gas, vent
- Wall ID or floor/ceiling reference
- Horizontal offset
- Vertical offset
- Diameter or service size where relevant
- Related appliance
- Photo or note source
- Verification status

### 9.6 Appliance and fixed equipment

- Type
- Manufacturer/model when available
- Width
- Height
- Depth
- Required clearances
- Door or drawer swing
- Utility requirements
- Preferred location
- Fixed location status
- Specification source

### 9.7 Design standards

- Base cabinet depth
- Wall cabinet depth
- Tall cabinet depth
- Countertop height
- Wall cabinet top height
- Toe-kick height
- Standard fillers
- Panel thickness
- Scribe allowance
- Island target dimensions
- Aisle and work-clearance targets
- Cabinet construction style
- Finish selection

These values are project design inputs, not global manufacturing rules.

## 10. Field State and Provenance

Each normalized field has:

```ts
type Round2FieldState =
  | "MISSING"
  | "AI_EXTRACTED"
  | "NEEDS_CONFIRMATION"
  | "CONFIRMED"
  | "CONFLICT"
  | "MANUALLY_CHANGED";
```

Each field records:

```ts
type Round2FieldProvenance = {
  sourceType:
    | "ROUND1_REFERENCE"
    | "TEXT"
    | "VOICE_TRANSCRIPT"
    | "PHOTO"
    | "MEASUREMENT_SHEET"
    | "PDF"
    | "SPREADSHEET"
    | "MANUAL"
    | "SYSTEM_CALCULATION";
  sourceId: string | null;
  sourceLocation: string | null;
  submittedByUserId: string;
  extractedBy: "HUMAN" | "AI" | "SYSTEM";
  confidence: number | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
};
```

The interface displays provenance without forcing users to open a separate audit page.

## 11. AI Evidence Inbox

Phase 4 includes a complete frontend prototype of the future AI evidence workflow.

### Inbox

Show all uploaded or pasted evidence with:

- File or note name
- Submitted by
- Submitted time
- Processing status
- Fields extracted
- Warnings

### Evidence review

Use a split view:

```text
Evidence preview | extracted fields
```

Selecting a field highlights its evidence location where possible.

Actions:

- Confirm
- Edit and confirm
- Reject extraction
- Mark unreadable
- Create remeasurement task

### Agent follow-up questions

The Agent should produce targeted questions rather than a generic failure:

```text
The sink-wall overall length is 172", but the recorded segments total 171 1/4".
Which value should be remeasured?
```

Questions become tasks and remain linked to the affected fields.

## 12. AI Design Agent

After required measurements are confirmed, the Agent proposes the cabinet arrangement as structured JSON.

The Agent may decide:

- Cabinet sequence by wall
- Cabinet type
- Nominal cabinet widths
- Fillers and panels
- Appliance integration
- Sink and range alignment
- Island cabinet composition
- Wall cabinet heights
- Initial detail notes

The Agent receives:

- Reviewed measurement JSON
- Appliance specifications
- Customer preferences from Round 1
- Project design standards
- Deterministic rule-check results

The Agent outputs:

- Proposed cabinet-layout JSON
- Design rationale
- Assumptions
- Unresolved decisions
- Fields or measurements requiring confirmation

The Agent does not output the final drawing pixels.

## 13. Deterministic Drawing Package

The drawing engine consumes reviewed measurement JSON plus proposed or corrected cabinet-layout JSON.

It generates a standard drawing package.

### 13.1 Measured floor plan

Include:

- Room perimeter
- Wall IDs
- North arrow
- Drawing title and scale
- Doors and windows
- Utilities
- Appliances
- Cabinet footprints
- Island
- Overall room dimensions
- Wall dimension chains
- Opening offsets
- Appliance and cabinet run dimensions
- Island overall and cabinet-segment dimensions
- Elevation reference markers
- Issue markers
- Revision/version label

### 13.2 Wall elevations

Generate an elevation for each active cabinet wall.

Include:

- Floor and ceiling
- Doors and windows
- Appliances
- Base, wall, and tall cabinets
- Fillers and panels
- Countertop
- Overall run width
- Individual cabinet widths
- Vertical dimension chains
- Ceiling and cabinet heights
- Opening dimensions
- Appliance clearances
- Detail and issue markers
- Drawing title and scale

### 13.3 Island elevations

Generate the required island faces.

Include:

- Overall width and height
- Cabinet sequence
- Individual cabinet widths
- Panel and overhang conditions
- Seating side where applicable
- Appliance or sink placement

### 13.4 Cabinet dimension schedule

Include:

- Drawing label
- Cabinet type
- Wall or island run
- Nominal width
- Height
- Depth
- Quantity
- Panel/filler notes
- Review state

This is a design schedule, not a cut list or order list.

### 13.5 Drawing title block

Include:

- Customer
- Project
- Site address where permitted
- Drawing version
- Generated time
- Generated from measurement version
- Prepared by AI Agent
- Reviewed by
- Review status
- Prototype notice in Phase 4

## 14. Drawing Generation Gate

The system may generate a draft drawing package while issues remain, but it must clearly distinguish draft and review-ready states.

### Draft generation requirements

- Room shell is geometrically valid
- Required wall lengths exist
- Openings have a wall and position
- Appliances used in design have dimensions
- Cabinet-layout JSON passes schema validation

### Review-ready requirements

- Required measurements are confirmed
- Dimension chains close within tolerance
- No unresolved blocking geometry conflict
- Required appliance specifications are present
- Cabinet runs fit their available spans
- Required clearances pass or have an explicit accepted exception

## 15. Limited Correction, Not Freeform Design

The correction workspace exists to fix Agent output and field data, not to provide a general design canvas.

Allowed corrections:

- Change a measurement
- Confirm or replace a source value
- Change a cabinet nominal width
- Change a cabinet type
- Swap adjacent cabinets
- Adjust filler or panel allowance
- Move a cabinet or appliance to another valid run
- Change alignment intent
- Add a design note
- Accept a documented exception

Not included:

- Drawing arbitrary geometry
- Freehand drafting
- Unconstrained object placement
- Creating custom cabinet shapes on canvas
- CAD commands
- Layer management
- Precision mouse-only drafting

The primary correction method is structured form editing. Selecting a drawing object opens the corresponding data record.

## 16. Validation and Conflict Detection

### 16.1 System-detected hard conflicts

Deterministic rules detect:

- Room perimeter does not close
- Segment dimensions do not equal overall dimensions
- Opening exceeds wall bounds
- Objects overlap impossibly
- Cabinet run exceeds available wall span
- Cabinet dimension is missing or invalid
- Appliance does not fit its assigned opening
- Door swing conflicts with cabinet or appliance
- Required aisle or work clearance is below target
- Utility and appliance relationship is inconsistent
- Countertop or cabinet height conflicts with opening
- Required data is missing

The system creates issues but does not silently alter measured data.

### 16.2 Human-raised design issues

Admin or Designer may click a drawing object or location and create an issue.

Issue fields:

- Drawing version
- Drawing sheet/view
- Object or coordinate reference
- Issue type
- Description
- Suggested action
- Severity
- Blocking status
- Requires site remeasurement
- Assignee
- Due date
- Evidence

Example:

```text
Sink centerline does not align with the window centerline.
Confirm the window opening offset from Wall A start.
```

## 17. Issue Assignment and Remeasurement Loop

Issue states:

```text
OPEN
  → ASSIGNED
  → WAITING_FOR_SITE
  → WAITING_FOR_DESIGN_REVIEW
  → RESOLVED
```

### Sales or field assignee

Can:

- View the exact drawing marker
- See the specific measurement requested
- Enter replacement values
- Upload photos, notes, or voice evidence
- Submit for design review

Cannot:

- Close a design conflict
- Mark a drawing reviewed

### Admin or Designer

Can:

- Accept submitted evidence
- Reject it and request another measurement
- Update normalized data
- Mark the issue resolved
- Accept a documented design exception

Accepted data triggers:

```text
new normalized-data version
  → new drawing version
  → previous final review invalidated
```

## 18. Activity History and Progress

Every edit becomes an append-only event in the future persistent implementation.

Record:

- Actor
- Role
- Time
- Workflow stage
- Object
- Field
- Previous value
- New value
- Change source
- Related evidence
- Related issue
- Affected drawing version

Change source:

```text
MANUAL_ENTRY
AI_EXTRACTION
AI_DESIGN_PROPOSAL
SYSTEM_CALCULATION
ISSUE_RESOLUTION
FINAL_REVIEW
REVIEW_INVALIDATION
```

Old versions are read-only and cannot be deleted through the normal interface.

### Progress display

Do not use an arbitrary percentage.

Use explicit milestones:

```text
Evidence collected
Data organized
Measurements confirmed
Design proposed
Drawings generated
Issues resolved
Waiting for final review
Designer reviewed
Rendering available
```

The activity timeline explains:

- What happened
- Who did it
- What remains
- Who owns the next task

## 19. Versioning

Version these independently:

- Evidence set
- Normalized measurement data
- Cabinet-layout proposal
- Drawing package
- Final review
- Rendering

Every drawing package records the exact measurement and cabinet-layout versions used.

Every rendering records the exact reviewed drawing version and design JSON used.

Changing drawing-affecting data:

1. Marks the current drawing stale.
2. Invalidates final review.
3. Invalidates rendering eligibility.
4. Creates a new activity event.
5. Requires drawing regeneration and review.

## 20. Final Review

Final review is a dedicated stage, not a checkbox hidden inside drawing generation.

Only Admin and Designer can complete it.

### Review workspace

Review:

- Measured floor plan
- All cabinet-wall elevations
- Island elevations
- Cabinet dimension schedule
- Open issues
- Accepted exceptions
- Data provenance
- Version history

The reviewer can:

- Approve the version
- Create an issue
- Return it for site confirmation
- Return it for design correction
- Compare with the previous drawing version

### Review gate

Final review is enabled when:

- Blocking issues equal zero
- Required drawings exist
- Required measurements are confirmed
- Drawing and source versions match
- Dimension checks pass

The review record includes:

- Reviewer
- Role
- Reviewed time
- Drawing version
- Measurement-data version
- Cabinet-layout version
- Open non-blocking issues
- Accepted exceptions

### Review invalidation

Any later change to:

- Confirmed measurement
- Opening
- Utility
- Appliance
- Cabinet arrangement
- Cabinet dimensions
- Filler/panel allowance
- Design standard affecting geometry

automatically changes the status from:

```text
Designer reviewed
```

to:

```text
Review required after changes
```

## 21. Rendering Generation

Rendering is downstream of reviewed design data.

The rendering request is assembled from:

1. Reviewed measured floor plan image
2. Reviewed elevation images
3. Optional detail-sheet images
4. Reviewed normalized measurement JSON
5. Reviewed cabinet-layout JSON
6. Cabinet style and finish data
7. Appliance information
8. Deterministic spatial summary
9. Rendering prompt

The drawing images provide spatial references.

JSON provides explicit object identities, dimensions, relationships, and material choices.

The prompt instructs the image model to:

- Preserve the reviewed arrangement
- Preserve door and window positions
- Preserve appliances
- Preserve cabinet proportions and run structure
- Match the selected cabinet finish
- Produce a customer-facing realistic visualization

The image model never becomes the source of drawing geometry or cabinet dimensions.

Renderings are versioned against the reviewed drawing package. A new reviewed drawing version marks older renderings stale but does not delete them.

## 22. Phase 4 Frontend Screens

### 22.1 Round 2 overview

- Current milestone
- Next responsible person
- Evidence summary
- Data-confirmation summary
- Latest drawing version
- Open issue count
- Final-review status
- Latest rendering
- Activity timeline

### 22.2 Measurement workspace

- Object navigator
- Live measured-plan preview
- Current-object form
- Field provenance and state
- Missing/conflict summary

### 22.3 AI evidence inbox

- Evidence list
- Evidence preview
- Extracted-field review
- Agent follow-up questions
- Confirm/reject/correct actions

### 22.4 Design proposal

- Agent-proposed cabinet arrangement
- Rationale
- Assumptions
- Decisions requiring review
- Structured correction controls

### 22.5 Drawing package

- Sheet navigator
- Measured plan
- Wall elevations
- Island elevations
- Cabinet schedule
- Dimension and issue overlays
- Regenerate action
- Version selector

### 22.6 Issue center

- Open issues
- Drawing markers
- Assignee
- Status
- Site evidence
- Design-review actions

### 22.7 Final review

- Version comparison
- Review checklist
- Open non-blocking issues
- Accepted exceptions
- Approve/return actions

### 22.8 Rendering

- Reviewed source summary
- Prompt summary
- Generate-rendering prototype action
- Rendering preview/history
- Stale marker

## 23. Responsive Behavior

### Desktop

- Persistent Studio rail
- Task/status navigation
- Main evidence, form, drawing, or review surface
- Context panel for selected field/object/issue

### iPad landscape

- Preserve navigator, main surface, and context panel
- Reduce side widths before drawing area
- Support field entry and drawing review

### iPad portrait

- Stage navigation becomes a compact top control
- Main drawing/evidence surface remains primary
- Current form or issue details become a bottom sheet
- All actions use 44px minimum targets

Phone is a task and progress surface only. Full measurement entry and drawing review are not required on phone.

## 24. State Architecture for Phase 4

Phase 4 uses local fixture-backed state, but mirrors the future domain boundaries:

```ts
type Round2PrototypeState = {
  evidence: EvidenceItem[];
  measurementVersion: MeasurementVersion;
  cabinetProposalVersion: CabinetProposalVersion | null;
  drawingVersions: DrawingVersion[];
  issues: Round2Issue[];
  review: FinalReview | null;
  renderings: RenderingPreview[];
  activity: ActivityEvent[];
  ui: Round2UiState;
};
```

The prototype supports:

- Editing normalized fields
- Confirming AI-extracted fields
- Generating an Agent proposal fixture
- Generating deterministic drawing scenes
- Creating and assigning issues
- Submitting remeasurement evidence
- Resolving issues
- Invalidating review after changes
- Completing Admin/Designer review
- Generating a rendering preview fixture

It does not persist these actions.

## 25. Required Prototype States

- No field evidence
- Evidence processing
- AI extraction ready
- AI extraction conflict
- Missing required measurements
- Measurement confirmation ready
- Design proposal generating
- Proposal ready
- Drawing generating
- Draft drawing
- Drawing conflict
- Waiting for site confirmation
- Waiting for design review
- Review-ready
- Designer reviewed
- Review invalidated
- Rendering eligible
- Rendering generating
- Rendering available
- Rendering stale

## 26. Accessibility

- Every field has a visible label.
- Measurement state is not communicated by color alone.
- Evidence-to-field relationships are keyboard accessible.
- Drawing objects have accessible labels.
- Selecting a drawing object opens the corresponding record.
- Issue markers can be reached from an issue list.
- Issue jumps move focus to the relevant field or drawing heading.
- All limited corrections have form-based alternatives.
- Final-review dialogs return focus correctly.
- Dimension text meets contrast requirements.
- Reduced motion disables nonessential transitions.

## 27. Testing Strategy

### Pure model tests

- Evidence normalization fixtures
- Field provenance and status transitions
- Required-field checks
- Measurement version creation
- Cabinet-proposal schema
- Review invalidation
- Role permissions
- Activity-event generation

### Deterministic drawing tests

- Same JSON produces identical scenes
- Room perimeter closes
- Dimension chains equal source measurements
- Opening offsets match JSON
- Cabinet runs equal cabinet-layout JSON
- Elevations match plan object identities
- Island elevations match island sequence
- Removing/changing a cabinet updates plan, elevation, and schedule

### Issue tests

- System conflict creation
- Human issue creation
- Assignment
- Site-evidence submission
- Admin/Designer resolution
- Sales cannot close design conflict
- Blocking issue prevents final review

### Markup tests

- Dual intake entry
- Field provenance
- Progress milestones
- Drawing version
- Activity actor and time
- Review role restrictions
- Review invalidation
- Rendering source version
- Prototype notices

### Browser acceptance

1. Enter measurements through standard entry.
2. Review an AI-extracted fixture.
3. Resolve an extraction conflict.
4. Generate a cabinet proposal.
5. Generate measured plan and elevations.
6. Correct one cabinet width.
7. Confirm a new drawing version appears.
8. Create a drawing issue.
9. Assign it to Sales for remeasurement.
10. Submit new field evidence as Sales.
11. Resolve it as Admin or Designer.
12. Complete final review.
13. Change a reviewed dimension and confirm review is invalidated.
14. Re-review and generate a rendering preview.
15. Confirm no Phase 4 Round 2 mutation API is called.

## 28. Acceptance Criteria

Phase 4 is accepted when:

- The experience reads as an Agent-led workflow, not CAD software.
- Standard measurement entry is fast and object-based.
- AI evidence organization has a complete review prototype.
- Every extracted value has provenance and confirmation state.
- The Agent proposal is structured data, not a raster drawing.
- Deterministic code generates a measured plan, wall elevations, island elevations, dimensions, and cabinet schedule.
- Corrections are constrained and data-driven.
- System and human issues share one assignment workflow.
- All edits appear in activity history with actor and before/after values.
- Admin and Designer can complete final review.
- Sales cannot close design conflicts or complete final review.
- Drawing-affecting changes invalidate review.
- Renderings are generated from reviewed drawings, JSON, and prompt.
- Desktop and iPad workflows pass visual QA.
- No Round 2 database, API, real AI call, real export, or real rendering request is introduced in Phase 4.

## 29. Future Backend Handoff

Backend implementation requires a separate specification covering:

- Evidence storage
- AI extraction jobs
- Measurement schema persistence
- Cabinet proposal versions
- Drawing versions and file storage
- Issue assignment and notifications
- Append-only activity events
- Review permissions and signatures
- Rendering job orchestration
- Concurrency and edit conflicts
- Audit retention

Phase 4 defines the product and frontend contracts. It does not silently decide server authority or production-release rules.
