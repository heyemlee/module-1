# ABCabinet Studio Phase 4: Round 2 AI Agent Design

**Status:** Revised interaction design for user review
**Revised:** June 25, 2026
**Branch:** `phase-4`

## 1. Product Definition

Round 2 is not a cabinet design application.

It is an AI-assisted workflow that helps Sales, field staff, Designers, and customers move from site measurements to a reviewed kitchen design package with fewer handoffs and less repetitive drafting.

The intended user-facing workflow is:

```text
Measurement data
  → Design proposal
  → Drawings and review
```

Standard measurement entry is the only authoritative intake workflow. Uploading existing evidence is an optional assistant inside that workflow. AI may extract information from evidence and prefill the standard fields, but it does not create a separate product mode or a separate source of truth.

Behind the three user-facing tasks, the system performs extraction, confirmation, deterministic validation, structured design generation, drawing generation, issue tracking, and version review.

The AI Agent should perform as much routine extraction, coordination, and drafting work as possible. The Designer should not need to recreate every wall, opening, appliance, cabinet, dimension chain, and elevation manually.

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

### 3.5 AI assists the standard workflow

AI extraction is not a separate mode, inbox, or workflow stage. It fills empty standard fields, attaches evidence and confidence, and asks targeted questions when a value cannot be determined safely.

AI never overwrites a human-confirmed value. A disagreement becomes a visible conflict.

### 3.6 Exceptions appear in context

Missing measurements, conflicting evidence, design-rule failures, and human review comments become explicit issues with owners and status.

Issues appear beside the affected field, object, design decision, or drawing marker. A global issue list may be available as a secondary drawer, but issue resolution is not a separate primary workflow stage.

### 3.7 Final review remains human

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

Round 2 presents three primary tasks.

### Task 1: Measurement data

Users enter the standard site-measurement schema.

They may begin immediately or upload existing evidence first. Uploading evidence starts AI extraction and prefills eligible fields. In either case, the user arrives at the same standard-entry workspace.

This task includes:

- Room and wall measurements
- Openings
- Utilities
- Appliances
- Project design standards
- AI-prefilled values awaiting confirmation
- Missing values
- Conflicting values
- Remeasurement requests

Completion condition:

```text
All required measurement values exist and are human-confirmed.
```

### Task 2: Design proposal

The Agent uses confirmed measurement JSON, appliance specifications, Round 1 preferences, design standards, and deterministic rule-check results to propose a structured cabinet layout.

The user reviews:

- Plan and elevation previews
- Cabinet sequence and nominal dimensions
- AI rationale
- Assumptions
- Decisions requiring review
- Blocking design conflicts

The user may make limited structured corrections. This is not a freeform CAD workspace.

Completion condition:

```text
The proposal has no unresolved blocking design issue.
```

### Task 3: Drawings and review

Deterministic code generates the standard drawing package from the confirmed measurement version and accepted cabinet-layout version.

Users review drawings, handle issues beside the relevant drawing or object, and complete final review for a specific version.

Completion condition:

```text
An Admin or Designer reviews the current drawing version.
```

Reviewed drawings may seed rendering generation.

### Internal states

The implementation may still track states such as collecting, extracting, confirming, generating, resolving, and reviewing. These are system states and progress indicators, not left-navigation destinations.

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

## 7. Single Intake with Optional AI Prefill

Round 2 has one intake model:

```text
Standard measurement entry
```

The entry screen does not ask the user to choose a mode.

It presents:

- Primary action: `Enter measurement data`
- Optional action: `Upload evidence to prefill`
- A concise explanation of supported evidence

Users who do not upload evidence go directly to standard entry.

Users who upload evidence follow:

```text
Upload evidence
  → AI extracts eligible values
  → standard fields are prefilled
  → user enters the same standard-entry workspace
  → user confirms, corrects, and completes the data
```

Uploading evidence remains available inside the standard-entry workspace so additional material can be added later.

### 7.1 Supported evidence

The future upload assistant accepts:

- Free-form notes
- Voice transcription
- Handwritten measurement-sheet images
- Site photographs
- PDF files
- Excel or CSV files
- Appliance specification documents
- Customer or Sales messages

The UI explains the accepted categories before file selection. The product does not require every source file to use a single rigid template.

### 7.2 AI prefill contract

AI extraction must follow these rules:

