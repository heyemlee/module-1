# AI Context: Module 1 Round 1 MVP

Date: 2026-06-16
Scope: Module 1 only: Round 1 showroom intake, deterministic layout generation, and preliminary cabinet sales estimate.
Status: Implementation in progress.

This is the short "hot context" file to feed AI at the start of normal development sessions.
For full historical context, complete JSON examples, old decisions, detailed form field lists, and prior implementation notes, read `docs/round1-context-archive.md` only when needed.

## Source Of Truth

This file is the current working context for Module 1 Round 1 MVP.

Do not rely on `docs/module-1-round1-mvp-plan.md`; that earlier planning file was removed to avoid duplicate sources of truth.

Keep Module 1 separate from later modules:

- Module 1: showroom intake, rough customer confirmation, preliminary estimate.
- Module 2: production engineering / detailed measured design. Use a separate context later.
- Module 3: shopfloor execution. Use a separate context later.

## Product Boundary

Round 1 output is a customer confirmation and sales-estimate artifact.

It helps sales and the customer confirm approximate positions of room fixed points, appliances, and rough cabinet fill. It is not a production drawing, field-measured plan, or manufacturing source of truth.

Every generated output must preserve:

- `salesEstimateOnly: true`
- `notForProduction: true`
- `dimensionConfidence: "ROUGH"` unless exact measured values are explicitly provided
- `Confirmation Required` flags for missing, approximate, non-standard, or manually overridden information

Unknown values should not block Round 1 generation. They should create `Confirmation Required` items.

## Tech Stack

Use the existing stack:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Zod
- Vitest
- Lightweight repository abstraction for MVP storage, swappable to persistent storage later
- OpenAI image route/client exists, but is optional and not part of the authoritative plan generation path

Do not use n8n as the core Round 1 workflow engine in V1. It may be useful later for CRM, reminders, deposit follow-up, notifications, or other external automation.

## Architecture Decision

The customer-facing top-down layout is a deterministic, data-driven SVG floor plan.

AI image generation must not produce or own the plan. The deterministic code owns geometry, cabinet counts, cabinet widths, cabinet codes, MEP markers, readiness, and production-gate rejection.

Current authoritative path:

1. Sales fills the showroom form.
2. Form data is normalized into strict JSON.
3. Domain code generates the preliminary cabinet list and confirmation items.
4. `buildFloorPlan(normalized, cabinets, confirmationCount)` builds deterministic plan geometry.
5. The React layout preview renders the top-down SVG live from that geometry.

The existing OpenAI image route/client is retained only for a future optional realistic-render-from-SVG feature. It must never own cabinet data, dimensions, layout geometry, or production readiness.

Security note: an `OPENAI_API_KEY` was previously shared in chat/context. Rotate it if this project will continue using the image route.

## AI Boundary

AI may:

- Help sales organize customer input into structured fields.
- Convert form JSON into prompts or summaries.
- Summarize `Confirmation Required` items.
- Explain why something needs confirmation.
- Eventually create optional realistic customer preview imagery from a deterministic SVG reference.

AI must not:

- Become the source of truth for cabinet dimensions, cabinet codes, cabinet counts, or geometry.
- Mark Round 1 data as production-ready.
- Bypass deterministic readiness checks.
- Bypass `salesEstimateOnly: true` or `notForProduction: true`.
- Silently close `Confirmation Required` items.

Deterministic code must own:

- Form schema validation.
- Normalized JSON validation.
- Cabinet code generation.
- Standard cabinet split.
- Preliminary cabinet list generation.
- Round 1 readiness.
- Production gate rejection for Round 1 data.
- Programmatic rendering of cabinets, openings, appliances, MEP markers, status labels, and stamps.

## Key Files

- `src/features/round1/floorplan/plan-geometry.ts`
  - Pure geometry builder.
  - Main function: `buildFloorPlan(normalized, cabinets, confirmationCount)`.
- `src/features/round1/layout-preview.tsx`
  - Customer-facing SVG renderer.
  - Uses renderer style constants such as `INK`, `LINE`, `LINE_SOFT`, `FILL_CABINET`, and `FILL_CORNER`.
- `src/features/round1/showroom-intake-data.ts`
  - Form defaults and `createDefaultCabinetRuns(form)`.
- `src/domain/round1/cabinets.ts`
  - Cabinet dimensions, cabinet codes, standard width matching, and preliminary split rules.
