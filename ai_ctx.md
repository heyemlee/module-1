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
- Pluggable LLM provider layer for the optional Round 1 conversational intake agent. Business code should depend only on a `LLMProvider` interface under `src/server/llm/`; switch vendor via `.env.local` `LLM_PROVIDER=openai|deepseek|anthropic` plus the matching key. Server-side only. Default model choices may be overridden by `OPENAI_MODEL`, `DEEPSEEK_MODEL`, or `ANTHROPIC_MODEL`.

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
  - Customer-facing SVG preview orchestrator.
  - Owns preview state, MEP toggle, SVG printing, pointer handling, and drag override updates.
- `src/features/round1/layout-preview-shapes.tsx`
  - Stateless SVG shape components used by the layout preview, such as walls, islands, corners, markers, legend, and stamp placeholders.
- `src/features/round1/showroom-intake-app.tsx`
  - Top-level showroom workflow state, step navigation, snapshot generation, persistence, restore, and page composition.
- `src/features/round1/showroom-intake-steps.tsx`
  - Step components for Room, Openings, Layout, Appliances, and Adjust Positions.
- `src/features/round1/showroom-intake-panels.tsx`
  - Sidebar panels for rough cabinet fill, snapshot status, snapshot JSON, rendering gate note, and snapshot save status.
- `src/features/round1/showroom-intake-controls.tsx`
  - Shared intake UI primitives such as `Step`, `Panel`, `NumberField`, `SelectField`, `StatusPill`, and `parseNullableSize`.
- `src/features/round1/showroom-intake-data.ts`
  - Form defaults and `createDefaultCabinetRuns(form)`.
- `src/domain/round1/cabinets.ts`
  - Cabinet dimensions, cabinet codes, standard width matching, and preliminary split rules.
- `src/server/round1/round1-repository.ts`
  - Repository abstraction; currently MVP storage, later persistent implementation.
- `src/infrastructure/image/openai-rest-image-client.ts`
  - Existing optional OpenAI image client; not authoritative for plan data.

## Current Implementation

