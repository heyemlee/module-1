# AI Context: Module 1 Round 1 MVP

Date: 2026-06-17
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

Future customer rendering flow:

- The app may later expose a separate `Generate Rendering` button after rough cabinet fill is generated.
- This button should use the deterministic layout image plus a summary of the complete Round 1 JSON snapshot as GPT Image input.
- Do not use only JSON or only the layout image for customer rendering; use both so the image model gets spatial constraints and semantic/material context.
- Generated renderings are customer-facing concept images only. They must not become the source of truth for cabinet data, dimensions, counts, geometry, quote data, or production readiness.

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
- Advanced designer/sales manual cabinet review domain helpers exist, but the default Module 1 UI does not expose per-cabinet add/edit/remove.
- Deterministic black-and-white/top-down SVG plan renderer v1.
- Geometry tests for the plan renderer.
- Global 2D obstacle avoidance to prevent corner collisions.
- Interactive drag-and-drop floor plan elements (doors, windows, appliances).
- Adjust Positions workflow with parent-owned preview position overrides.
- Functional clearance zones for dragged appliances/openings and no-fill cabinet reflow around those zones.
- In-browser clean SVG print functionality for the floor plan.
- Multi-wall / multi-run generated layouts for one-wall, galley, L-shape, U-shape, peninsula, and island preferences.
- Island layout estimates now include `ON_ISLAND` base cabinet entries.
- Wall-aware drag overrides for sink, window, range, fridge, dishwasher, and door.
- Draggable objects can switch between layout-allowed walls during SVG dragging.
  - *Exception*: Doors and windows are exempt from `layoutPreference` restrictions and can be placed on any wall.
- Sink/window center snapping when same-wall projected overlap is close enough.
- Appliance position dropdowns are hidden from the first-phase form; rough placement is driven by layout defaults and manual SVG adjustment.
- Dishwasher now renders as an integrated base-cabinet panel instead of a detached handle rectangle.
- Fixed appliance SVGs (fridge, sink, range, dishwasher, oven) to correctly adapt, rotate, and center on vertical walls without deformation or mirroring.
- Position-first preview gating: initial page load renders only the empty room shell; door/window/appliance symbols appear when entering `Adjust Positions`; advancing past `Adjust Positions` may mark fixed positions as confirmed, but preliminary cabinet fill appears only after the explicit `Generate Cabinet Fill` action.
- Drag UX polish: added hover halos, grab handles, and wall-target highlighting during drag operations; improved manual-adjustment status UI; and added logic to automatically clear invalid wall overrides when the layout shape changes.
- Simplified default Round 1 workflow: fill basic information, adjust approximate door/window/appliance positions, generate rough cabinet fill, and confirm the general direction with the customer. The default UI no longer exposes the internal layout prompt or detailed per-cabinet editing. Pricing/quote functionality is reserved for a later step.
- Oven / microwave questions live with core appliances because they affect fixed-position layout. Detailed corner cabinet type selection is deferred to Module 2; L-shape and U-shape layouts automatically show generic corner cabinet areas in Round 1 without requiring `BLIND_CORNER`, `LAZY_SUSAN`, or other detailed corner choices.
- Authoritative Round 1 JSON snapshot, frozen by `Generate Cabinet Fill`. Pure builder `buildRound1Snapshot` in `src/features/round1/snapshot.ts` captures `showroomForm`, normalized data, `positionOverrides`, `fixedPositionsConfirmed: true`, `cabinetFillGenerated: true`, the preliminary cabinet list, the deterministic `floorPlan` geometry (rebuildable from the captured inputs), `confirmationItems`, `readiness`, and the metadata flags (`salesEstimateOnly`, `notForProduction`, `dimensionConfidence: "ROUGH"`). Includes `schemaVersion` and `generatedAt`.
- Snapshot staleness: editing any layout-critical form value or dragging any position after a snapshot exists clears `cabinetFillGenerated` and the snapshot, forcing regeneration before the snapshot is valid again.
- `Round 1 Snapshot` sidebar panel (sales/QA): shows snapshot status, rough counts, sales-only flags, and a collapsible raw JSON view. Kept out of the customer-facing SVG, which stays clean.
- Reserved `Generate Rendering` button: disabled until a complete snapshot exists; once enabled it only shows a "reserved for a later step" note. Rendering itself is intentionally not implemented yet.
- Snapshot persistence: `Round1Repository` gained `saveSnapshot` and a `Round1Project.snapshot` field, plus a file-backed implementation `createFileSystemRound1Repository` (single JSON document) alongside the in-memory one. The default `round1Repository` singleton is file-backed when `ROUND1_DATA_FILE` is set (e.g. `.data/round1-projects.json` via `.env.local` in dev) and in-memory otherwise, so tests stay disk-free. API: `PUT /api/round1/projects/[id]/snapshot` (validates the Round 1 safety invariants, passthrough rest) and `GET /api/round1/projects/[id]`.
- Client persistence + restore: `Generate Cabinet Fill` lazily creates a project (id kept in `localStorage`) and `PUT`s the snapshot, with a `Saving/Saved/error` status line in the panel. On mount the app fetches the stored project and, if a snapshot exists, rehydrates `form`, `positionOverrides`, `fixedPositionsConfirmed`, `cabinetFillGenerated`, and the snapshot — so a page refresh keeps the frozen Round 1 result.

Latest known verification:

- `npm test`: 79 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Browser QA at `http://127.0.0.1:3000/`: initial load shows an empty room shell with no appliance/opening/cabinet symbols and a `No snapshot yet` panel with the `Generate Rendering` button disabled; entering `Adjust Positions` reveals draggable door/window/appliance symbols; the first action confirms fixed positions without showing cabinet metrics; the explicit `Generate Cabinet Fill` action produces the rough cabinet fill and freezes the Round 1 snapshot (panel flips to `Snapshot ready`, JSON populated, `Generate Rendering` enabled, status shows `Saved to server`); changing a form value afterward clears the snapshot and re-disables `Generate Rendering`. Persistence round-trip verified: the snapshot is written to `.data/round1-projects.json`, and a full page reload restores it from the server (panel stays `Snapshot ready`, rough fill repopulates).

Always re-run relevant verification after changing behavior.

## Layout Engine & Geometry Rules

The layout engine (`plan-geometry.ts`) enforces physical realism in the deterministic SVG preview:

- **Appliance Clustering**: Appliances (sink, dishwasher, range) are clustered with a capped maximum spacing (e.g., 12 inches) rather than scattered evenly across the entire wall. This ensures base cabinets can continuously connect them without unnatural gaps.
- **Window Alignment**: If a window's relation is `UNDER_WINDOW` or `BEHIND_SINK`, the engine aligns the window's final position with the sink, guaranteeing perfect visual alignment. Windows are rendered with standard 3-line architectural symbols.
- **Global Obstacle Avoidance & Cabinet Shrinking**: Fixed elements (doors, windows, appliances) are calculated first and serve as global 2D boundaries. When laying out cabinet runs (`layRun`), if a cabinet's 2D track overlaps a global obstacle or hits an occupied corner, it dynamically shrinks to fit the remaining space rather than dropping out completely. This maximizes wall usage, eliminates unrealistic empty corners, and completely prevents cabinets from extending into the path of appliances on adjacent walls (e.g., blocking a fridge door).
- **Interactive Drag-and-Drop**: The `layout-preview.tsx` supports manual `PositionOverrides`. Users can drag any window, door, or appliance along its designated wall. The geometry algorithm instantly recalculates the layout, dynamically splitting, growing, or shrinking the adjacent cabinets to wrap tightly around the user's manually chosen position.
- **Base Cabinet Visual Fillers**: To uphold the rule "where there is a wall cabinet, there must be a base cabinet", a post-processing step automatically projects missing base cabinets under floating wall cabinets if no base appliance or cabinet exists there. This keeps the sales-estimate preview visually cohesive even with incomplete or manually altered preliminary cabinet arrays.

## Active Work: Next Session

Current Module 1 priority:

- Keep the first-step workflow simple:
  1. Room.
  2. Openings.
  3. Layout.
  4. Appliances.
  5. Adjust Positions.
- Do not keep a separate `Cabinets` form step in Module 1. `Adjust Positions` owns the final Round 1 actions: confirm fixed positions, then explicitly generate rough cabinet fill.
- Do not add pricing/quote functionality yet; leave it reserved for a later step.
- Keep first-round form questions layout-critical. Oven / microwave belongs in Appliances. Detailed corner cabinet type questions belong in Module 2.
- Do not expose detailed per-cabinet editing, cabinet codes, production-style dimensions, or internal prompt/debug output in the default Round 1 UI.

Done (2026-06-17): the complete Round 1 JSON snapshot described below is implemented and verified. `Generate Cabinet Fill` is the authoritative snapshot point; the snapshot captures `showroomForm`, normalized data, `positionOverrides`, `fixedPositionsConfirmed: true`, `cabinetFillGenerated: true`, the preliminary cabinet list, deterministic floor plan geometry (rebuildable from captured inputs), `confirmationItems`, `readiness`, and the metadata flags. Layout-critical form changes or drags clear the snapshot. It stays sales-confirmation-level only (no Module 2 detail). See `src/features/round1/snapshot.ts`.

Done (2026-06-17): snapshot persistence is implemented and verified. The snapshot is no longer React-state-only — it persists through `Round1Repository.saveSnapshot` (file-backed via `createFileSystemRound1Repository` + `ROUND1_DATA_FILE`), is saved over the API on `Generate Cabinet Fill`, and is restored on page reload. See `round1-repository.ts`, `src/app/api/round1/projects/[id]/`, and the mount-restore effect in `showroom-intake-app.tsx`.

Next implementation TODO:

- Implement the reserved `Generate Rendering` action (currently gated + stubbed). It should send BOTH the deterministic layout image and a JSON-derived rendering prompt/summary (from the persisted snapshot) to GPT Image 2. Prerequisite: a valid `OPENAI_API_KEY` in `.env.local`, and rotate the previously-leaked key first.
- Generated renderings are customer-facing concept images only; they must never become the source of truth for cabinet data, dimensions, counts, geometry, quote data, or production readiness.

## Later Work

After drag UX polish:

- Note: "Refine per-appliance deterministic default placement" (e.g. dishwasher adjacent to sink, fridge near a run end, range near gas/vent, avoid overlap with corners) depends on specific appliance and customer requirements. This will be deferred to the detailed data step (Module 2 or later).

- Add optional detailed / Module 2 mode later:
  - dimension strings
  - cabinet codes
  - production-style view
  - keep it out of default Round 1 customer view
- Persistent repository: a lightweight file-backed implementation now exists (`createFileSystemRound1Repository`). A future durable datastore (DB) can replace it behind the same `Round1Repository` interface.
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

Oven / microwave belongs with Appliances in Round 1 because it can affect fixed positions. Corner cabinet type selection does not belong in Round 1; for `L_SHAPE`, `U_SHAPE`, `L_SHAPE_ISLAND`, and `U_SHAPE_ISLAND`, the deterministic plan should automatically render generic corner cabinet areas and leave exact corner type for detailed data / Module 2.

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
- Keep confirmation marker compact, such as `N to confirm`.
- Include a Print button for clean, standalone floor plan printing.

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