- AI writes only into the defined standard measurement schema.
- AI may prefill empty fields.
- AI may not invent additional authoritative fields outside the schema.
- AI may not overwrite a human-confirmed value.
- A disagreement with a confirmed value becomes `CONFLICT`.
- An uncertain or unreadable value remains empty.
- AI attaches source evidence, source location where available, extraction method, and confidence.
- Every AI-prefilled value starts as `NEEDS_CONFIRMATION`.
- High confidence does not bypass human confirmation.
- AI may ask a targeted follow-up question or suggest a remeasurement task.
- AI-extracted data cannot pass the drawing-generation gate until confirmed by a person.

## 8. Measurement Entry Experience

The interface should present the work in business terms rather than expose the internal object model.

Do not use `Object Navigator` as the primary user-facing label or make an empty plan canvas the first screen.

### 8.1 Entry screen

The first Round 2 screen introduces the task:

```text
Enter site measurement data
```

Primary card:

```text
Enter measurement data
```

Secondary card:

```text
Upload evidence to prefill
```

The secondary card lists supported sources and explains that AI only prefills the standard form.

### 8.2 Standard-entry workspace

Desktop and iPad landscape use:

```text
Data checklist | current form | completion summary
```

The data checklist uses recognizable categories:

- Site visit and room
- Walls
- Openings
- Utilities
- Appliances
- Design standards

Each category shows a plain-language status such as:

- Complete
- `1 of 2 complete`
- `2 required values missing`
- `3 AI values awaiting confirmation`
- Conflict

The current form shows one understandable data group at a time. AI-prefilled values appear in the form, not in a separate AI inbox.

The completion summary shows:

- Overall completion
- Confirmed values
- AI values awaiting confirmation
- Required missing values
- Conflicts
- The condition preventing design generation

`Generate design proposal` remains disabled until the required gate passes.

### 8.3 Inline AI confirmation

An AI-prefilled field displays:

- Proposed value
- Confidence
- Source file or note
- Source location when available
- Confirm action
- Edit action
- View-source action

The interface must make it obvious that the value is proposed rather than confirmed.

### Fast-entry patterns

- Keyboard-friendly field order
- Numeric keypad-compatible inputs
- Inches and fractional-inch entry
- Feet/inches parsing
- Copy object
- Repeat last offset or height
- Common appliance-size presets
- Add another similar utility point
- Previous/next data-group navigation
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
  | "NEEDS_CONFIRMATION"
  | "CONFIRMED"
  | "CONFLICT";
```

Whether a confirmed value was manually entered or edited remains available through provenance and activity history rather than requiring a separate visual state.

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

## 11. Evidence and AI Assistance

Phase 4 does not include a separate `Organize` stage or AI Evidence Inbox in the primary navigation.

Evidence is managed from the measurement-data task.

### 11.1 Evidence list

A secondary evidence panel or drawer may show:

- File or note name
- Submitted by
- Submitted time
- Processing status
- Fields prefilled
- Warnings

Selecting `View source` from a field opens the relevant evidence and highlights its location where possible.

### 11.2 Evidence actions

- Upload more evidence
- View source
- Confirm proposed value
- Edit and confirm
- Reject extraction
- Mark unreadable
- Create remeasurement task

### 11.3 Agent follow-up questions

The Agent should produce targeted questions rather than a generic failure:

```text
The sink-wall overall length is 172", but the recorded segments total 171 1/4".
Which value should be remeasured?
```

Questions become tasks and remain linked to the affected fields.

The Agent must not guess a value merely to complete the form.

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

Problem detection uses three explicit sources. The UI labels the source so users understand why the warning exists.

### 16.1 Deterministic system checks

These checks do not require an LLM.

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

Deterministic code owns whether a known numerical, geometric, schema, or clearance rule passes. LLM output must not determine authoritative geometry validity or blocking status.

### 16.2 AI evidence-understanding alerts

An LLM or vision model may identify uncertainty or inconsistency in unstructured evidence, for example:

- A handwritten value may be `72` or `77`
- A photograph is too blurred to read safely
- A note mentions an appliance but no specification is supplied
- A PDF and a text message appear to disagree
- A source contains a measurement that cannot be mapped confidently to a standard field

These alerts are suggestions requiring human review. They do not silently change data or independently establish a blocking geometry failure.

### 16.3 Human-raised design issues

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

### 16.4 Problem presentation

Problems appear beside their context:

- A missing value appears in its form group.
- An evidence conflict appears on the affected field.
- A design-rule failure appears beside the affected proposal object.
- A drawing comment appears on or beside its drawing marker.

A global problem-list drawer may aggregate all open items for assignment and tracking. It is a secondary utility, not a main workflow stage.

Labels distinguish:

- `System check`
- `AI evidence alert`
- `Designer comment`

An LLM may optionally rewrite an already-detected problem into a concise action-oriented explanation. It cannot decide whether a deterministic rule passed.

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

The primary navigation shows only:

```text
Measurement data
Design proposal
Drawings and review
```

It may show completion, current status, and blockers for each task.

The interface must not present the former six internal stages as equally selectable navigation items.

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

A completion percentage may be shown only when it is derived from required-field completion and confirmation. It must be accompanied by explicit counts for confirmed, missing, pending, and conflicting values.

Use explicit task status:

```text
Measurement data · In progress / Blocked / Complete
Design proposal · Not started / In review / Blocked / Complete
Drawings and review · Not started / Draft / Review required / Reviewed
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