Implemented and verified as of 2026-06-17:

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
- Sink/window center snapping remains supported for legacy or explicitly provided `UNDER_WINDOW` / `BEHIND_SINK` data. The first-phase UI now asks only for the window wall (front/back/left/right/unknown), leaving exact sink/window alignment to manual plan adjustment or later detail.
- Appliance position dropdowns are hidden from the first-phase form; rough placement is driven by layout defaults and manual SVG adjustment.
- Window approximate relation in the first-phase form is wall-level only: front/back/left/right/unknown. It no longer asks sales to choose `behind sink` or `under window`.
- Dishwasher now renders as an integrated base-cabinet panel instead of a detached handle rectangle.
- Fixed appliance SVGs (fridge, sink, range, dishwasher, oven) to correctly adapt, rotate, and center on vertical walls without deformation or mirroring.
- Position-first preview gating: initial page load renders only the empty room shell; door/window symbols appear in `Openings`, layout guide areas appear in `Layout`, appliance symbols appear in `Appliances`, and those fixed-position symbols become draggable in `Adjust Positions`; advancing past `Adjust Positions` may mark fixed positions as confirmed, but preliminary cabinet fill appears only after the explicit `Generate Cabinet Fill` action.
- Staged SVG preview: the visible top-down plan now follows the active intake step instead of rendering from all default form values at once. Room shows only the shell; Openings shows selected door/window symbols immediately; Layout adds pale dashed wall/island/peninsula guide areas for the selected kitchen shape; Appliances adds fixture/appliance symbols; Adjust Positions makes those symbols draggable; generated cabinets appear only after `Generate Cabinet Fill`.
- Round 1 appliance detail boundary: cooking appliances now capture only rough presence and wall location for `range`, `cooktop`, `wallOven`, and `microwaveOvenCombo`. Range is treated as an appliance that includes an oven; detailed sizes/types/configuration stay out of Module 1 and belong to a later detailed questionnaire plus designer field measurements.
- Round 1 floor plan cabinet fill is intentionally coarse: geometry may add `ROUND1_GENERIC_BASE_*` and `ROUND1_GENERIC_WALL_*` visual cabinet blocks to fill visible gaps around fixed appliances/openings. These are sales-confirmation/rendering-reference geometry only, not production cabinet codes.
- Cabinet fill must never move or resize fixed-position symbols. Sink, dishwasher, range/cooktop, fridge, wall oven, microwave/oven combo, windows, and doors are placed from the active intake/drag state first; rough generic cabinet fill adapts around those positions. Regression coverage compares appliance geometry before and after `Generate Cabinet Fill`.
- Drag UX polish: added hover halos, grab handles, and wall-target highlighting during drag operations; improved manual-adjustment status UI; and added logic to automatically clear invalid wall overrides when the layout shape changes.
- Simplified default Round 1 workflow: fill basic information, adjust approximate door/window/appliance positions, generate rough cabinet fill, and confirm the general direction with the customer. The default UI no longer exposes the internal layout prompt or detailed per-cabinet editing. Pricing/quote functionality is reserved for a later step.
- Step navigation is sequential in the default Round 1 UI: sales can revisit previously reached steps, but cannot jump ahead to later steps before advancing through the form.
- Oven / microwave questions live with core appliances because they affect fixed-position layout. Detailed corner cabinet type selection is deferred to Module 2; L-shape and U-shape layouts automatically show generic corner cabinet areas in Round 1 without requiring `BLIND_CORNER`, `LAZY_SUSAN`, or other detailed corner choices.
- Authoritative Round 1 JSON snapshot, frozen by `Generate Cabinet Fill`. Pure builder `buildRound1Snapshot` in `src/features/round1/snapshot.ts` captures `showroomForm`, normalized data, `positionOverrides`, `fixedPositionsConfirmed: true`, `cabinetFillGenerated: true`, the preliminary cabinet list, the deterministic `floorPlan` geometry (rebuildable from the captured inputs), `confirmationItems`, `readiness`, and the metadata flags (`salesEstimateOnly`, `notForProduction`, `dimensionConfidence: "ROUGH"`). Includes `schemaVersion` and `generatedAt`.
- Snapshot staleness: editing any layout-critical form value or dragging any position after a snapshot exists clears `cabinetFillGenerated` and the snapshot, forcing regeneration before the snapshot is valid again.
- `Round 1 Snapshot` sidebar panel (sales/QA): shows snapshot status, rough counts, sales-only flags, and a collapsible raw JSON view. Kept out of the customer-facing SVG, which stays clean.
- `Generate Rendering` button: disabled until a complete snapshot exists and is saved to the server; once enabled it generates a customer concept preview (see the dedicated rendering entry below for the full data flow and AI-boundary guarantees).
- Snapshot persistence: `Round1Repository` gained `saveSnapshot` and a `Round1Project.snapshot` field, plus a file-backed implementation `createFileSystemRound1Repository` (single JSON document) alongside the in-memory one. The default `round1Repository` singleton is file-backed when `ROUND1_DATA_FILE` is set (e.g. `.data/round1-projects.json` via `.env.local` in dev) and in-memory otherwise, so tests stay disk-free. API: `PUT /api/round1/projects/[id]/snapshot` (validates the Round 1 safety invariants, passthrough rest) and `GET /api/round1/projects/[id]`.
- Client persistence + restore: `Generate Cabinet Fill` lazily creates a project (id kept in `localStorage`) and `PUT`s the snapshot, with a `Saving/Saved/error` status line in the panel. On mount the app fetches the stored project and, if a snapshot exists, rehydrates `form`, `positionOverrides`, `fixedPositionsConfirmed`, `cabinetFillGenerated`, and the snapshot — so a page refresh keeps the frozen Round 1 result.
- Safe refactor (2026-06-17): the oversized intake and preview files were split without behavior changes. `showroom-intake-app.tsx` now keeps workflow orchestration while steps, panels, and shared controls live in adjacent focused files. `layout-preview.tsx` keeps stateful preview/drag behavior while stateless SVG shape components live in `layout-preview-shapes.tsx`.
- `Generate Rendering` (customer concept preview) is implemented and non-authoritative. The button is enabled only once the snapshot is persisted (`persistState === "saved"`). On click the client rasterizes the on-screen deterministic floor plan SVG to a PNG (`src/features/round1/rasterize-svg.ts`, via an exposed `svgRef` on `LayoutPreview`) and `POST`s it to `POST /api/round1/projects/[id]/rendering`. The route loads the authoritative snapshot server-side by project id (never trusting client-posted data), builds a JSON-derived prompt from the snapshot (`src/features/round1/rendering-prompt.ts`), and calls the image edit boundary. Rendering input includes BOTH the deterministic layout image and the JSON prompt. Image boundary extended: `ImageClient.images.edit` (multipart `POST /images/edits`) + `OpenAIImageAdapter.generateConceptRendering`; server orchestration in `src/server/round1/rendering-service.ts` stamps `salesEstimateOnly`/`notForProduction`/`dimensionConfidence: "ROUGH"` and `basedOnSnapshotGeneratedAt`. Model: `gpt-image-2`.
- Concept rendering persistence + staleness: the rendering is stored in a SEPARATE non-authoritative `Round1Project.latestRendering` field (`Round1ProjectRendering` in `round1-repository.ts`, via `saveRendering`, file-backed + in-memory) — never inside `Round1Snapshot`, never affecting readiness/validity. The rendering route persists after generating and returns the stored payload (incl. `createdAt`); `GET /api/round1/projects/[id]` returns it, and the client mount-restore rehydrates it. Staleness is derived (`renderingBasedOn !== snapshot.generatedAt`, or snapshot cleared): a layout-critical edit/drag no longer discards the preview — it stays visible but dimmed with an "Outdated — based on an earlier snapshot" warning and a disabled `Regenerate Rendering` button until cabinet fill is regenerated and the rendering re-run. Shared `RenderingControls` sub-component renders the button/messages/image in both panel branches.

