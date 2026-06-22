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

Round 1 must stay coarse. Do not use Module 1 to solve precise detailed-data rendering, production cabinet scheduling, exact filler placement, or final cabinet-by-cabinet design. Those belong to V2 / Module 2 after detailed measurements and designer review.

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

Security note: an `OPENAI_API_KEY` was previously leaked (shared in chat/context). It has since been rotated (2026-06-18); the old key is no longer valid. Never paste API keys into chat, context files, or commits — keep them in `.env.local` only.

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
- Multi-wall / multi-run generated layouts for one-wall, galley, explicit left-L, explicit right-L, U-shape, and peninsula preferences.
- Island intent is no longer encoded as a kitchen-shape option in the default UI. `Layout Preference` shows base shapes only (`LEFT_L_SHAPE`, `RIGHT_L_SHAPE`, `U_SHAPE`, `ONE_WALL`, `GALLEY`, `PENINSULA`, `NO_PREFERENCE`) plus a separate three-state `Need island?` field (`YES` / `NO` / `UNKNOWN`) backed by `layoutSensitiveCabinets.island.status`. `YES` generates `ON_ISLAND` cabinet entries and island geometry; `NO` and `UNKNOWN` do not generate island geometry by default. `UNKNOWN` creates a `Confirmation Required` item.
- Legacy saved layout values remain parseable: `L_SHAPE` behaves like `LEFT_L_SHAPE`, and legacy `L_SHAPE_ISLAND` / `U_SHAPE_ISLAND` / `ISLAND` can still restore but are not offered in the default UI.
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
- Round 1 appliance detail boundary: The first-phase Appliances form captures ONLY the presence (YES/NO/UNKNOWN) of appliances (range, cooktop, wallOven, built-in microwave via `microwaveOvenCombo`, fridge, dishwasher, sink). ALL detailed questions regarding appliance sizes (sink size, fridge size, dishwasher size) and approximate wall locations have been moved out of the first-phase form and deferred to the second-phase detailed data confirmation. Their rough wall is decided by deterministic auto-layout and remains drag-adjustable in the SVG. Oven/microwave relationship is captured separately through `layoutSensitiveCabinets.ovenMicrowave.configuration` only when both wall oven and built-in microwave are present, so the form can distinguish a stacked wall-oven/microwave tower from separate wall oven and microwave locations. Single-appliance absence is represented by the appliance status itself, not by arrangement values such as `NO_MICROWAVE` or `NO_OVEN`. Range is treated as an appliance that includes an oven; detailed sizes/types/configuration stay out of Module 1 and belong to a later detailed questionnaire plus designer field measurements.
- Round 1 floor plan cabinet fill is intentionally coarse: geometry may add `ROUND1_GENERIC_BASE_*` and `ROUND1_GENERIC_WALL_*` visual cabinet blocks to fill visible gaps around fixed appliances/openings. These are sales-confirmation/rendering-reference geometry only, not production cabinet codes.
- Sink and dishwasher are integrated into base-cabinet footprints in the Round 1 plan; they must not cut holes in the base cabinet run. The plan also suppresses narrow clipped wall-cabinet fragments around sink/window obstacles so the rough preview does not look like it added extra tiny upper cabinets or exact filler. Exact filler layout is deferred to V2 / Module 2.
- Cabinet fill must never move or resize fixed-position symbols. Sink, dishwasher, range/cooktop, fridge, wall oven, built-in microwave, windows, and doors are placed from the active intake/drag state first; rough generic cabinet fill adapts around those positions. Regression coverage compares appliance geometry before and after `Generate Cabinet Fill`.
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
- Rendering Preferences step + cabinet color libraries (2026-06-22, Tasks 1–5 of the rendering-preferences plan): the default Round 1 workflow is now SIX steps — `Room`, `Openings`, `Layout`, `Appliances`, `Adjust Positions`, `Rendering Preferences` (`SHOWROOM_STEPS` in `showroom-intake-app.tsx`). `Adjust Positions` now focuses only on confirming fixed positions and generating cabinet fill; the `Generate Rendering` action moved into the final `Rendering Preferences` step.
  - Schema: `Round1RenderingPreferences` ({ `cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED"`, `doorColorId: string | null` }) lives on the showroom form and is copied into the snapshot. `DEFAULT_RENDERING_PREFERENCES` defaults to European frameless / no color.
  - Cabinet color libraries are admin-managed, per-company, and per-style: `CabinetColor` (`src/server/platform/cabinet-color-repository.ts`, Postgres + in-memory, `cabinet_colors` table with hardened migrations) holds `cabinetStyle`, `name`, `colorCode`, `swatchImageUrl`, `swatchHex`, `hoverExampleImageUrl`, `promptDescription`, `active`, `sortOrder`. APIs under `/api/admin/cabinet-colors` (ADMIN-only). Admin UI at `/admin/cabinet-colors` (`cabinet-colors-admin-view.tsx` + `cabinet-color-form.tsx`) with a dashboard link.
  - Admin Add Color form is intentionally minimal (simplified 2026-06-22): only Cabinet style, Color name, **Swatch image (file upload)**, **Hover example image (file upload, optional)**, and an optional AI description. Uploads are read client-side into data URLs and stored in the existing `swatch_image_url` / `hover_example_image_url` text columns (no image host / object storage; ~4MB per-file cap). `promptDescription` falls back to the color name when left blank. `colorCode`, `swatchHex`, and `sortOrder` are no longer in the form (columns kept nullable; sortOrder defaults 0 → list sorts by name); `active` is only shown when editing an existing color (defaults true on create). The `cabinetColorInputSchema` `swatchImageUrl`/`hoverExampleImageUrl` validators accept either a hosted URL or a `data:image/...;base64,` URL. Editing without re-picking a file preserves the stored image.
  - Sales step: `rendering-preferences-step.tsx` + helpers in `rendering-preferences.ts`. Shows large square swatches for the SELECTED style only (`activeColorsForStyle`), hover example image when configured, and a click-to-confirm dialog before saving a color (`Confirm Color`). Switching style clears an incompatible selected color (`nextRenderingPreferencesForStyle`). Empty state asks an Admin to configure cabinet colors. Rendering is enabled only once a snapshot is saved AND `renderingPreferencesComplete` is true.
  - Prompt: `rendering-prompt.ts` composes style-specific language (European frameless flat-slab/handleless vs. American framed face-frame) plus the selected color's `promptDescription`. The rendering stamp records `basedOnRenderingPreferences` ({ doorColorId, cabinetStyle, colorUpdatedAt }) alongside `basedOnSnapshotGeneratedAt`.
  - Decoupled staleness: changing ONLY style/color after a snapshot does NOT clear cabinet fill or the snapshot (`renderingPreferenceStampMatches` tracks preference staleness separately) — it only marks an existing rendering as stale, prompting regenerate.