- `src/server/round1/round1-repository.ts`
  - Repository abstraction; currently MVP storage, later persistent implementation.
- `src/infrastructure/image/openai-rest-image-client.ts`
  - Existing optional OpenAI image client; not authoritative for plan data.

## Current Implementation

Implemented and verified as of 2026-06-16:

- Round 1 form schema and normalized JSON schema.
- `Confirmation Required` item model.
- Cabinet dimension/code helpers.
- Standard cabinet run split.
- Preliminary cabinet list generation.
- Round 1 readiness checks.
- Conditional 6-step showroom intake UI.
- JSON-to-layout-prompt generation.
- OpenAI image adapter boundary and REST client, now decoupled from plan generation.
- Rough cabinet estimate summary.
- Up-to-3-inch filler allowance.
- Advanced designer/sales manual cabinet review UI.
- Deterministic black-and-white/top-down SVG plan renderer v1.
- Geometry tests for the plan renderer.
- Global 2D obstacle avoidance to prevent corner collisions.
- Interactive drag-and-drop floor plan elements (doors, windows, appliances).

Latest known verification:

- `npm test`: 42 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Browser QA at `http://127.0.0.1:3000/`: plan rendered live from the form.

Always re-run relevant verification after changing behavior.

## Layout Engine & Geometry Rules

The layout engine (`plan-geometry.ts`) enforces physical realism in the deterministic SVG preview:

- **Appliance Clustering**: Appliances (sink, dishwasher, range) are clustered with a capped maximum spacing (e.g., 12 inches) rather than scattered evenly across the entire wall. This ensures base cabinets can continuously connect them without unnatural gaps.
- **Window Alignment**: If a window's relation is `UNDER_WINDOW` or `BEHIND_SINK`, the engine aligns the window's final position with the sink, guaranteeing perfect visual alignment. Windows are rendered with standard 3-line architectural symbols.
- **Global Obstacle Avoidance & Cabinet Shrinking**: Fixed elements (doors, windows, appliances) are calculated first and serve as global 2D boundaries. When laying out cabinet runs (`layRun`), if a cabinet's 2D track overlaps a global obstacle or hits an occupied corner, it dynamically shrinks to fit the remaining space rather than dropping out completely. This maximizes wall usage, eliminates unrealistic empty corners, and completely prevents cabinets from extending into the path of appliances on adjacent walls (e.g., blocking a fridge door).
- **Interactive Drag-and-Drop**: The `layout-preview.tsx` supports manual `PositionOverrides`. Users can drag any window, door, or appliance along its designated wall. The geometry algorithm instantly recalculates the layout, dynamically splitting, growing, or shrinking the adjacent cabinets to wrap tightly around the user's manually chosen position.
- **Base Cabinet Visual Fillers**: To uphold the rule "where there is a wall cabinet, there must be a base cabinet", a post-processing step automatically projects missing base cabinets under floating wall cabinets if no base appliance or cabinet exists there. This keeps the sales-estimate preview visually cohesive even with incomplete or manually altered preliminary cabinet arrays.

## Active Work: Next Session

Highest priority: multi-wall / multi-run layouts.

Problem:

`createDefaultCabinetRuns` currently emits only a main run mapped to `TOP` plus one `LEFT` run for non-one-wall layouts. U-shape, galley, peninsula, and island layouts need richer generated runs. The renderer already maps cabinet `location` to wall and draws corners at occupied-wall intersections, so it should draw whatever runs the data contains.

Implement layout preference to generated run mapping:

- `ONE_WALL` -> `TOP`
- `GALLEY` -> `TOP` + `BOTTOM`
- `L_SHAPE` -> `TOP` + `LEFT`
- `PENINSULA` -> `TOP` + `LEFT` plus a peninsula stub
- `U_SHAPE` -> `TOP` + `LEFT` + `RIGHT`
- `ISLAND` -> wall run plus `ON_ISLAND`
- `L_SHAPE_ISLAND` -> `TOP` + `LEFT` + `ON_ISLAND`
- `U_SHAPE_ISLAND` -> `TOP` + `LEFT` + `RIGHT` + `ON_ISLAND`

Use existing `CabinetLocation` values where possible:

- `ON_MAIN_RUN`
- `LEFT_SIDE`
- `RIGHT_SIDE`
- `FRONT_SIDE`
- `ON_ISLAND`