Latest known verification (after merging the safe refactor and concept rendering branches):

- `npm test`: 116 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Browser QA at `http://127.0.0.1:3000/`: initial load shows an empty room shell with no opening/appliance/cabinet symbols; Openings shows selected door/window symbols immediately; Layout adds two pale guide bands for the default L-shape; Appliances adds five fixed-position symbols; Adjust Positions keeps those symbols draggable with no cabinet fill; `Generate Cabinet Fill` produces rough base/wall cabinets. Openings status toggles were verified live: door/window `NO` removes the symbol and `YES` restores it immediately.

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

Done (2026-06-17): safe refactor / file organization pass is implemented and verified. Intake workflow, step components, panels, controls, and preview SVG shape components are split into focused files with behavior unchanged.

Done (2026-06-17): the reserved `Generate Rendering` action is implemented and verified (concept-only, non-authoritative). Rendering input includes BOTH the deterministic floor plan image (client-rasterized from the on-screen SVG) and a JSON-derived prompt built server-side from the authoritative snapshot loaded by project id. The image edit boundary (`/images/edits` multipart) was added without regressing the layout-background path. The result is an ephemeral concept preview only — never persisted, never part of the snapshot, never source of truth for cabinet data/dimensions/counts/geometry/quotes; snapshot invalidation/regeneration clears it. The direct sales workflow (form -> Adjust Positions -> `Generate Cabinet Fill` -> frozen snapshot -> `Generate Rendering`) stays fully usable with no conversational agent. Verified: `npm test` (91), `npx tsc --noEmit`, `npm run build`, and live browser QA (gating disabled→enabled on save; real `gpt-image-2` round-trip returned and displayed a concept image matching the L-shape plan; reload rehydrates the snapshot but not the ephemeral rendering, as intended). See `rendering-service.ts`, `rendering-prompt.ts`, `rasterize-svg.ts`, `openai-image-adapter.ts`, and `src/app/api/round1/projects/[id]/rendering/route.ts`.

Done (2026-06-17): concept rendering wrap-up — persistence + staleness. The rendering now persists in a separate non-authoritative `Round1Project.latestRendering` field (never in `Round1Snapshot`) and is restored on reload. Layout-critical edits/drags no longer discard it; it stays shown but dimmed with an "Outdated — based on an earlier snapshot" warning + disabled `Regenerate Rendering` until the snapshot is regenerated and the rendering re-run. Verified: `npm test` (94), `npx tsc --noEmit`, `npm run build`, live browser QA (generate -> displays fresh; reload -> restores from server; form edit -> shows stale/dimmed + Outdated warning). See `round1-repository.ts` (`saveRendering`/`Round1ProjectRendering`), the rendering route, and `RenderingControls` in `showroom-intake-app.tsx`.

