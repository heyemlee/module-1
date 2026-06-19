# AI Context: Module 1 Round 1 MVP

Date: 2026-06-16
Scope: Module 1 only, Round 1 showroom intake, layout generation, preliminary cabinet estimate
Status: Implementation in progress. Deterministic core, API skeleton, conditional showroom intake UI, prompt generation, OpenAI image adapter boundary + REST client, standard-width cabinet matching, rough cabinet estimate summary, up-to-3-inch filler allowance, and local advanced designer/sales cabinet review UI are implemented and verified.

Architecture decision (2026-06-16): the customer-facing top-down layout is rendered as a deterministic, data-driven SVG floor plan (not an AI image). AI image generation does not produce the plan. The earlier crude SVG overlay and the AI-background approach are superseded by a tuned, data-driven SVG plan renderer. See "Confirmed Generation Strategy" below. The data-driven SVG plan renderer is the active work item; the next steps (multi-wall layouts, appliance-placement tuning, persistence, optional realistic render) are consolidated under "Next Session — Remaining Work".

## Source Of Truth

This file is the working memory and implementation context for Module 1 Round 1 MVP.

Do not rely on `docs/module-1-round1-mvp-plan.md`; that earlier planning file has been removed to avoid duplicate sources of truth.

This file should only describe Module 1. Module 2 production engineering and Module 3 shopfloor execution should have separate context files later.

## Product Intent

The Round 1 layout is a customer confirmation and sales-estimate artifact.

Its job is to help the customer confirm the approximate positions of the major kitchen fixed points and appliances, then show how base cabinets and wall cabinets can be filled around those constraints.

The Round 1 layout is not a production drawing, not a field-measured plan, and not manufacturing data.

Every generated output must preserve:

- `salesEstimateOnly: true`
- `notForProduction: true`
- `dimensionConfidence: "ROUGH"` unless exact measured values are provided
- `Confirmation Required` flags for missing, approximate, or non-standard information

## Technical Stack

Use this stack for the Module 1 MVP:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Zod for form and normalized JSON validation
- Vitest for deterministic business-rule tests
- OpenAI image generation through a dedicated image adapter
- `OPENAI_IMAGE_MODEL` environment variable for model selection, defaulting to `gpt-image-2`
- Lightweight repository abstraction for MVP storage, with the option to swap to Postgres later

Do not use n8n as the core Round 1 workflow engine in V1.

n8n can be useful later for CRM updates, reminders, deposit follow-up, notifications, or external business automation. It should not own cabinet rules, readiness gates, layout source-of-truth, or production eligibility.

## Agent-Assisted Boundary

Module 1 is an agent-assisted workflow, not a fully autonomous agent.

AI/Agent may:

- Help sales整理 customer input into structured fields
- Convert the form JSON into a layout prompt
- Generate the top-down layout background
- Summarize `Confirmation Required` items
- Explain why a position, appliance dimension, MEP item, or cabinet assumption needs confirmation

AI/Agent must not:

- Become the source of truth for cabinet dimensions, cabinet codes, or cabinet counts
- Mark Round 1 data as production-ready
- Bypass deterministic readiness checks
- Bypass `salesEstimateOnly: true`
- Bypass `notForProduction: true`
- Silently close `Confirmation Required` items

Deterministic code must own:

- Form schema validation
- Normalized JSON schema validation
- Cabinet code generation
- Standard cabinet split
- Preliminary cabinet list generation
- Round 1 readiness
- Production gate rejection for Round 1 data
- Programmatic overlay of base cabinets, wall cabinets, MEP markers, corner cabinets, and status labels

## Confirmed Generation Strategy

Decision (2026-06-16): the top-down customer layout is a deterministic, data-driven SVG floor plan rendered entirely from the normalized JSON and the preliminary cabinet list. AI image generation is NOT used to draw the plan.

Why: an AI raster image (gpt-image-2 etc.) can imitate a CAD look but cannot produce accurate, to-scale, reproducible geometry, dimensions, cabinet widths, cabinet counts, or codes. Those are exactly the things deterministic code must own. A vector SVG renderer produces clean, professional plan line-work that is also correct and reproducible, and it serves both the rough Round 1 view and a later detailed/production view (same renderer, different level of detail).

Strategy:

1. Sales fills a showroom form while talking with the customer.
2. The app converts the form into strict normalized JSON.
3. The app deterministically lays out and renders a top-down SVG floor plan from the JSON + cabinet list:
   - Room walls drawn to scale from rough room dimensions
   - Base cabinets and wall cabinets laid to scale along the run walls from the preliminary cabinet list
   - Tall/appliance cabinets if any
   - Corner cabinet (Lazy Susan / Blind Corner, etc.) at run intersections
   - Sink, range/cooktop, fridge, dishwasher, hood, microwave/oven placed by their normalized relations
   - Doors (with swing) and windows on the indicated walls
   - Water, gas, electric, and vent markers
   - Island block for island layouts
   - Confirmation Required markers
   - Round 1 / Sales Estimate Only / Not Production Data stamp

Round 1 visual style (current priority, 2026-06-16): the plan is black-and-white line-art — monochrome (black/gray) strokes on a white background, no color fills. It shows only the approximate position of each cabinet and appliance (sink, range, fridge, dishwasher, etc.). It does NOT show detailed dimensions, measurements, or on-image dimension strings; exact sizes and placement come in a later detailed/Module 2 view. The customer reference is a simple black-and-white top-down plan.

Role of AI image generation (optional, not on the critical path): the existing gpt-image-2 pipeline (`POST /api/round1/layout-image`, OpenAI adapter + REST client) is retained but repurposed. Its future job is to take the deterministic SVG top-down plan as a reference and generate a realistic photographic-style render of the kitchen for the customer to preview. It must never produce or own the authoritative plan, cabinet data, dimensions, or production readiness. It stays decoupled and disabled by default until that realistic-render feature is built.

AI must not be the source of truth for cabinet counts, cabinet codes, cabinet dimensions, MEP status, layout geometry, or production readiness.

## Module 1 MVP Todo

Implementation should proceed in this order:

1. Done: Define Round 1 form schema and normalized JSON schema.
2. Done: Define `Confirmation Required` item model.
3. Done: Implement cabinet dimension and code helpers.
4. Done: Implement standard cabinet run split.
5. Done: Implement preliminary cabinet list generation.
6. Done: Implement Round 1 readiness checks.
7. Done: Build the showroom intake UI using the confirmed 6-step layout-critical form.
8. Done: Build JSON-to-layout-prompt generation.
9. Done: Build OpenAI image adapter boundary for top-down layout background generation.
10. Superseded: The earlier crude SVG overlay (fixed-position boxes) plus AI/mock background. Replaced by the data-driven SVG floor plan renderer (item 15). The crude overlay's fixed appliance/marker positions did not follow the form data and clashed with the AI background.
11. Done: Build designer/sales review UI for manual edit/add/remove of preliminary cabinets. Current implementation defaults to a rough summary for Round 1 sales estimate and keeps manual edit/add/remove in an advanced review section; non-standard manual review changes create `Confirmation Required`.
12. Done: Add tests for cabinet code generation, standard split, up-to-3-inch filler allowance, remainder flagging, Confirmation Required behavior, conditional form behavior, and Round 1 readiness.
13. Done (repurposed): `POST /api/round1/layout-image` + OpenAI REST client + adapter exist and are tested. No longer used to draw the customer plan. Retained, decoupled, and disabled by default; future job is realistic-render-from-SVG (item 16).
14. Pending: Add persistent repository implementation when moving beyond MVP memory storage.
15. Done (v1, black-and-white): Data-driven SVG floor plan renderer (the customer-facing top-down plan), rendered as black-and-white line-art. Pure geometry in `src/features/round1/floorplan/plan-geometry.ts` (`buildFloorPlan(normalized, cabinets, confirmationCount)`), rendered by `src/features/round1/layout-preview.tsx`. Scales the room from rough dimensions; lays base/wall cabinets to scale from the preliminary cabinet list along the run walls; draws a corner cabinet at run intersections; places sink/range/fridge/dishwasher (and a wall oven) by normalized relation, with the sink under the window when relation is UNDER_WINDOW; doors with a swing arc and windows on the indicated walls; W/G/E/V markers; an island block for island layouts; a compact "N to confirm" badge; a B&W legend; and the black Round 1 sales-estimate-only stamp. Monochrome (black/gray strokes on white, light-gray cabinet fills, no color); approximate positions only — no on-image dimensions or north arrow. The plan updates live as the form changes (no generate button). Geometry unit-tested (`plan-geometry.test.ts`); visuals verified via browser QA. Remaining tuning is consolidated under "Next Session — Remaining Work" below.
16. Pending (future, optional): Realistic-render-from-SVG. Feed the deterministic SVG top-down plan to gpt-image-2 as a reference to produce a photographic-style kitchen render for customer preview. Off the critical path; never owns plan/cabinet data.

## Next Session — Remaining Work (prioritized)

The deterministic black-and-white SVG floor plan renderer is the active surface; pick up here next time. Verify every change with all four: `npm test`, `npx tsc --noEmit`, `npm run build`, and browser QA at `http://127.0.0.1:3000/` (preview server name `module-1-dev`).

Key files:

- Plan geometry (pure, tested): `src/features/round1/floorplan/plan-geometry.ts` — `buildFloorPlan(normalized, cabinets, confirmationCount)`.
- Plan renderer (black-and-white SVG): `src/features/round1/layout-preview.tsx` (style constants `INK` / `LINE` / `LINE_SOFT` / `FILL_CABINET` / `FILL_CORNER`).
- Run generation from the form: `src/features/round1/showroom-intake-data.ts` — `createDefaultCabinetRuns(form)`.
- Cabinet domain (codes, standard split): `src/domain/round1/cabinets.ts`.

1. Multi-wall / multi-run layouts (highest priority — needed to match the U-shape + island reference).
   - Problem: `createDefaultCabinetRuns` emits only a main run (→ TOP) plus one LEFT run for non-one-wall layouts, so U-shape / galley / peninsula / island never get their other runs. The renderer already maps each cabinet `location` → wall and draws corners at occupied-wall intersections, so it will draw whatever runs the data contains.
   - Do: map `layoutPreference` → run walls when generating runs:
     - ONE_WALL → TOP
     - GALLEY → TOP + BOTTOM (two parallel runs)
     - L_SHAPE / PENINSULA → TOP + LEFT (peninsula = an extra stub off the L)
     - U_SHAPE → TOP + LEFT + RIGHT
     - ISLAND / L_SHAPE_ISLAND / U_SHAPE_ISLAND → the wall runs above plus an ON_ISLAND run drawn inside the island block
   - Tag generated runs with `CabinetLocation` values `ON_MAIN_RUN` / `LEFT_SIDE` / `RIGHT_SIDE` / `FRONT_SIDE` / `ON_ISLAND` so the renderer places them. Keep auto-split + Confirmation Required behavior.
   - Add `plan-geometry.test.ts` cases: U_SHAPE → two corners (top-left, top-right) and base cabinets on three walls; GALLEY → runs on TOP + BOTTOM; island layout → non-null island with ON_ISLAND cabinets.

2. Per-appliance placement refinement.
   - Current heuristic evaluates total appliance width per wall and distributes the empty space evenly between them, enforcing strict wall boundaries. If appliances are too wide for the wall span, a proportional `fitFactor` squishes them to prevent overflowing the room layout. Remaining refinement: dishwasher adjacent to the sink, fridge at a run end, range near the gas marker, and avoid appliances overlapping the corner block. Keep it monochrome and approximate (Round 1).

3. Optional detailed / Module 2 mode (later).
   - Add a `detailed` flag to the renderer to show dimension strings + cabinet codes for a production-style view. Round 1 stays minimal black-and-white. This is the bridge toward Module 2; keep Module 2 in its own context file.