Latest known verification (after merging the safe refactor and concept rendering branches):

- `npm test`: 193 tests passing.
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

Done (2026-06-22): Round 1 Rendering Preferences + cabinet color libraries (plan `docs/superpowers/plans/2026-06-19-round1-rendering-preferences.md`) — Tasks 1–6 complete and verified. See the "Rendering Preferences step + cabinet color libraries" entry under Current Implementation for the full surface. Work lives on branch `codex/round1-rendering-preferences` (not yet merged to `main`).

- Tasks 1–5: implemented and reviewed (schema/defaults/snapshot copy; cabinet color DB/schema/repository/API; Admin Cabinet Colors page/form/dashboard link; Sales Rendering Preferences step; rendering prompt/service/history metadata).
- Task 6 (final verification) PASSED end-to-end:
  - Step 1 automated: `npm test` 250 passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0.
  - Step 2 `npm run db:migrate`: ran against a local Docker Postgres (the only configured `DATABASE_URL` is the Railway `postgres.railway.internal` prod host, which is unreachable from local and must not be migrated from a dev machine — migrations run on Railway deploy). Migration created the `cabinet_colors` table with the style check constraint + company FK.
  - Step 3 Admin color QA: created a European color (swatch + hover example URLs) and an American color through the real UI/API → DB; an inactive European color shows in Admin but is hidden from the Sales board. Non-admin redirect is enforced in `src/app/admin/cabinet-colors/page.tsx` (non-ADMIN → `/projects`, unauth → `/login`).
  - Step 4 Sales QA: Round 1 page shows the 6-step list ending in `Rendering Preferences`; the color board shows only the selected style's active colors (inactive + other-style hidden); switching style clears an incompatible selected color; hover example image present; click opens a confirm dialog (Cancel does not save, Confirm saves); `Generate Rendering` enables only once the snapshot is saved AND a color is confirmed; changing style/color after a snapshot does NOT clear cabinet fill or the snapshot (same `generatedAt`); an existing rendering stays visible but is marked "Outdated — please regenerate rendering to update" with regenerate disabled until a compatible color is reconfirmed.
  - Step 5 rendering-prompt QA: generated one European (`gpt-image-2`) and one American rendering. European prompt contains "modern frameless European-style cabinetry" + the color's `promptDescription` and no American language; American prompt contains "American framed cabinetry" + its `promptDescription` and no European language. Each stored rendering stamps `based_on_cabinet_style`, `based_on_door_color_id` (matching the selected color), `based_on_snapshot_generated_at` (both renderings share the locked snapshot timestamp), and `sales_estimate_only`/`not_for_production`/`dimension_confidence=ROUGH`.
  - Step 6: no verification fixes were required.