Done (2026-06-17): rendering accuracy pass — spatial prompt + locked clean reference. Fixed the layout↔rendering mismatch (fridge/door drifting to the wrong wall, missing corner cabinet). Two root causes addressed deterministically: (1) the prompt was spatially blind, and (2) the reference image was the noisy live preview. Now: `buildRound1RenderingPrompt` translates `snapshot.floorPlan` into explicit, camera-anchored spatial constraints via a new pure helper `src/features/round1/floorplan/spatial-language.ts` (fixed one-point camera convention — `TOP`=back wall ahead, `BOTTOM`=front/behind camera, `LEFT`/`RIGHT` literal; per-wall left-to-right / near-to-far appliance walkthrough; corner-cabinet location from `wallCorners[].type`; window-above-sink; an always-on negative door constraint; and a "behind the viewpoint" note for front-wall appliances). The reference image is now a clean render built from the locked `snapshot.floorPlan` (not the live DOM): `LayoutPreview` gained a `plan?` prop (render a precomputed plan) and a `referenceMode` prop (strips MEP markers, window/door/island/appliance text labels, hover/drag chrome, header). A hidden off-screen `LayoutPreview plan={snapshot.floorPlan} referenceMode` is rasterized via the existing `rasterizeSvgElement` so image + prompt share one locked source. The image boundary now accepts multiple reference images: `referenceImagesBase64: string[]` threaded through `rendering-service` → `openai-image-adapter` → `openai-rest-image-client`, and the route accepts `referenceImagesBase64` with a legacy `referenceImageBase64` fallback. Multipart shape: a SINGLE reference is sent as `image`, MULTIPLE as repeated `image[]` parts — never both (the real API 400s if both are present; see memory `openai-images-edit-single-vs-multi-image-field`). AI boundary unchanged (snapshot loaded server-side by id; rendering stays non-authoritative `latestRendering`; staleness logic intact). Verified: `npm test` (116), `npx tsc --noEmit`, and a live `gpt-image-2` round-trip on the reported L-shape snapshot — the concept now keeps the fridge on the back wall (far right), shows no door on a side wall, and renders the back-left corner cabinet, fixing all three reported defects. See `spatial-language.ts`, `rendering-prompt.ts`, `layout-preview.tsx`, `showroom-intake-app.tsx`, and the image pipeline files.

Next implementation TODO:

- Optional Phase 2 — deterministic perspective ("SVG-first") reference image: build a one-point-perspective (or folded-elevation) SVG from `snapshot.floorPlan` (proposed `src/features/round1/perspective/perspective-scene.ts` pure builder + `perspective-preview.tsx` renderer, internal-only), reusing `wallToCamera`/`alongAxisValue` from `spatial-language.ts`. The `referenceImagesBase64: string[]` plumbing already carries it — add a second hidden reference ref in `showroom-intake-app.tsx` with no API change. Gate on a visual check; this is the structural fix if drift persists after the Phase 1 prompt + clean reference.
- Otherwise no outstanding Module 1 rendering work. Next real feature (optional) is the conversational Round 1 agent — see "Later Work" below; greenfield (`src/server/llm/` and `POST /api/round1/agent` do not exist yet).
- Note: the previously-leaked `OPENAI_API_KEY` should still be rotated as a security hygiene step (see "Architecture Decision" security note); the key in `.env.local` is currently working for rendering.

## Later Work

After drag UX polish:

- Note: "Refine per-appliance deterministic default placement" (e.g. dishwasher adjacent to sink, fridge near a run end, range near gas/vent, avoid overlap with corners) depends on specific appliance and customer requirements. This will be deferred to the detailed data step (Module 2 or later).

- Add optional detailed / Module 2 mode later:
  - dimension strings
  - cabinet codes
  - production-style view
  - keep it out of default Round 1 customer view
- Persistent repository: a lightweight file-backed implementation now exists (`createFileSystemRound1Repository`). A future durable datastore (DB) can replace it behind the same `Round1Repository` interface.
- Optional realistic-render-from-SVG refinements:
  - use deterministic SVG as reference
  - never use generated image as authoritative plan data
- Optional Round 1 conversational agent:
  - A server-side, provider-agnostic tool-use loop at `POST /api/round1/agent` may later turn natural-language customer requirements into structured form patches and explanations.
  - The agent should edit the live on-screen form through the existing `updateForm` path, so the deterministic SVG preview updates in place and snapshot staleness rules still apply.
  - Snapshot authority remains human-only. The agent must have no snapshot-freeze/save tool; freezing the authoritative Round 1 snapshot stays exclusively on the `Generate Cabinet Fill` button.
  - Provider layer: `src/server/llm/provider.ts` with `ToolSpec`, `AgentInput`, `AgentOutput`, `LLMProvider`, and `getLLMProvider(env = process.env)`; adapters for `openai`, `deepseek`, and `anthropic`; 503 reason `LLM_PROVIDER_NOT_CONFIGURED` when unconfigured.
  - Agent tools should wrap existing deterministic functions: `update_intake` (`normalizeRound1Form`), `estimate_cabinets` (`generatePreliminaryCabinetList(createDefaultCabinetRuns(ctx.form))` + `summarizePreliminaryCabinetEstimate`), and `explain_confirmations`.
  - AI boundary: the LLM may fill fields, run rough estimates, relay deterministic tool output, and explain confirmation items; it must not invent counts/dimensions/geometry/readiness, close confirmation items, claim production-ready, or mark/save snapshots.

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