4. Persistent repository (todo #14).
   - Replace the in-memory repo with a persistent implementation behind the existing `Round1Repository` interface in `src/server/round1/round1-repository.ts` (file-based for MVP, or Postgres). No domain changes needed.

5. Realistic-render-from-SVG (todo #16, future/optional).
   - Feed the deterministic SVG top-down plan to gpt-image-2 as a reference image to produce a realistic photographic kitchen render for the customer. The route + adapter already exist (`POST /api/round1/layout-image`, `src/infrastructure/image/openai-rest-image-client.ts`) and are decoupled/disabled by default. `OPENAI_API_KEY` is in `.env.local` (rotate it — it was shared in chat). Never let this own plan/cabinet data.

## Development Order

Build the MVP from the deterministic core outward.

Do not start with the visual UI or the OpenAI image call. The highest-risk parts are data correctness, `Confirmation Required`, and preventing Round 1 data from becoming production data.

Recommended implementation sequence:

1. Shared domain core and tests
   - Round 1 form schema
   - Normalized JSON schema
   - `Confirmation Required` model
   - Cabinet code generation
   - Standard cabinet auto-split
   - Preliminary cabinet generator
   - Round 1 readiness gate
   - Current status: implemented with Vitest coverage.

2. API and repository layer
   - Create/update Round 1 project
   - Save showroom form answers
   - Return normalized JSON
   - Generate cabinet list
   - Return readiness and confirmation-required items
   - Current status: create project and save showroom form are implemented through an in-memory repository and `POST /api/round1/projects`.

3. Frontend showroom intake
   - Build the confirmed 6-step layout-critical form
   - Show normalized JSON/debug preview during development
   - Show Confirmation Required items
   - Keep all outputs labeled sales-estimate-only
   - Current status: implemented as a conditional 6-step form with Confirmation Required and preliminary cabinet estimate panels. Normalized JSON is not shown directly in the UI yet; the layout prompt is shown for development review.

4. AI image and overlay flow
   - Start with a mock layout image to verify the full workflow
   - Add JSON-to-layout prompt generation
   - Add OpenAI image adapter
   - Add deterministic overlay for base cabinets, wall cabinets, MEP markers, openings, appliances, corner cabinets, and sales-estimate-only stamp
   - Current status (superseded by the SVG decision): the customer plan is now a deterministic black-and-white SVG floor plan (see todo item 15), not an AI image. The OpenAI image pipeline (`POST /api/round1/layout-image` + REST client + adapter) still exists and is tested, but is decoupled and not used to draw the plan; it is reserved for the future realistic-render-from-SVG feature (todo item 16).

5. Review workflow
   - Designer/sales can manually edit, add, or remove preliminary cabinets
   - Manual edits outside standard assumptions create `Confirmation Required`
   - Nothing from Round 1 can enter production
   - Current status: implemented as local MVP state in the showroom UI, backed by deterministic domain review actions and Vitest coverage. The default Round 1 UI shows only rough cabinet allowance by cabinet type and linear feet; detailed per-cabinet review is advanced/optional. Persistence can be added later through the repository layer.

## Current Implementation Progress

Last verified: 2026-06-16.

Implemented and verified:

- Standard cabinet widths are matched automatically using the priority `36, 33, 30, 27, 24, 21, 18, 15, 12, 9`.
- Round 1 default cabinet UX is a rough estimate summary, not a per-cabinet data entry workflow.
- The rough estimate summary shows base, wall, tall, and filler allowance.
- Filler allowance is handled deterministically: a remainder up to 3" per rough run is treated as estimated filler; a remainder above 3" remains `Confirmation Required`.
- Advanced manual cabinet review is still available for designer/sales overrides, but it is optional and collapsed by default.
- Non-standard manual cabinet changes create `Confirmation Required`.
- The customer-facing top-down plan is a deterministic black-and-white SVG floor plan rendered live from the normalized JSON + preliminary cabinet list (no generate button, no AI image). See `src/features/round1/layout-preview.tsx` and `src/features/round1/floorplan/plan-geometry.ts`.
- The OpenAI image pipeline (`POST /api/round1/layout-image` + `src/infrastructure/image/openai-rest-image-client.ts`, model `gpt-image-2` via `OPENAI_IMAGE_MODEL`, key via `OPENAI_API_KEY`) still exists and is tested but is decoupled/disabled by default; reserved for the future realistic-render-from-SVG feature, so AI never owns source-of-truth data.

Latest verification commands:

- `npm test`: 42 tests passing (includes `plan-geometry.test.ts`).
- `npx tsc --noEmit`: passing.
- `npm run build`: passing; `/api/round1/layout-image` is still registered (decoupled/optional).
- Browser QA at `http://127.0.0.1:3000/`: the top-down layout plan renders deterministically and live from the form (no generate button), in black-and-white line-art — walls to scale, corner lazy susan, base cabinets (light outlines) and wall cabinets (dashed), sink under the window, range/dishwasher/fridge with line symbols, W/G/E/V markers, door with swing, a B&W legend, a compact "N to confirm" badge, and the black Round 1 sales-estimate-only stamp. No on-image dimensions or north arrow. Rough estimate summary still displays Base/Wall/Tall/Filler with advanced manual review collapsed.

## Cabinet Estimate Rules

The Round 1 cabinet list is preliminary and sales-estimate-only.

It must never be treated as production data.

Round 1 default UX should not require sales to fill every cabinet. The first-pass estimate should show rough allowance summaries, such as base cabinet count/linear feet and wall cabinet count/linear feet. Per-cabinet edits are optional advanced review when better information is available.

For default matching, use the standard cabinet width priority already defined below. If a rough cabinet run leaves a remainder of up to 3", treat it as estimated filler allowance in Round 1 instead of requiring a manual cabinet. If the remainder is greater than 3", keep it as `Confirmation Required`. In this MVP, filler is summarized as rough allowance only; exact filler placement can wait for the detailed data/design version.

Use width, depth, and height fields. Do not use `L x W x H`.

Cabinet code format:

- `W + width + depth + height`
- `B + width + depth + height`
- `T + width + depth + height`

Examples:

- `W301236` = wall cabinet, 30"W x 12"D x 36"H
- `B302435` = base cabinet, 30"W x 24"D x 34.5"H

For `B302435`, store:

- `actualHeight: 34.5`
- `codeHeight: 35`

Standard assumptions:

- Wall cabinets: 12" depth, widths 9" to 36" in 3" increments, heights 30", 36", 40"
- Base cabinets: 24" depth, widths 9" to 36" in 3" increments, actual height 34.5"
- Tall/appliance cabinets may use standard assumptions, but must be marked preliminary

Auto-split V1 should split runs using this width priority:

```text
36, 33, 30, 27, 24, 21, 18, 15, 12, 9
```

Flag as `Confirmation Required` when:

- A cabinet size is non-standard
- A run has a remainder
- Appliance dimensions are missing
- Tall or appliance cabinet assumptions are used
- A custom cabinet is requested or implied
- A designer manually creates a cabinet outside standard assumptions

## Important UX Clarification

The browser mockups used during planning are conceptual only.

The final customer-facing layout should be generated from the Round 1 JSON, then enhanced with deterministic overlays. The final output is not the static mockup shown during planning.

## Round 1 Input Source

Input comes from a showroom conversation between sales and customer.

The customer may not have precise measurements. They may only know approximate room length and width, approximate door/window positions, and rough appliance preferences.

The form should allow rough answers and should not force exact wall offsets in V1.

Default sales-facing inputs should use customer-friendly language, such as:

- under window
- main run
- left area
- right area
- open side
- no preference
- not sure

Avoid ambiguous sales-facing location labels unless their anchor has been captured first. For example, do not show `near entrance` unless the form has already identified which door/opening is the entrance. Current UI uses wall/area labels such as front side, back side, left side, right side, main run, near sink, near range, near fridge, island, no preference, and unknown.

Internal JSON may normalize these to structured vocabulary.

## Internal Position Vocabulary

The JSON should retain normalized position semantics for AI prompting and cabinet-fill logic.

Suggested vocabulary:

```text
BACK_SIDE
LEFT_SIDE
RIGHT_SIDE
FRONT_SIDE
UNDER_WINDOW
ON_MAIN_RUN
ON_ISLAND
NEAR_SINK
NEAR_RANGE
NEAR_FRIDGE
BEHIND_SINK
NO_PREFERENCE
NOT_APPLICABLE
UNKNOWN
```

These terms do not need to appear on the final customer layout image. They are mainly for JSON, prompting, layout reasoning, and later designer review.

`NEAR_ENTRANCE` may exist only as a future derived semantic after an entrance/opening has been identified. It should not be offered as a primary customer-facing option in the current form.

## Conditional Form Flow Rules

The showroom form must avoid asking dependent questions when the parent item is absent.

Use status-first groups for reusable conditional logic:

- `YES`: item exists; show dependent detail fields.
- `NO`: item does not exist; hide dependent detail fields and mark dependent relations as not applicable or unknown as appropriate.
- `UNKNOWN`: item status is not known; do not ask impossible detail fields, but create `Confirmation Required`.

Current implemented examples:

- Doors/open passages use `openings.doors.status` plus `items`.
- Windows use `openings.windows.status` plus `items`.
- If windows are `NO`, window width/relation fields are hidden and sink position cannot be `UNDER_WINDOW`.
- If a previous sink relation was `UNDER_WINDOW` and windows are changed to `NO`, normalized JSON changes sink relation to `UNKNOWN` and creates `SINK_UNDER_WINDOW_BUT_NO_WINDOW`.
- If windows are `UNKNOWN`, the app creates `UNKNOWN_WINDOW_STATUS` but does not require window width.
- Dishwasher uses `fixtures.dishwasher.status` with `YES`, `NONE`, or `UNKNOWN`.
- If dishwasher is `NONE`, dishwasher size and position fields are hidden and normalized relation becomes `NOT_APPLICABLE`.
- `NO` and `UNKNOWN` must never be treated as the same state.

## Round 1 Form Scope

The MVP form should include only layout-critical fields.

### 1. Room Size And Obstacles

Required if known:

- Room length
- Room width

Optional but layout-relevant:

- Ceiling height
- Load-bearing column
- Beam
- Stair
- Fireplace

If obstacle position is approximate or unknown, preserve it and flag `Confirmation Required`.

### 2. Openings

Door/open passage fields:

- Status: yes, no, unknown
- Door/opening wall if status is yes or unknown: front side, back side, left side, right side, unknown
- Door width if known and applicable
- Distance from corner if known and applicable
- Swing direction if known and applicable

Window fields:

- Status: yes, no, unknown
- Approximate location or relation if status is yes or unknown
- Window width if known and applicable
- Distance from corner if known and applicable
- Sill height if known and applicable
- Window height if known and applicable
- Window top height if known and applicable

Exact wall offsets are not required for Round 1. Unknown measurements should be flagged.

If window status is no, do not ask window dimensions and do not offer `under window` as a sink position.

### 3. MEP

Include water, gas, electric, and vent/hood outlet.

For each, capture:

- Approximate location or relation, such as near sink or near range
- Whether it can be moved, if known
- Confirmation status

MEP locations are layout-critical because they affect sink, dishwasher, range, hood, fridge, and appliance placement.

### 4. Layout Preference

Supported choices:

- One wall
- L-shape
- U-shape
- Galley
- Peninsula
- Island
- L-shape + island
- U-shape + island
- No preference

The app may use this to guide layout generation, but rough customer preference is not final design approval.

### 5. Core Appliances And Fixtures

Sink:

- Size: 30", 33", 36", unknown
- Type if available: single, double, workstation
- Location requirement: under window only when window status is yes; otherwise main run, left side, right side, back side, near water/sink area, island, no preference, unknown

Range / cooktop:

- Size: 30", 36", 48", unknown
- Type: gas, induction, electric, unknown
- Position preference or relation: main run, left side, right side, back side, island, near range/gas/vent, no preference, unknown
- Fixed location: yes, no, unknown

Refrigerator:

- Size: 30", 33", 36", 42", 48", unknown
- Type if available: French Door, Side-by-Side, Built-In, Column
- Position preference: front side, left side, right side, back side, main run, near fridge area, no preference, unknown

Dishwasher:

- Status: yes, none, unknown
- Size if applicable: 18", 24", unknown
- Position if applicable: default relation should be near sink if selected.

Range hood:

- Above range
- Downdraft
- Unknown

### 6. Layout-Sensitive Cabinet Choices

Oven / microwave:

- Range includes oven
- Wall oven + microwave stack
- Microwave drawer
- Upper cabinet microwave
- Countertop microwave
- No microwave
- No oven
- Unknown
- Position or relation if applicable: main run, left side, right side, back side, island, near range, no preference, unknown

Corner cabinet:

- Lazy Susan
- Blind Corner
- LeMans
- Magic Corner
- Corner drawer
- No preference

Island:

- Needed or not
- Main functions if known: prep, storage, seating, sink, dishwasher, cooktop, microwave, wine fridge
- Seat count and direction if available

These fields are included because they change the top-down layout and preliminary cabinet fill.

## Deferred Until After Deposit

Do not include these as required Round 1 fields:

- Materials
- Colors
- Finish
- Door style
- Hardware
- Budget
- Lifestyle details
- Detailed custom cabinet requirements
- Detailed pantry size
- Trash pullout exact position
- Drawer vs door preference
- Detailed tall cabinet sequence
- Display cabinet details
- Wine cabinet details
- Coffee station details
- Pet zone details

They can be optional notes, but they should not block Round 1 layout generation.

## Output Image Requirements

The output should be a top-down kitchen layout suitable for customer confirmation.

Visual requirements:

- Clean architectural top-down line-art style
- Black-and-white (monochrome): black/gray strokes on a white background, no color fills. The customer reference style is a simple black-and-white plan.
- Simple, readable, not photorealistic
- Show only the approximate position of each cabinet, appliance, sink, range, fridge, and dishwasher; exact placement is not required
- No detailed dimension strings or measurements on the Round 1 customer plan
- Walls and openings visible
- Doors and windows visible
- Sink, range/cooktop, fridge, dishwasher, hood, oven/microwave if applicable
- Base cabinets visible
- Wall cabinets visible
- Wall cabinets should be drawn tight to the wall
- Corner cabinet should be visible for L-shape and U-shape layouts
- MEP markers should be visible when known or approximate
- Include a visible stamp: `Round 1 Sales Estimate Only`

Avoid:

- Photorealistic showroom rendering
- Dense construction drawings
- Production-ready dimensions
- Color fills — the Round 1 plan is black and white
- Detailed dimension strings or measurements on the Round 1 customer plan
- Cabinet codes on the customer image by default
- Text clutter such as BACK_SIDE / LEFT_SIDE / RIGHT_SIDE labels on the final customer image

## Deterministic Overlay Rules

The deterministic SVG renderer draws these elements directly from the data (there is no AI background to overlay):

- Base cabinet runs
- Wall cabinet runs
- Tall/appliance cabinet blocks
- Corner cabinet block
- Sink/range/fridge/dishwasher labels
- W/G/E/V markers
- Confirmation Required markers (compact "N to confirm" badge)
- Sales-estimate-only stamp

Visual language (Round 1, black-and-white — this supersedes the earlier color scheme):

- Black/gray strokes on a white background; no color fills (except blue for doors and windows, and subtle grey for specific appliance textures).
- Base cabinets: Separate, independent single-line rectangles (no continuous background fill that overlaps appliances).
- Wall cabinets: Double-line outlines (inner and outer boxes) to denote upper cabinets hanging on the wall. Strokes are rendered in **bold black** (`#000000`, stroke widths 1.5 and 1.2) for strong contrast.
- Corner cabinets: Standard **L-shaped right-angled** intersections (直角), strictly replacing the earlier 5-sided diagonal/pie-cut shapes. Base corners are simple squares; wall corners are 6-sided L-shapes matching the double-line format.
- Appliance Protrusion: The Range (灶台) sticks out slightly (5% depth increase over base cabinets), while the Fridge sticks out more (15% depth increase).
- Fridge (冰箱): Rendered with a top-down **French door** aesthetic (subtle `#e2e8f0` filled doors and protruding handles) without text labels for a cleaner look.
- Sink (水槽): Kept minimalist; cleanly integrated into the base cabinet without cluttered secondary details (e.g. soap dispensers).
- Hood (抽油烟机): Automatically drawn on the wall layer above the range. It perfectly tracks the range's position and features an inner rectangle representing the vent, visually filling the gap between wall cabinets.
- Dishwasher (洗碗机): Minimalist built-in design. Completely transparent background, with only a thin, half-open rectangular handle protruding from the front edge of its underlying base cabinet.
- Doors & Windows: Drawn in blue (`#2563eb`) to unify opening colors. For doors, the solid door leaf (门板) is explicitly drawn, and the swing arc mathematically matches the door leaf.
- Intelligent Snapping (无缝布局): 
  - Fixtures like the Sink and Dishwasher automatically snap their dimensions and coordinates to the underlying base cabinet to prevent visual spillage across adjacent cabinets.
  - Obstacles like the Range and Fridge trigger automatic cabinet-snapping during the `layRun` algorithm: if an unfillable gap is detected before an appliance, the appliance automatically snaps backwards to close the gap, creating a seamless, tight cabinet run without holes.
- MEP Markers (W/G/E/V): Rendered as an OPTIONAL toggle in the layout preview. Default is OFF to keep the design view clean for cabinet focus, but toggleable for production data coordination.

## JSON Example

```json
{
  "round": "ROUND_1",
  "layoutGoal": "CUSTOMER_CONFIRMATION",
  "salesEstimateOnly": true,
  "notForProduction": true,
  "dimensionConfidence": "ROUGH",
  "room": {
    "length": { "value": 144, "unit": "inch", "confidence": "ROUGH" },
    "width": { "value": 120, "unit": "inch", "confidence": "ROUGH" },
    "ceilingHeight": { "value": null, "confirmationRequired": true },
    "obstacles": []
  },
  "openings": {
    "doors": {
      "status": "YES",
      "items": [
        {
          "location": "FRONT_SIDE",
          "width": null,
          "distanceFromCorner": null,
          "swingDirection": "UNKNOWN",
          "confirmationRequired": true
        }
      ]
    },
    "windows": {
      "status": "YES",
      "items": [
        {
          "relation": "BEHIND_SINK",
          "width": null,
          "sillHeight": null,
          "windowHeight": null,
          "topHeight": null,
          "confirmationRequired": true
        }
      ]
    }
  },
  "mep": {
    "water": {
      "relation": "NEAR_SINK",
      "movable": "UNKNOWN",
      "confirmationRequired": true
    },
    "gas": {
      "relation": "NEAR_RANGE",
      "movable": "UNKNOWN",
      "confirmationRequired": true
    },
    "electric": {
      "relation": "NEAR_FRIDGE_AND_APPLIANCES",
      "movable": "UNKNOWN",
      "confirmationRequired": true
    },
    "vent": {
      "relation": "ABOVE_RANGE_OR_EXISTING_OUTLET",
      "confirmationRequired": true
    }
  },
  "layoutPreference": "L_SHAPE",
  "fixtures": {
    "sink": {
      "size": 33,
      "type": "UNKNOWN",
      "relation": "UNDER_WINDOW"
    },
    "range": {
      "size": 30,
      "fuel": "GAS",
      "fixedLocation": "UNKNOWN",
      "relation": "NEAR_RANGE"
    },
    "fridge": {
      "size": 36,
      "type": "UNKNOWN",
      "relation": "FRONT_SIDE"
    },
    "dishwasher": {
      "status": "YES",
      "size": 24,
      "relation": "NEAR_SINK"
    },
    "hood": {
      "relation": "ABOVE_RANGE"
    }
  },
  "layoutSensitiveCabinets": {
    "cornerCabinet": {
      "preferredType": "LAZY_SUSAN",
      "alternatives": ["BLIND_CORNER", "LEMANS", "MAGIC_CORNER"],
      "confirmationRequired": true
    },
    "ovenMicrowave": {
      "configuration": "RANGE_INCLUDES_OVEN",
      "relation": "NEAR_RANGE",
      "alternatives": [
        "WALL_OVEN_MICROWAVE_STACK",
        "MICROWAVE_DRAWER",
        "UPPER_CABINET_MICROWAVE",
        "COUNTERTOP_MICROWAVE",
        "UNKNOWN"
      ]
    },
    "island": {
      "requested": false,
      "functions": [],
      "confirmationRequired": false
    }
  },
  "cabinetLayersToRender": [
    "BASE_CABINETS",
    "WALL_CABINETS",
    "TALL_OR_APPLIANCE_CABINETS_IF_ANY"
  ]
}
```

## Prompting Guidance

The image prompt should be generated from structured JSON. Do not ask the image model to invent hidden measurements.

Prompt requirements:

- State that this is a Round 1 customer confirmation layout.
- Ask for a clean top-down kitchen plan background.
- Include the layout type and rough dimensions if available.
- Include approximate fixture and appliance relationships.
- Include doors, windows, obstacles, and MEP markers if known.
- Ask the model to leave room for deterministic overlays.
- Avoid production-grade dimensions and construction annotation.

Example prompt skeleton:

```text
Create a clean top-down kitchen layout background for Round 1 customer confirmation.
This is sales-estimate-only, not production data.

Kitchen shape: {layoutPreference}.
Rough room dimensions: {length} by {width}, confidence rough.
Show walls, openings, doors, windows, and major obstacles.
Place sink {sink.relation}, range/cooktop {range.relation}, refrigerator {fridge.relation}, dishwasher {dishwasher.relation}.
Represent water/gas/electric/vent locations as approximate only if provided.
Use a simple architectural plan style with light background.
Do not include dense construction dimensions.
Do not include cabinet production codes.
Leave clean space for app-rendered overlays for base cabinets, wall cabinets, corner cabinet, labels, and confirmation markers.
```

## Readiness Rules

Round 1 layout can be generated when:

- A room shape or layout preference exists.
- Rough room dimensions exist, or the user explicitly marks dimensions unknown.
- Major openings are captured if known.
- Sink/range/fridge/dishwasher/hood status is captured.
- MEP status is captured as known, approximate, movable, or unknown.
- Oven/microwave configuration is captured as known or unknown.
- Corner cabinet preference is captured for L-shape or U-shape, or marked no preference.

Unknown values should not block generation. They should create Confirmation Required items.

## Non-Goals

Round 1 layout generation does not:

- Generate production-ready cabinet data
- Guarantee exact appliance dimensions
- Guarantee exact MEP locations
- Replace field measurement
- Replace designer review
- Decide final materials, finishes, or custom cabinet details

## Module 1 Round 1 — Completed Work Log

These dated `Done` entries were moved out of `ai_ctx.md` (the hot-context file) to keep it short. They are the historical changelog of completed Module 1 work; the current-state summary lives in `ai_ctx.md` under "Current Implementation". Do not treat any verification number here as the latest — re-run verification per `ai_ctx.md`.

Done (2026-06-17): the complete Round 1 JSON snapshot described below is implemented and verified. `Generate Cabinet Fill` is the authoritative snapshot point; the snapshot captures `showroomForm`, normalized data, `positionOverrides`, `fixedPositionsConfirmed: true`, `cabinetFillGenerated: true`, the preliminary cabinet list, deterministic floor plan geometry (rebuildable from captured inputs), `confirmationItems`, `readiness`, and the metadata flags. Layout-critical form changes or drags clear the snapshot. It stays sales-confirmation-level only (no Module 2 detail). See `src/features/round1/snapshot.ts`.

Done (2026-06-17): snapshot persistence is implemented and verified. The snapshot is no longer React-state-only — it persists through `Round1Repository.saveSnapshot` (file-backed via `createFileSystemRound1Repository` + `ROUND1_DATA_FILE`), is saved over the API on `Generate Cabinet Fill`, and is restored on page reload. See `round1-repository.ts`, `src/app/api/round1/projects/[id]/`, and the mount-restore effect in `showroom-intake-app.tsx`.

Done (2026-06-17): safe refactor / file organization pass is implemented and verified. Intake workflow, step components, panels, controls, and preview SVG shape components are split into focused files with behavior unchanged.

Done (2026-06-17): the reserved `Generate Rendering` action is implemented and verified (concept-only, non-authoritative). Rendering input includes BOTH the deterministic floor plan image (client-rasterized from the on-screen SVG) and a JSON-derived prompt built server-side from the authoritative snapshot loaded by project id. The image edit boundary (`/images/edits` multipart) was added without regressing the layout-background path. The result is an ephemeral concept preview only — never persisted, never part of the snapshot, never source of truth for cabinet data/dimensions/counts/geometry/quotes; snapshot invalidation/regeneration clears it. The direct sales workflow (form -> Adjust Positions -> `Generate Cabinet Fill` -> frozen snapshot -> `Generate Rendering`) stays fully usable with no conversational agent. Verified: `npm test` (91), `npx tsc --noEmit`, `npm run build`, and live browser QA (gating disabled→enabled on save; real `gpt-image-2` round-trip returned and displayed a concept image matching the L-shape plan; reload rehydrates the snapshot but not the ephemeral rendering, as intended). See `rendering-service.ts`, `rendering-prompt.ts`, `rasterize-svg.ts`, `openai-image-adapter.ts`, and `src/app/api/round1/projects/[id]/rendering/route.ts`.

Done (2026-06-17): concept rendering wrap-up — persistence + staleness. The rendering now persists in a separate non-authoritative `Round1Project.latestRendering` field (never in `Round1Snapshot`) and is restored on reload. Layout-critical edits/drags no longer discard it; it stays shown but dimmed with an "Outdated — based on an earlier snapshot" warning + disabled `Regenerate Rendering` until the snapshot is regenerated and the rendering re-run. Verified: `npm test` (94), `npx tsc --noEmit`, `npm run build`, live browser QA (generate -> displays fresh; reload -> restores from server; form edit -> shows stale/dimmed + Outdated warning). See `round1-repository.ts` (`saveRendering`/`Round1ProjectRendering`), the rendering route, and `RenderingControls` in `showroom-intake-app.tsx`.

Done (2026-06-17): optional Round 1 conversational intake agent is implemented and verified (greenfield, now exists). Provider-agnostic tool-use layer lives in `src/server/llm/`: `provider.ts` (interfaces `ToolSpec`/`ChatMessage`/`AgentInput`/`AgentOutput`/`LLMProvider`, `LLMProviderNotConfiguredError`), `openai-llm-provider.ts` (`/chat/completions` + `tools`, bounded 6-iteration loop, also reused by DeepSeek), `deepseek-llm-provider.ts` (OpenAI-compatible, own module/base URL), `anthropic-llm-provider.ts` (`/messages` `tool_use`/`tool_result` shape), and `index.ts` `getLLMProvider(env)` switching on `LLM_PROVIDER=openai|deepseek|anthropic` (+ optional `OPENAI_MODEL`/`DEEPSEEK_MODEL`/`ANTHROPIC_MODEL`; throws `LLMProviderNotConfiguredError` → 503 when unset/keyless). Server orchestration `src/server/round1/agent-service.ts` defines 3 tools wrapping deterministic domain fns — `update_intake` (nested allowlist JSON-Schema patch → deep-merge → `round1FormSchema.safeParse` which also STRIPS any control field like `cabinetFillGenerated`/`fixedPositionsConfirmed`/`snapshot` → `normalizeRound1Form`), `estimate_cabinets` (`summarizePreliminaryCabinetEstimate(generatePreliminaryCabinetList(createDefaultCabinetRuns(form)))`), `explain_confirmations` (`normalizeRound1Form(form).confirmationItems`) — plus an embedded `ROUND1_AGENT_SYSTEM_PROMPT`. Route `POST /api/round1/agent` validates `{message, form, history}` with Zod, calls `runRound1AgentTurn`, returns `{reply, updatedForm?}` (400 invalid / 503 not-configured / 502 error); it never reads/writes `Round1Repository` (no snapshot side effects). UI `src/features/round1/agent-chat-panel.tsx` (collapsible `Panel` at the bottom of the right sidebar in `showroom-intake-app.tsx`) sends the live form + last ≤10 turns, renders bubbles + "Thinking…", and applies any `updatedForm` via the existing `updateForm` path — so the deterministic SVG updates in place and snapshot/rendering staleness rules still apply. AI boundary stays code-enforced: no snapshot-freeze/save tool (freeze stays human-only on `Generate Cabinet Fill`), allowlist + Zod strip control fields, estimates carry `salesEstimateOnly`/`notForProduction`. System prompt also enforces multilingual + units rules: parse 中文 / English / mixed and reply in kind; store all dimensions in INCHES (尺/呎/feet ×12, 寸/英寸/inch as-is, cm ÷2.54, m ×39.37; US trade convention so 尺=foot not metric chi) and label inch values as inches/英寸/寸 never "尺". Verified: `npx tsc --noEmit`, `npm test` (140 passing; +24 new across `agent-service.test.ts` and `openai-llm-provider.test.ts`), `npm run build` (route registered), and live `gpt-4o-mini` browser QA — natural language ("14 尺长 11 尺宽 U 形带中岛 水槽 30 寸窗下 36 寸燃气灶 42 寸冰箱 无洗碗机") extracted 10/11 fields exactly into the live form + SVG; 中文/英文/中英混合 all mapped precisely with correct unit wording; 503 graceful "not configured" when `LLM_PROVIDER` unset. Activation: `.env.local` `LLM_PROVIDER=openai` + `OPENAI_MODEL=gpt-4o-mini` (reuses existing `OPENAI_API_KEY`). See `src/server/llm/*`, `agent-service.ts`, `src/app/api/round1/agent/route.ts`, and `agent-chat-panel.tsx`. The panel also has optional voice input (STT): a mic button + zh-CN/en-US language toggle backed by the browser Web Speech API in `src/features/round1/use-speech-to-text.ts` (client-only, zero-dependency, no server route/cost). Dictation appends the live transcript to the textarea for the rep to review before Send; it degrades gracefully (mic hidden when `SpeechRecognition` is unsupported, friendly message on permission-denied). Verified: tsc + 140 tests + live browser QA (Web Speech detected, mic + toggle render, language flips zh-CN↔en-US, permission-denied handled without crashing).

Done (2026-06-17): rendering accuracy pass — spatial prompt + locked clean reference. Fixed the layout↔rendering mismatch (fridge/door drifting to the wrong wall, missing corner cabinet). Two root causes addressed deterministically: (1) the prompt was spatially blind, and (2) the reference image was the noisy live preview. Now: `buildRound1RenderingPrompt` translates `snapshot.floorPlan` into explicit, camera-anchored spatial constraints via a new pure helper `src/features/round1/floorplan/spatial-language.ts` (fixed one-point camera convention — `TOP`=back wall ahead, `BOTTOM`=front/behind camera, `LEFT`/`RIGHT` literal; per-wall left-to-right / near-to-far appliance walkthrough; corner-cabinet location from `wallCorners[].type`; window-above-sink; an always-on negative door constraint; and a "behind the viewpoint" note for front-wall appliances). The reference image is now a clean render built from the locked `snapshot.floorPlan` (not the live DOM): `LayoutPreview` gained a `plan?` prop (render a precomputed plan) and a `referenceMode` prop (strips MEP markers, window/door/island/appliance text labels, hover/drag chrome, header). A hidden off-screen `LayoutPreview plan={snapshot.floorPlan} referenceMode` is rasterized via the existing `rasterizeSvgElement` so image + prompt share one locked source. The image boundary now accepts multiple reference images: `referenceImagesBase64: string[]` threaded through `rendering-service` → `openai-image-adapter` → `openai-rest-image-client`, and the route accepts `referenceImagesBase64` with a legacy `referenceImageBase64` fallback. Multipart shape: a SINGLE reference is sent as `image`, MULTIPLE as repeated `image[]` parts — never both (the real API 400s if both are present; see memory `openai-images-edit-single-vs-multi-image-field`). AI boundary unchanged (snapshot loaded server-side by id; rendering stays non-authoritative `latestRendering`; staleness logic intact). Verified: `npm test` (116), `npx tsc --noEmit`, and a live `gpt-image-2` round-trip on the reported L-shape snapshot — the concept now keeps the fridge on the back wall (far right), shows no door on a side wall, and renders the back-left corner cabinet, fixing all three reported defects. See `spatial-language.ts`, `rendering-prompt.ts`, `layout-preview.tsx`, `showroom-intake-app.tsx`, and the image pipeline files.

Done (2026-06-17): L-shape fridge-outside-the-L bug fix. The default fridge relation `FRONT_SIDE` maps to the `BOTTOM` wall, but an L-shape only occupies `["TOP","LEFT"]`, so the fridge rendered floating on the (empty) front wall outside the L. Root cause: `overrideWall` constrained drag *overrides* to the layout's allowed walls but returned the relation-derived *default* wall unconstrained. Fix: new `clampWallToLayout(wall, layoutPreference)` helper in `plan-geometry.ts` snaps a disallowed default wall to an allowed one (prefer an adjacent wall, then the opposite, then the first allowed) and `overrideWall` now applies it to the fallback. For the default L-shape the fridge now sits on the `LEFT` leg; verified across L/U/galley/one-wall/L-island/peninsula that every appliance stays on a layout wall. Note: `describeBehindCameraAppliances` no longer fires for the default L-shape (its appliances all stay within the L); the front-wall "behind the viewpoint" prompt note still works for galley/dragged front-wall appliances, and tests were updated to exercise it via a galley plan. The cabinet-count invariant test now counts only real (non-generic) cabinets, since generic visual fillers correctly wrap around the fridge on the left leg. Verified: `npm test` (131), `npx tsc --noEmit`, `npm run build`, and live browser QA (default L-shape Appliances step: fridge bbox center on the LEFT wall, not BOTTOM; no console errors). See `clampWallToLayout`/`overrideWall` in `plan-geometry.ts`.

Done (2026-06-17): sink-side cabinet continuity and rough-wall-cabinet cleanup. Root cause: the geometry layer treated sink/dishwasher as base-cabinet obstacles, so the base run could be cut away at the sink; wall-cabinet gap filling could also create narrow clipped upper-cabinet fragments that looked like extra cabinets or exact filler. Fix: sink/dishwasher no longer break the base-cabinet run; they render as integrated fixtures over base-cabinet footprints. Wall-cabinet clipping/generic filling now suppresses tiny fragments below the standalone wall-cabinet threshold, keeping the Round 1 preview coarse and readable. Exact filler placement and precise cabinet-by-cabinet design remain V2 / Module 2 work. Verified: `npm test` (132) and live browser QA at `http://localhost:3000/` (base cabinets present under sink/dishwasher; no narrow wall-cabinet fragments around the sink; no app console errors beyond dev Fast Refresh notices). See `plan-geometry.ts` and `plan-geometry.test.ts`.

Done (2026-06-18): oven/microwave arrangement intake and rendering semantics. Removed the first-phase `Wall oven approximate wall` question; wall oven placement now follows the same rough auto-layout + drag-adjustment path as cooktop and the built-in microwave. Added `SEPARATE_WALL_OVEN_AND_MICROWAVE` to the Round 1 schema and made `layoutSensitiveCabinets.ovenMicrowave.configuration` the relationship source of truth for stacked vs separate oven/microwave arrangements when both appliances are present. UI `Oven and microwave arrangement?` maps stacked/separate selections deterministically to `cookingAppliances` statuses and resets stale relation data; it is hidden unless both wall oven and built-in microwave are included, and single-appliance absence is represented by appliance status rather than `NO_MICROWAVE` / `NO_OVEN` arrangement choices. Floor-plan geometry renders `WALL_OVEN_MICROWAVE_STACK` as one `ovenMicrowaveStack` appliance symbol while `SEPARATE_WALL_OVEN_AND_MICROWAVE` keeps separate `wallOven` and `microwaveOvenCombo` symbols. Layout preview suppresses the long stacked label to avoid SVG text overflow. Rendering prompt now names stacked towers, separate microwave locations, and `microwaveOvenCombo` distinctly instead of accidentally describing the microwave as a second wall oven. The Round 1 agent tool schema now advertises the new arrangement value and deterministically syncs all advertised oven/microwave configurations to appliance statuses, while sanitizing unexposed raw relation patches. Verified: `npm test` (193), `npx tsc --noEmit`, and `npm run build`. See `showroom-intake-steps.tsx`, `plan-geometry.ts`, `layout-preview.tsx`, `rendering-prompt.ts`, `spatial-language.ts`, and `agent-service.ts`.

Done (2026-06-18): Round 1 rough wall elevations are implemented as the Phase 2 SVG-first reference upgrade. A deterministic elevation scene builder (`src/features/round1/elevations/elevation-scene.ts`) maps `snapshot.floorPlan` into coarse Back/Left/Right/Front wall views, and `ElevationPreview` renders visible CAD-like rough elevations below the top-down plan only after `Generate Cabinet Fill`. The elevations stay Module 1 only: rough, not editable, no cabinet codes, no production dimensions, no filler schedule, and stamped not-for-production. The concept rendering flow now rasterizes both the clean top-down reference and the rough elevation reference when available via `referenceImagesBase64`, with top-down-only fallback if the elevation ref is unavailable. Verified: `npm test` (155), `npx tsc --noEmit`, `npm run build`, and browser QA at `http://127.0.0.1:3002/` (initial load hides elevations; after cabinet fill, Rough Wall Elevations appear below the top-down plan with wall/opening/appliance SVG data; live `Generate Rendering` returned a concept PNG and no relevant console errors).

Done (2026-06-18): cooktop vs range distinction + mutual exclusivity. A cooktop = burners only, no oven; a range = burners + oven in one unit. The top-down plan still reuses the `range` symbol/footprint for a cooktop (identical from above), but the cooktop is now a distinct appliance everywhere it matters: (1) the floor-plan appliance keeps `key: "cooktop"`; (2) the rough elevation draws it as a base cabinet with a burner surface and NO oven door (new `cooktop` `ElevationSymbol`, keyed off `appliance.key` in `elevation-scene.ts`, drawn in `elevation-preview.tsx`; added to the base-cabinet obstacle clip list); (3) the rendering prompt distinguishes them — `spatial-language.ts` `applianceNoun()` says "a cooktop (burners only, no oven below)" vs "a freestanding range (burners with an oven below)", and `rendering-prompt.ts` describes a selected cooktop as "burners only, no oven — DO NOT draw an oven door under it". A standalone cooktop still gets a hood above it (cooktops need ventilation; the hood folds into the cooktop noun in the walkthrough). Range and cooktop are now mutually exclusive primary cooking surfaces: the Appliances form (`showroom-intake-steps.tsx` `setCookingStatus`) clears the other when one is set YES; `normalizeRound1Form` enforces the same invariant defensively (if both YES, keep the range, drop the cooktop) so other writers (e.g. the AI intake agent, whose system prompt was also updated) can never produce both; a separate wall oven / built-in microwave may still coexist with either. Verified: `npx tsc --noEmit`, `npm test` (160), `npm run build` (clean after clearing a stale `.next` cache), and live browser QA — back-wall elevation shows the cooktop as burners-only with no oven door, and the form toggles confirm Range→YES flips Cooktop→NO and vice-versa. See `elevation-scene.ts`, `elevation-preview.tsx`, `spatial-language.ts`, `rendering-prompt.ts`, `normalize.ts`, `showroom-intake-steps.tsx`, and `agent-service.ts`.

Done (2026-06-18): Layout Preference split into explicit base shape + island intent. The default Layout step no longer offers island-specific shape choices. Kitchen shape is now ordered for sales as `LEFT_L_SHAPE`, `RIGHT_L_SHAPE`, `U_SHAPE`, `ONE_WALL`, `GALLEY`, `PENINSULA`, `NO_PREFERENCE`; `LEFT_L_SHAPE` maps to `TOP + LEFT`, `RIGHT_L_SHAPE` maps to `TOP + RIGHT`. A separate `Need island?` select captures `YES` / `NO` / `UNKNOWN` in `layoutSensitiveCabinets.island.status`; only `YES` produces island run/geometry, while `UNKNOWN` adds `UNKNOWN_ISLAND_STATUS` confirmation. Compatibility remains: schema still parses legacy `L_SHAPE`, `L_SHAPE_ISLAND`, `U_SHAPE_ISLAND`, and `ISLAND`, and restore/display maps them into the new base-shape + island-status UI. The Round 1 agent allowlist/prompt now emits the new base layout values and island status instead of choosing island-specific layout preferences. Verified: `npx tsc --noEmit`, `npm test` (163), `npm run build`, and browser QA at `http://127.0.0.1:3003/` showing the new layout options and `Need island?` three-state field with no legacy island-specific shape options visible. See `schemas.ts`, `showroom-intake-steps.tsx`, `showroom-intake-data.ts`, `plan-geometry.ts`, `rendering-prompt.ts`, and `agent-service.ts`.

Done (2026-06-18): Excluded the "Microwave / oven combo" and "Wall oven" text labels from the Top-Down Layout Plan. The physical appliance geometry/symbols are still drawn, but the text labels inside are omitted to keep the plan clean per request. Verified: `npm test` (193 passing) and `npx tsc --noEmit`. See `layout-preview.tsx` and `layout-preview.test.tsx`.

Done (2026-06-18): dropped appliance wall questions for non-primary cooking/tall units + added intelligent automatic appliance auto-layout. Initial version removed the wall question for `cooktop` and `microwaveOvenCombo`; a later oven/microwave arrangement pass also removed `Wall oven approximate wall`, so the current first-phase Appliances form asks an approximate wall only for `range`. `placeAppliances` in `plan-geometry.ts` auto-distributes any appliance with no chosen wall across the layout's allowed walls instead of piling them all on the main run: `resolveApplianceWall` returns a fixed wall only for a drag override or an explicit relation, else `null`; null-wall appliances are then placed onto the wall with the most free linear span (committed appliance load vs wall length). A cooktop is biased to the main run (`TOP`) since it is a primary cooking surface; tall units (wall oven, microwave, stacked oven/microwave tower) spread to the least-crowded wall. Drag overrides and explicit customer wall choices still win, so the customer can fine-tune by dragging in `Adjust Positions`. Sink/dishwasher/range/fridge keep their existing deterministic defaults (their default relations are explicit). Current oven/microwave details are captured in the dedicated 2026-06-18 arrangement entry above. See `showroom-intake-steps.tsx` (`RoughApplianceFields`) and `plan-geometry.ts` (`resolveApplianceWall`, auto-layout block in `placeAppliances`).

Done (2026-06-18): improved layout previews and appliance differentiation. Differentiated the visual models for Microwave and Wall Oven in both `plan-geometry.ts` (added `microwave` symbol), `layout-preview.tsx` (top-down view differentiation), and `elevation-preview.tsx` (rough wall elevation differentiation). Added an interactive hover tooltip in `layout-preview.tsx` that uniformly displays the hovered appliance's name at the top center of the canvas without obscuring the drawing. Fixed a wall cabinet generation bug in `plan-geometry.ts` where wall cabinets would overlap the cooktop; cooktop is now correctly matched by its `key` and added to `wallObstacles` along with the `hood`.

Done (2026-06-19): tightened built-in microwave wording and arrangement gating. The Round 1 UI now labels `microwaveOvenCombo` as `Built-in microwave` / `Microwave` instead of `Microwave / oven combo`, and rendering/spatial prompts use `a microwave`. The oven/microwave arrangement select now appears only when both wall oven and built-in microwave are YES; `NO_MICROWAVE` and `NO_OVEN` were removed from the selectable arrangement values because those states are already represented by the individual appliance statuses. See `showroom-intake-steps.tsx`, `plan-geometry.ts`, `spatial-language.ts`, `rendering-prompt.ts`, and their tests.
