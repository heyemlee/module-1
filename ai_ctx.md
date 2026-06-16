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
   - Current heuristic spreads appliances evenly along their wall. Refine: dishwasher adjacent to the sink, fridge at a run end, range near the gas marker, and avoid appliances overlapping the corner block or each other. Keep it monochrome and approximate (Round 1).

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

- Black/gray strokes on a white background; no color fills
- Base cabinets: light-gray fill with a thin dark outline
- Wall cabinets: dashed gray outline, tight to wall
- Corner cabinet: light-gray block with a lazy-susan arc
- Appliances/fixtures: white block with a thin black outline and a small line symbol (sink basin, range burners, fridge centerline, dishwasher dashed)
- Water marker: `W`
- Gas marker: `G`
- Electric marker: `E`
- Vent marker: `V`

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