Add or update tests:

- `U_SHAPE` produces base cabinets on three walls and two corners.
- `GALLEY` produces runs on top and bottom walls.
- Island layouts produce a non-null island and `ON_ISLAND` cabinets.

## Later Work

After multi-run layouts:

- Refine per-appliance placement:
  - dishwasher adjacent to sink
  - fridge near a run end
  - range near gas/vent
  - avoid appliance overlap with corner blocks
- Add optional detailed / Module 2 mode later:
  - dimension strings
  - cabinet codes
  - production-style view
  - keep it out of default Round 1 customer view
- Add persistent repository implementation behind `Round1Repository`.
- Optional realistic-render-from-SVG:
  - use deterministic SVG as reference
  - never use generated image as authoritative plan data

## Cabinet Estimate Rules

Round 1 cabinet data is preliminary and sales-estimate-only.

Default sales UX should show rough allowance summaries, not force sales to fill every cabinet.

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

- Wall cabinets: 12" depth, widths 9" to 36" in 3" increments, heights 30", 36", or 40".
- Base cabinets: 24" depth, widths 9" to 36" in 3" increments, actual height 34.5".
- Tall/appliance cabinets may use standard assumptions, but must be marked preliminary.

Auto-split width priority:

```text
36, 33, 30, 27, 24, 21, 18, 15, 12, 9
```

Filler rule:

- Remainder up to 3" per rough run is estimated filler allowance.
- Remainder above 3" remains `Confirmation Required`.
- Filler is summarized in Round 1; exact filler placement can wait for detailed design.

Flag `Confirmation Required` when:

- Cabinet size is non-standard.
- A run has a non-filler remainder.
- Appliance dimensions are missing.
- Tall or appliance cabinet assumptions are used.
- Custom cabinet is requested or implied.
- Designer manually creates a cabinet outside standard assumptions.

## Form Rules

The showroom form should be layout-critical only.

Use status-first groups for conditional logic:

- `YES`: item exists; show dependent detail fields.
- `NO`: item does not exist; hide dependent fields and normalize dependent relations as not applicable or unknown.
- `UNKNOWN`: item status is not known; hide impossible details and create `Confirmation Required`.

Do not treat `NO` and `UNKNOWN` as the same state.

Customer-facing options should be friendly and anchored:

- under window
- main run
- left area
- right area
- open side
- no preference
- not sure

Do not expose internal labels such as `BACK_SIDE` or `LEFT_SIDE` in the final customer layout.

Internal normalized vocabulary may include:

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

`NEAR_ENTRANCE` should only exist as a future derived semantic after an entrance/opening has been identified. Do not offer it as a primary customer-facing option in the current form.

## Output Visual Rules

The Round 1 customer plan should be simple, readable, and suitable for confirmation.

Required:

- Clean architectural top-down line-art style.
- Mostly black/gray strokes on white background.
- No decorative fills or photorealistic rendering in the plan.
- Show approximate positions only.
- Show walls, openings, doors, windows, major appliances, sink, dishwasher, hood/oven/microwave if applicable, base cabinets, wall cabinets, corner cabinets, and optional MEP markers.
- Include `Round 1 Sales Estimate Only` stamp.
- Keep confirmation marker compact, such as `N to confirm`.

Avoid:

- Dense construction drawings.
- Production-ready dimensions.
- On-image dimension strings in default Round 1 view.
- Cabinet codes on the default customer image.
- Text clutter such as internal wall/location vocabulary.

Use the current renderer constants and tests as source of truth for exact styling. Do not reintroduce the old AI-background or crude fixed-position overlay approach.

## Verification

For behavior changes, run:

```bash
npm test
npx tsc --noEmit
npm run build
```

For layout/UI changes, also do browser QA at:

```text
http://127.0.0.1:3000/
```

Expected preview server name in prior sessions:

```text
module-1-dev
```

Before claiming completion, verify the actual command output.

## Archive Usage

Read `docs/round1-context-archive.md` when you need:

- Full historical context.
- Complete JSON examples.
- Detailed form field lists.
- Prompt skeletons.
- Old implementation sequence.
- Prior visual decisions and superseded approaches.
- Edge-case reasoning not present in this hot context.

Do not let archive details override newer decisions in this file unless the user explicitly says the archive is more current.