- QA was run against an ephemeral local Docker Postgres (`module1-qa-pg`) seeded with a throwaway admin; that container + a temporary `module-1-qa` launch config were torn down after QA. Production still uses Railway `DATABASE_URL`.

Follow-up (2026-06-22): simplified the Admin Add Color form to upload-based fields (see the "Admin Add Color form is intentionally minimal" bullet under Current Implementation) and re-verified — `npm test` 251 passing, `tsc --noEmit` exit 0, `npm run build` exit 0, plus local browser QA (form renders the 5 fields, image upload → `POST` 201 → data URL persisted → renders in the Admin board). The schema/table were unchanged by this UI work.

Production migration applied (2026-06-22): ran `npm run db:migrate` against the Railway DB via the public TCP-proxy `DATABASE_URL` (`*.proxy.rlwy.net`) — `cabinet_colors` table created and the `renderings.based_on_*` columns added. Migration is idempotent (`CREATE TABLE / ADD COLUMN IF NOT EXISTS`), so the Railway pre-deploy `db:migrate` will be a no-op on redeploy. Note: `.env.local` `DATABASE_URL` now points at the Railway **public proxy** host for local dev against prod data; `migrate.mjs` does not auto-load `.env.local`, so pass `DATABASE_URL` explicitly when running it from local.

Done (2026-06-19): admin self-service user management implemented — ADMIN-only `/admin/users` page + `GET/POST /api/admin/users` (requireRole ADMIN, 401/403/409 handled), backed by `user-admin-repository.ts` (list + create, password hashed via existing helper). Dashboard shows a Users link for admins. Light real-use polish: login brand from `NEXT_PUBLIC_COMPANY_NAME` (fallback "Showroom"; inlined at build time, set in Railway before build for a custom brand), dashboard empty-state CTA, responsive dashboard/header. Salespeople can now be added from the UI instead of editing the Railway pre-deploy command. Verified with `npm test` (214), `npx tsc --noEmit`, `npm run build`, and end-to-end browser QA against local Docker Postgres (login 200, create 201, duplicate 409, SALES gating 403 + redirect, mobile no-overflow).

Done (2026-06-19): internal project platform foundation implemented for formal Railway deployment. Added fixed email/password auth, Admin/Sales/Designer roles, customer/project dashboard shell, Railway Postgres schema/repositories, project-scoped Round 1 state/snapshot/rendering APIs, rendering history, and read-only AI status from Railway Variables. Production should use `DATABASE_URL`; `ROUND1_DATA_FILE` remains local/dev fallback only. See `docs/deployment/railway-internal-platform.md`.

Current Module 1 status:

- Module 1 Round 1 MVP is feature-complete for the prior scope. The active addition is the Rendering Preferences + cabinet color feature (see "Active Work" above): Tasks 1–5 done, Task 6 manual QA pending.
- Latest automated verification (2026-06-22): `npm test` 250 passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0. End-to-end browser QA for the new feature is still outstanding (Task 6 steps 2–5).
- The 2026-06-19 prior baseline (before rendering preferences) also passed `npm test` / `npx tsc --noEmit` / `npm run build` / end-to-end browser QA.
- Treat old implementation plans under `docs/superpowers/plans/` as historical unless `ai_ctx.md` explicitly reactivates them. The rendering-preferences plan (`2026-06-19-round1-rendering-preferences.md`) is currently ACTIVE.
- After the rendering-preferences feature passes manual QA, the next useful move is deploy-readiness.

Current Module 1 guardrails:

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