Final review is a dedicated workspace inside `Drawings and review`, not a checkbox hidden inside drawing generation.

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

### 22.1 Measurement-data entry

- Primary `Enter measurement data` action
- Optional `Upload evidence to prefill` action
- Supported-evidence explanation
- Prototype notice

### 22.2 Measurement workspace

- Data checklist
- Current data-group form
- Completion summary
- Inline AI-prefill confirmation
- Missing and conflict messages
- Upload-more-evidence action
- Secondary source-evidence viewer

### 22.3 Design proposal

- Agent-proposed cabinet arrangement
- Rationale
- Assumptions
- Decisions requiring review
- Structured correction controls

### 22.4 Drawings and review

- Sheet navigator
- Measured plan
- Wall elevations
- Island elevations
- Cabinet schedule
- Dimension and issue overlays
- Regenerate action
- Version selector
- Version comparison
- Review checklist
- Open non-blocking issues
- Accepted exceptions
- Approve/return actions
- Contextual problem handling
- Secondary problem-list drawer

### 22.5 Rendering

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

- Three-task navigation becomes a compact top control
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

- Single standard-entry workflow
- Optional upload-to-prefill action
- Field provenance
- Three-task navigation
- Drawing version
- Activity actor and time
- Review role restrictions
- Review invalidation
- Rendering source version
- Prototype notices

### Browser acceptance

1. Open Round 2 and confirm direct entry is the primary action.
2. Skip evidence upload and enter the standard measurement workspace.
3. Return to entry, upload an evidence fixture, and confirm it prefills the same workspace.
4. Confirm an AI-prefilled value shows source, confidence, and confirmation controls.
5. Confirm an AI-prefilled value cannot bypass human confirmation.
6. Resolve an extraction conflict in the affected field.
7. Complete required measurements and generate a cabinet proposal.
8. Generate measured plan and elevations.
9. Correct one cabinet width.
10. Confirm a new drawing version appears.
11. Create a drawing issue beside the affected drawing object.
12. Assign it to Sales for remeasurement.
13. Submit new field evidence as Sales.
14. Resolve it as Admin or Designer.
15. Complete final review.
16. Change a reviewed dimension and confirm review is invalidated.
17. Re-review and generate a rendering preview.
18. Confirm no Phase 4 Round 2 mutation API is called.

## 28. Acceptance Criteria

Phase 4 is accepted when:

- The experience reads as an Agent-led workflow, not CAD software.
- The first screen clearly offers direct standard entry as the primary action.
- Evidence upload is optional AI prefill assistance, not a separate mode.
- Uploading evidence and skipping upload both lead to the same standard-entry workspace.
- Standard measurement entry uses a business-readable data checklist rather than an `Object Navigator`.
- Every AI-prefilled value has provenance, confidence, and confirmation controls.
- Human confirmation is required for every AI-prefilled value.
- Users can upload additional evidence while standard entry is in progress.
- The main workflow contains only Measurement data, Design proposal, and Drawings and review.
- The Agent proposal is structured data, not a raster drawing.
- Deterministic code generates a measured plan, wall elevations, island elevations, dimensions, and cabinet schedule.
- Corrections are constrained and data-driven.
- Missing data, conflicts, and review comments appear beside the relevant context.
- A global problem list is secondary and does not become a separate primary stage.
- The UI distinguishes deterministic system checks, AI evidence alerts, and human comments.
- Deterministic validation, not an LLM, controls numerical and geometric blocking rules.
- System, AI-assisted, and human-raised problems share one assignment workflow where assignment is required.
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