Recently completed: the full dated changelog of completed Module 1 work (snapshot + persistence, concept rendering + spatial-prompt/locked-reference accuracy, the optional conversational intake agent + voice STT, rough wall elevations, cooktop-vs-range, layout-shape/island split, oven/microwave arrangement, appliance auto-layout, and assorted preview fixes) now lives in `docs/round1-context-archive.md` under "Module 1 Round 1 — Completed Work Log". The current state of all of it is summarized above in "Current Implementation"; consult the archive only when you need the per-change rationale or history.

Next implementation TODO:

- Recommended next priority: deploy Module 1 first, then do UI polish from real sales/customer feedback, then open Module 2 detailed measured design as a separate scoped effort.
- Deployment should come before broad UI redesign because the MVP workflow is already passing verification and needs real-use validation before more interface churn.
- UI adjustment is the second priority: keep it limited to deployment feedback, responsiveness, copy clarity, and workflow friction. Do not add pricing/quote or production-style cabinet editing during this pass.
- Module 2 detailed measured design is third priority and should start only with a separate context/spec. It can cover dimension strings, cabinet codes, production-style views, exact filler placement, and measured cabinet-by-cabinet design.
- No outstanding Module 1 rendering work. The optional conversational Round 1 agent is now implemented; `src/server/llm/` and `POST /api/round1/agent` exist.
- Note: the previously-leaked `OPENAI_API_KEY` has now been rotated (2026-06-18); the old key is invalid and the new key in `.env.local` is working for rendering. See the "Architecture Decision" security note. No further rotation action outstanding.

## Later Work

After Module 1 deployment:

- Note: "Refine per-appliance deterministic default placement" (e.g. dishwasher adjacent to sink, fridge near a run end, range near gas/vent, avoid overlap with corners) depends on specific appliance and customer requirements. This will be deferred to the detailed data step (Module 2 or later).

- Add optional detailed / Module 2 mode later:
  - dimension strings
  - cabinet codes
  - production-style view
  - precise detailed-data-driven rendering
  - exact filler placement / filler schedule
  - final cabinet-by-cabinet splits after measured design
  - keep it out of default Round 1 customer view
- Persistent repository: a lightweight file-backed implementation now exists (`createFileSystemRound1Repository`). A future durable datastore (DB) can replace it behind the same `Round1Repository` interface.
- Optional realistic-render-from-SVG refinements:
  - use deterministic SVG as reference
  - never use generated image as authoritative plan data
- Optional Round 1 conversational agent: DONE (see the dedicated Done entry under "Active Work" for the full implementation and AI-boundary guarantees). The design points below were all realized:
  - Server-side, provider-agnostic tool-use loop at `POST /api/round1/agent` turning natural-language requirements into structured form patches and explanations.
  - The agent edits the live on-screen form through the existing `updateForm` path, so the deterministic SVG preview updates in place and snapshot staleness rules still apply.
  - Snapshot authority is human-only: no snapshot-freeze/save tool; freezing stays exclusively on the `Generate Cabinet Fill` button.
  - Provider layer `src/server/llm/` with the `LLMProvider` interface, `getLLMProvider(env)`, adapters for `openai`/`deepseek`/`anthropic`, and `LLMProviderNotConfiguredError` → 503.
  - Tools wrap deterministic functions: `update_intake` (`normalizeRound1Form`), `estimate_cabinets` (`generatePreliminaryCabinetList(createDefaultCabinetRuns(ctx.form))` + `summarizePreliminaryCabinetEstimate`), `explain_confirmations`.
  - AI boundary held in code (allowlist + Zod strip of control fields) plus the system prompt. Potential follow-ups: response streaming, conversation persistence across reloads, and per-field "confirmed by user" guards so the agent can't silently revert human-entered values.

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

## Visual & Styling Guidelines

- **Style:** European spec, modern frameless, flat slab, press-to-open (no visible handles).
- **Wall Cabinets:** Must be full-height single panel doors with no splits, NO crown molding, NO top fascia boards, NO soffit trim.
- **Toe Kicks:** Must be continuously recessed across adjacent cabinets without vertical segment lines separating individual cabinets.
- **Fillers:** Narrow gaps (`w < 14`) must be rendered as blank filler panels (no drawer lines, no door splits, no handles).
- **Clearances:** 
  - Wall cabinets should leave a visual margin (e.g. ~8px in SVG) around windows to prevent crowding.
  - Base cabinets must touch appliances (like sinks, fridges) seamlessly without gaps.

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
