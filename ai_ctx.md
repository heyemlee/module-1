# AI Context: Module 1 Round 1 MVP

Date: 2026-06-23
Scope: Module 1 only: Round 1 showroom intake, deterministic layout generation, preliminary cabinet sales estimate, and non-authoritative customer concept rendering.
Status: Module 1 Round 1 MVP is feature-complete for the current scope; next priority is deployment readiness and real-use validation.

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

The existing OpenAI image route/client is retained only for optional customer concept rendering. It must never own cabinet data, dimensions, layout geometry, or production readiness.

Customer concept rendering flow:

- The app exposes `Generate Rendering` only after rough cabinet fill is generated, the snapshot is saved, and required rendering preferences are confirmed.
- The rendering path uses high-fidelity rendering references (Perspective Structure, Top-down Plan, Wall Elevations) plus a material swatch and the JSON snapshot summary as GPT Image input.
- Do not use only JSON or only the layout images for customer rendering; use the structured references so the image model gets comprehensive spatial constraints and semantic/material context.
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
- `src/features/round1/perspective-preview.tsx`
  - 3D perspective SVG preview component for structure reference in rendering.
- `src/features/round1/elevations/elevation-scene.ts`
  - Builder for wall-level elevation SVG previews.
- `src/features/round1/showroom-intake-app.tsx`
  - Top-level showroom workflow state, step navigation, snapshot generation, persistence, restore, and page composition.
- `src/features/round1/showroom-intake-steps.tsx`
  - Step components for Room, Openings, Layout, Appliances, and Adjust Positions.
- `src/features/round1/showroom-intake-panels.tsx`
  - Sidebar panels for rough cabinet fill, snapshot status, snapshot JSON, rendering gate note, and snapshot save status.
- `src/features/platform/cabinet-colors-manager.tsx`
  - Admin batch editor for existing cabinet colors, with compact swatches, dirty-row tracking, and one Save All action.
- `src/features/platform/renderings-view.tsx`
  - Read-only project renderings history page.
- `src/features/platform/login-form.tsx` / `src/app/api/auth/login/route.ts` / `src/server/platform/auth-repository.ts`
  - Account/password login flow. Login uses `account`, not email-format validation.
- `src/features/platform/create-user-form.tsx` / `src/server/platform/user-admin-repository.ts`
  - Admin user creation and company user listing, including the required login `account`.
- `src/components/ui/button.tsx` / `src/app/globals.css` / `tailwind.config.ts`
  - Shared UI theme and button styling. The app shell is currently black/white/neutral, not blue/white.
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
- `src/server/platform/api-errors.ts`
  - Shared API auth/body error mapping for project, Round 1, cabinet color, and admin routes.
- `scripts/prepare-cabinet-colors.mjs` / `scripts/seed-cabinet-colors.mjs`
  - Regenerable EU cabinet color swatch preparation and idempotent seed tooling.
- `scripts/seed-admin.mjs` / `scripts/seed-user.mjs`
  - Idempotent user seed tooling. Supports `SEED_ADMIN_ACCOUNT` / `SEED_USER_ACCOUNT`; falls back to the email prefix when omitted.

## Current Implementation

Implemented and verified through 2026-06-23:

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
- Multi-wall / multi-run generated layouts for one-wall, galley, explicit left-L, explicit right-L, U-shape, and peninsula preferences. `PENINSULA` generates `ON_PENINSULA` cabinet entries to keep it distinct from wall-hugging base runs.
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
- `Generate Rendering` button: lives in the final `Rendering Preferences` step and stays disabled until a complete snapshot exists, is saved to the server, and required rendering preferences are confirmed; once enabled it generates a customer concept preview (see the dedicated rendering entry below for the full data flow and AI-boundary guarantees).
- Snapshot persistence: `Round1Repository` gained `saveSnapshot` and a `Round1Project.snapshot` field, plus a file-backed implementation `createFileSystemRound1Repository` (single JSON document) alongside the in-memory one. **Update (2026-06-23): live API persistence is now Postgres** (`src/server/platform/round1-postgres-repository.ts` — the routes import `saveRound1Snapshot`/`getRound1State`/`getRenderingImage` from it). The file-backed/in-memory `round1Repository` singleton in `src/server/round1/round1-repository.ts` is legacy, retained only for tests and the shared `Round1ProjectRendering` type; it is no longer wired to any route. API: `PUT /api/projects/[projectId]/round1/snapshot` (validates the Round 1 safety invariants, passthrough rest) and `GET /api/projects/[projectId]/round1/state` (returns persisted round1 state incl. the snapshot); project read is `GET /api/projects/[projectId]`.
- Client persistence + restore: `Generate Cabinet Fill` lazily creates a project (id kept in `localStorage`) and `PUT`s the snapshot, with a `Saving/Saved/error` status line in the panel. On mount the app fetches the stored project and, if a snapshot exists, rehydrates `form`, `positionOverrides`, `fixedPositionsConfirmed`, `cabinetFillGenerated`, and the snapshot — so a page refresh keeps the frozen Round 1 result.
- Safe refactor (2026-06-17): the oversized intake and preview files were split without behavior changes. `showroom-intake-app.tsx` now keeps workflow orchestration while steps, panels, and shared controls live in adjacent focused files. `layout-preview.tsx` keeps stateful preview/drag behavior while stateless SVG shape components live in `layout-preview-shapes.tsx`.
- `Generate Rendering` (customer concept preview) is implemented and non-authoritative. The button is enabled only once the snapshot is persisted (`persistState === "saved"`). The UI uses `Round1RenderingFlow` and `Round1InlineRenderPreview` with `fitViewport` support to display references. On click, the client rasterizes the perspective, top-down, and elevation SVGs to PNGs and `POST`s them as typed structured references (`PERSPECTIVE_STRUCTURE`, `TOP_DOWN_PLAN`, `WALL_ELEVATIONS`, `MATERIAL_SWATCH`) to `POST /api/projects/[projectId]/round1/renderings`. The route loads the authoritative snapshot server-side by project id (never trusting client-posted data), builds a JSON-derived prompt from the snapshot (`src/features/round1/rendering-prompt.ts`), and calls the image edit boundary. Rendering input includes the structured layout images and the JSON prompt. Image boundary extended: `ImageClient.images.edit` (multipart `POST /images/edits`) + `OpenAIImageAdapter.generateConceptRendering`; server orchestration in `src/server/round1/rendering-service.ts` stamps `salesEstimateOnly`/`notForProduction`/`dimensionConfidence: "ROUGH"` and `basedOnSnapshotGeneratedAt`. Model: `gpt-image-2`.
- Concept rendering persistence + staleness: the rendering is stored in a SEPARATE non-authoritative `Round1Project.latestRendering` field (`Round1ProjectRendering` in `round1-repository.ts`, via `saveRendering`, file-backed + in-memory) — never inside `Round1Snapshot`, never affecting readiness/validity. The rendering route persists after generating and returns the stored payload (incl. `createdAt`); `GET /api/projects/[projectId]/round1/state` returns it, and the client mount-restore rehydrates it. Staleness is derived (`renderingBasedOn !== snapshot.generatedAt`, or snapshot cleared): a layout-critical edit/drag no longer discards the preview — it stays visible but dimmed with an "Outdated — based on an earlier snapshot" warning and a disabled `Regenerate Rendering` button until cabinet fill is regenerated and the rendering re-run. Shared `RenderingControls` sub-component renders the button/messages/image in both panel branches.
- Rendering Preferences step + cabinet color libraries (2026-06-22, Tasks 1–6 of the rendering-preferences plan, merged to `main` via PR #6): the default Round 1 workflow is now SIX steps — `Room`, `Openings`, `Layout`, `Appliances`, `Adjust Positions`, `Rendering Preferences` (`SHOWROOM_STEPS` in `showroom-intake-app.tsx`). `Adjust Positions` now focuses only on confirming fixed positions and generating cabinet fill; the `Generate Rendering` action moved into the final `Rendering Preferences` step.
  - Schema: `Round1RenderingPreferences` ({ `cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED"`, `doorColorId: string | null` }) lives on the showroom form and is copied into the snapshot. `DEFAULT_RENDERING_PREFERENCES` defaults to European frameless / no color.
  - Cabinet color libraries are admin-managed, per-company, and per-style: `CabinetColor` (`src/server/platform/cabinet-color-repository.ts`, Postgres + in-memory, `cabinet_colors` table with hardened migrations) holds `cabinetStyle`, `name`, `colorCode`, `swatchImageUrl`, `swatchHex`, `hoverExampleImageUrl`, `promptDescription`, `active`, `sortOrder`. APIs under `/api/admin/cabinet-colors` (ADMIN-only). Admin UI at `/admin/cabinet-colors` (`cabinet-colors-admin-view.tsx` + `cabinet-color-form.tsx`) with a dashboard link.
  - Admin Add Color form is intentionally minimal (simplified 2026-06-22): only Cabinet style, Color name, **Swatch image (file upload)**, **Hover example image (file upload, optional)**, and an optional AI description. Uploads are read client-side into data URLs and stored in the existing `swatch_image_url` / `hover_example_image_url` text columns (no image host / object storage; ~4MB per-file cap). `promptDescription` falls back to the color name when left blank. `colorCode`, `swatchHex`, and `sortOrder` are no longer in the form (columns kept nullable; sortOrder defaults 0 → list sorts by name); `active` is only shown when editing an existing color (defaults true on create). The `cabinetColorInputSchema` `swatchImageUrl`/`hoverExampleImageUrl` validators accept either a hosted URL or a `data:image/...;base64,` URL. Editing without re-picking a file preserves the stored image.
  - Sales step: `rendering-preferences-step.tsx` + helpers in `rendering-preferences.ts`. Shows large square swatches for the SELECTED style only (`activeColorsForStyle`), hover example image when configured, and a click-to-confirm dialog before saving a color (`Confirm Color`). Switching style clears an incompatible selected color (`nextRenderingPreferencesForStyle`). Empty state asks an Admin to configure cabinet colors. Rendering is enabled only once a snapshot is saved AND `renderingPreferencesComplete` is true.
  - Prompt: `rendering-prompt.ts` composes style-specific language (European frameless flat-slab/handleless vs. American framed face-frame) plus the selected color's `promptDescription`. The rendering stamp records `basedOnRenderingPreferences` ({ doorColorId, cabinetStyle, colorUpdatedAt }) alongside `basedOnSnapshotGeneratedAt`.
  - Decoupled staleness: changing ONLY style/color after a snapshot does NOT clear cabinet fill or the snapshot (`renderingPreferenceStampMatches` tracks preference staleness separately) — it only marks an existing rendering as stale, prompting regenerate.
- Cabinet color admin + sales color-library performance (2026-06-22): the Admin Cabinet Colors page now uses `CabinetColorsManager` instead of one heavy form per existing color. Existing colors are edited inline with compact swatches, per-row dirty state, and one Save All action. Uploaded swatches/hover examples are downscaled client-side before storage; image tags use lazy/async decoding. `listCabinetColors` supports omitting `hover_example_image_url` for list views, and both `/admin/cabinet-colors` and the Sales `/api/cabinet-colors` route use the lightweight mode so initial color-library payloads avoid the large hover-example image data. Production active color payload measurement after this fix: full image fields were ~73.60MB (swatches ~2.16MB + hover examples ~71.44MB); lightweight list payload keeps the swatches and drops hover examples to ~2.16MB. Seed scripts can prepare and idempotently load the 30 in-stock EU colors into `cabinet_colors`.
- Rendering color fidelity and history (2026-06-22, merged to `main`): `Generate Rendering` now sends the selected cabinet color swatch as an additional `MATERIAL_SWATCH` reference image (`rasterizeImageSourceToPngBase64`) alongside the deterministic spatial references. `/projects/[projectId]/renderings` shows persisted rendering history, and the project-detail Renderings card links there.
- Flow, auth, and resilience hardening (2026-06-22, merged to `main`): removed unauthenticated legacy `/api/round1/projects/*` and `/api/round1/layout-image` routes, added auth to the live Round 1 agent API, centralized API auth error handling with `authErrorResponse`, added app-level `not-found`/`error` pages, snapshot save retry, unsaved-edit guard, rendering request timeouts, safer form error handling, and sign-out controls across app surfaces.
- Account login + black/white UI polish (2026-06-23): the platform login is now explicitly account-based. `/api/auth/login` accepts `{ account, password }`; `loginWithPassword` and `findUserForLogin` query `users.account` case-insensitively. `users.account` was added to `schema.sql`, backfilled from existing emails as `lower(replace(email, '@', '_'))`, made `NOT NULL`, and protected by `CREATE UNIQUE INDEX IF NOT EXISTS users_account_lower_key ON users (lower(account))`. Admin user creation and the Users view use accounts; the creation form only asks for Account, Role, and Password, while required legacy name/email columns are populated internally from the account. Production login does not require entering an email-format identifier. The shared button/theme palette was also moved from blue/purple accents to black/white/neutral (`--app-blue` now maps to app ink, Tailwind `primary`/`ring` use app ink, `uiverse-fill-button` uses black border/fill, and remaining hardcoded sky-blue UI accents were neutralized).
- Renderings + Admin navigation performance (2026-06-23): clicking into `/projects/[projectId]/renderings` and Admin felt very slow. Root causes (measured against the remote Railway DB: ~1.2s cold connect, ~254ms warm round trip): (1) the rendering gallery pulled every saved image's full `image_base64` — heaviest project was 11 images / ~31MB taking ~19s — then inlined each as a `data:` URI in the SSR HTML; (2) the page also called `listCabinetColors(companyId)` with defaults (`includeHoverExampleImages: true`) just to build an id→name map, pulling ~73MB of swatch+hover image data over the wire (~17.8s page load, ~5.6MB HTML). Fixes: `listRenderings` is now metadata-only (no `image_base64`) and each `<img>`/Download loads via a new streaming route `GET /api/projects/[projectId]/round1/renderings/[renderingId]/image` (auth + project-scoped, `Cache-Control: private, max-age=31536000, immutable`, `loading="lazy"`/`decoding="async"`); `DownloadButton` now takes a single `href` (same-origin route URL for the gallery, inline data URL for the fresh in-memory preview). Added `listCabinetColorNames(companyId)` (SELECT id, name only) and switched the renderings page to it. The pg `Pool` is now tuned for the remote DB (`max: 10`, `idleTimeoutMillis: 60_000`, `keepAlive: true`, plus a pool `error` handler) so sporadic clicks reuse warm connections instead of paying the ~1.2s cold reconnect. Measured after fix: renderings page 17.8s→~0.7s, HTML 5.6MB→~92KB, 0 inline base64, 11 images stream via the route (200 `image/png`). Note: `/admin/cabinet-colors` still inlines ~2.16MB of swatches (already lightweight-mode for the 71MB hover set) — a candidate for the same per-image-route treatment if it ever feels slow.
- App Router navigation feedback (2026-06-23): added shared route skeletons through `loading.tsx` at the root, `/projects`, `/projects/[projectId]`, `/projects/[projectId]/renderings`, and `/admin`, so uncached client navigations immediately switch to an `aria-busy` fallback instead of leaving the previous page frozen. `getCurrentUser` now uses React `cache()` for render-request deduplication, and successful session→user lookups use a bounded 30-second in-process cache with immediate logout eviction, removing the repeated ~254ms auth query from normal page-to-page navigation. Regression tests cover cache hits, TTL expiry, and logout invalidation.
- Project status simplified to 4 stages (2026-06-24): the dashboard `Status` column was collapsed from 6 statuses to 4 to match the real workflow. `ProjectStatus` (`src/server/platform/types.ts`) is now `INTAKE` (问卷阶段 — set on project create and on snapshot save), `RENDERING_READY` (已生成渲染图 — set when a rendering is generated), `ROUND2_MEASURING` (Round 2 复尺 — placeholder, **no automatic trigger yet**), and `ARCHIVED`. The old `DRAFT`/`ROUND1_SNAPSHOT_READY`/`NEEDS_CONFIRMATION` all map to `INTAKE`, `ROUND1_RENDERING_READY`→`RENDERING_READY`, `ROUND2_READY`→`ROUND2_MEASURING`. Status writes live in `round1-postgres-repository.ts` (snapshot→`INTAKE`, rendering→`RENDERING_READY`); labels/colors in `project-dashboard.tsx` and `project-detail.tsx`. The dashboard's "need review" badge and the amber pulsing `NEEDS_CONFIRMATION` dot were removed (no status maps to them anymore). DB: `schema.sql` CHECK constraint + `DEFAULT` updated, and an **idempotent migration block** appended (UPDATE old→new values, then `DROP CONSTRAINT IF EXISTS projects_status_check` + re-`ADD` + `ALTER COLUMN ... SET DEFAULT 'INTAKE'`) — safe to re-run. `scripts/migrate.mjs` now mirrors `client.ts` `resolveSsl` so prod migrations honor `DATABASE_SSL_NO_VERIFY=true` over the Railway self-signed proxy. **Prod DB still needs `npm run db:migrate` run against it** to convert existing rows. Verified: `tsc` exit 0, `npm test` 276 passing, dev server no runtime errors.
- Enterprise-grade hardening + minimum-closed-loop pass (2026-06-23): trust-boundary hardening across the API surface, targeting OWASP ASVS ~L1→L2 for an internal tool (not L3/SOC 2/multi-region — deliberately out of scope). DB pool enforces TLS in production (`resolveSsl` in `db/client.ts`, `DATABASE_SSL_NO_VERIFY` escape hatch for self-signed proxy certs) plus `connectionTimeoutMillis`/`statement_timeout` so a hung query can't exhaust the pool. Login is now constant-time (verifies against a dummy scrypt hash for unknown/disabled accounts, removing the user-enumeration timing side-channel) and IP-rate-limited (10/min); the paid `POST /api/round1/agent` (30/min/user) and image `POST .../round1/renderings` (20/min/user) are per-user rate-limited via a new in-process limiter (`src/server/platform/rate-limit.ts` + test). ponytail: the limiter and the session→user cache are per-instance — swap for Redis only if scaled horizontally. All API routes funnel unexpected 500s through `serverError()` in `api-errors.ts` (tagged `console.error` + generic body) instead of swallowing them with no trace. Baseline security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) added via `headers()` in `next.config.ts`. The session→user query no longer SELECTs `password_hash`. Added `GET /api/health` (liveness, the only unauthenticated route) and `.github/workflows/ci.yml` (runs tsc+test+build on push to `main`/PR) so the verification loop is automated. The file/in-memory `round1Repository` is explicitly marked legacy (live persistence is the Postgres repository). Verified 2026-06-23 — see Latest known verification.

Latest known verification:

- 2026-06-23 after enterprise hardening + min-closed-loop pass: `npx tsc --noEmit` exit 0, `npm test` 276 passing (43 files, incl. new `rate-limit.test.ts`), `npm run build` exit 0 (18/18 pages). Browser QA on `http://localhost:3000`: all 5 security headers served on `/login`; the login page renders with 0 console/CSP violations; `POST /api/auth/login` returns 429 + `Retry-After: 60` after 10 attempts within the window; `serverError` writes a tagged stack trace (`[api:auth/login] …`) to the server log instead of an opaque 500; `GET /api/health` returns 200 `{ ok: true }` unauthenticated.

- 2026-06-23 doc/code closure pass (working tree, branch `fix/render-zoom-centering`): all 33 documented Key Files present; client `fetch` paths match the actual `/api/projects/[projectId]/round1/*` route handlers (stale `/api/round1/projects/*` paths in this file's snapshot/rendering entries were corrected to the current shape); image model `gpt-image-2` consistent between code default and docs. `npx tsc --noEmit` exit 0, `npm test` 272 passing (42 files), `npm run build` exit 0 (18/18 pages).
- 2026-06-23 after App Router navigation feedback: `npx tsc --noEmit` exit 0, `npm test` 252 passing, `npm run build` exit 0. Browser QA on `http://localhost:3001` covered Projects → project detail → Renderings → Admin Users → Cabinet Colors with no console warnings/errors; the first uncached Admin navigation exposed `main[aria-busy="true"]` immediately before the destination rendered.
- 2026-06-23 after renderings/admin performance fix: `npx tsc --noEmit` exit 0, `npm test` 249 passing, `npm run build` exit 0. Browser QA on the renderings page (logged in as `test` admin): page HTML ~92KB with 0 inline base64, all 11 images load via the new `/round1/renderings/[id]/image` route returning 200 `image/png` (2.11MB, valid PNG magic bytes, immutable cache header); compiled page load ~697ms vs ~17.8s before.
- 2026-06-23 after account-login and black/white UI polish: `npm test` 240 passing, `npm run build` exit 0. Local `db:migrate` was run successfully after sourcing `.env.local`. Browser QA on `http://localhost:3000/login` passed for desktop and 390px mobile: account input is `type="text"`, accepts `sales-one`, button styling is black/white, no runtime error overlay, and no mobile horizontal overflow.
- 2026-06-22 after cabinet-color lightweight payload fixes for Admin and Sales Rendering Preferences: `npm test` 235 passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0.
- 2026-06-22 after PR #11 / cabinet-color performance branch: `npm test` 233 passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0.
- 2026-06-22 after Admin Add Color upload simplification: `npm test` 251 passing, `npx tsc --noEmit` exit 0, `npm run build` exit 0.
- Rendering Preferences full QA passed earlier the same day: automated tests/build passed, local Docker Postgres migration passed, Admin Cabinet Colors QA passed, Sales Rendering Preferences QA passed, and prompt/stored-rendering metadata QA passed for both European and American styles.
- Production migration was applied on 2026-06-22 through the Railway public TCP proxy: `cabinet_colors` table exists and `renderings.based_on_*` columns exist. The migration is idempotent.

Always re-run relevant verification after changing behavior.

## Layout Engine & Geometry Rules

The layout engine (`plan-geometry.ts`) enforces physical realism in the deterministic SVG preview:

- **Appliance Clustering**: Appliances (sink, dishwasher, range) are clustered with a capped maximum spacing (e.g., 12 inches) rather than scattered evenly across the entire wall. This ensures base cabinets can continuously connect them without unnatural gaps.
- **Window Alignment**: If a window's relation is `UNDER_WINDOW` or `BEHIND_SINK`, the engine aligns the window's final position with the sink, guaranteeing perfect visual alignment. Windows are rendered with standard 3-line architectural symbols.
- **Global Obstacle Avoidance & Cabinet Shrinking**: Fixed elements (doors, windows, appliances) are calculated first and serve as global 2D boundaries. When laying out cabinet runs (`layRun`), if a cabinet's 2D track overlaps a global obstacle or hits an occupied corner, it dynamically shrinks to fit the remaining space rather than dropping out completely. This maximizes wall usage, eliminates unrealistic empty corners, and completely prevents cabinets from extending into the path of appliances on adjacent walls (e.g., blocking a fridge door).
- **Interactive Drag-and-Drop**: The `layout-preview.tsx` supports manual `PositionOverrides`. Users can drag any window, door, or appliance along its designated wall. The geometry algorithm instantly recalculates the layout, dynamically splitting, growing, or shrinking the adjacent cabinets to wrap tightly around the user's manually chosen position.
- **Base Cabinet Visual Fillers**: To uphold the rule "where there is a wall cabinet, there must be a base cabinet", a post-processing step automatically projects missing base cabinets under floating wall cabinets if no base appliance or cabinet exists there. This keeps the sales-estimate preview visually cohesive even with incomplete or manually altered preliminary cabinet arrays.

## Current State: Next Session

Current Module 1 status:

- Module 1 Round 1 MVP is feature-complete for the current scope, including Rendering Preferences, admin-managed cabinet colors, swatch-as-material rendering references, rendering history, and non-authoritative customer concept rendering.
- Latest automated verification (2026-06-23): after account-login and black/white UI polish, `npm test` 240 passing and `npm run build` exit 0.
- Latest browser QA (2026-06-23): `/login` rendered correctly at desktop and 390px mobile after `db:migrate`; account login input is plain text and accepts non-email account identifiers.
- Latest manual QA (2026-06-22): Rendering Preferences end-to-end QA passed, Admin Add Color upload form QA passed, and the production migration was applied successfully through the Railway public TCP proxy. The Admin Cabinet Colors and Sales Rendering Preferences color-library payload bottleneck was identified as large `hover_example_image_url` data and fixed by lightweight list queries; browser smoke testing after deploy remains useful for `/admin/cabinet-colors`, Round 1 Rendering Preferences, and `/projects/[projectId]/renderings`.
- The 2026-06-19 prior baseline (before rendering preferences) also passed `npm test` / `npx tsc --noEmit` / `npm run build` / end-to-end browser QA.
- Treat old implementation plans under `docs/superpowers/plans/` as historical unless `ai_ctx.md` explicitly reactivates them. The rendering-preferences plan (`2026-06-19-round1-rendering-preferences.md`) is complete and historical.
- Next useful move: production smoke testing and real-use validation, especially Admin Cabinet Colors batch editing, selected-color rendering fidelity for 2–3 distinct finishes, and the renderings history page.

Current Module 1 guardrails:

- Keep the first-step workflow simple:
  1. Room.
  2. Openings.
  3. Layout.
  4. Appliances.
  5. Adjust Positions.
  6. Rendering Preferences.
- Do not keep a separate `Cabinets` form step in Module 1. `Adjust Positions` owns fixed-position confirmation and rough cabinet fill generation; `Rendering Preferences` owns style/color selection and customer concept rendering.
- Do not add pricing/quote functionality yet; leave it reserved for a later step.
- Keep first-round form questions layout-critical. Oven / microwave belongs in Appliances. Detailed corner cabinet type questions belong in Module 2.
- Do not expose detailed per-cabinet editing, cabinet codes, production-style dimensions, or internal prompt/debug output in the default Round 1 UI.
- Login should remain account/password based. Do not reintroduce email-format login validation. Admin user creation may still collect email as contact/profile data, but the sign-in identifier is `users.account`.
- The current shared UI theme should stay black/white/neutral. Avoid adding blue/purple primary buttons or hardcoded sky-blue action accents unless a future design pass explicitly changes the palette.

Recently completed: the full dated changelog of completed Module 1 work (snapshot + persistence, concept rendering + spatial-prompt/locked-reference accuracy, the optional conversational intake agent + voice STT, rough wall elevations, cooktop-vs-range, layout-shape/island split, oven/microwave arrangement, appliance auto-layout, Rendering Preferences, cabinet color libraries, seed tooling, flow/security hardening, rendering history, and admin performance fixes) now lives in `docs/round1-context-archive.md` under "Module 1 Round 1 — Completed Work Log". The current state of all of it is summarized above in "Current Implementation"; consult the archive only when you need the per-change rationale or history.

Next implementation TODO:

- Recommended next priority: production smoke test the pulled `main` state, then do UI polish from real sales/customer feedback, then open Module 2 detailed measured design as a separate scoped effort.
- Production smoke should cover login/session expiry behavior, project create/open, Round 1 snapshot save/retry, Rendering Preferences, color batch editing, selected swatch fidelity in generated renderings, renderings history, and logout from each main surface.
- For production deploys after 2026-06-23, ensure the account migration has run before smoke testing login. Existing users get non-email account values from their email via `lower(replace(email, '@', '_'))`; new seeded users can set `SEED_ADMIN_ACCOUNT` / `SEED_USER_ACCOUNT`.
- UI adjustment is the second priority: keep it limited to deployment feedback, responsiveness, copy clarity, performance, and workflow friction. Do not add pricing/quote or production-style cabinet editing during this pass.
- Module 2 detailed measured design is third priority and should start only with a separate context/spec. It can cover dimension strings, cabinet codes, production-style views, exact filler placement, and measured cabinet-by-cabinet design.
- No outstanding Module 1 rendering work. The optional conversational Round 1 agent is now implemented; `src/server/llm/` and `POST /api/round1/agent` exist.
- Note: the previously-leaked `OPENAI_API_KEY` has now been rotated (2026-06-18); the old key is invalid and the new key in `.env.local` is working for rendering. See the "Architecture Decision" security note. No further rotation action outstanding.

## Round 2 Visual Prototype

Round 2 is the Studio measured-design workspace at `/projects/[projectId]/round2`, a separate effort from the Round 1 MVP above. Its full task tracker lives in `todo.md` at repo root.

Architecture decision (2026-07-02): Round 2 is driven by a single deterministic model, not hardcoded fixtures. Previously measurement/proposal/drawings each carried their own hardcoded U-shape data (`ROUND2_MEASUREMENT_FIXTURE`, `ROUND2_CABINET_FIXTURE`, and a third inline set in `drawing-sheet.tsx`), so the workspace ignored the locked Round 1 layout and the three views contradicted each other. That is now replaced by:

- One `Round2Model` (`src/features/round2/model/round2-model.ts`): walls with 1/16″-integer segments (`cabinet | filler | appliance | opening | gap`).
- Walls are derived from the locked Round 1 `floorPlan` topology only, never by treating its canvas pixels as inches — `deriveWallsFromRound1` (`src/features/round2/model/derive-walls.ts`) reads each shape's `wall` field (TOP/LEFT/RIGHT/BOTTOM) and the fixed points (window/door/markers/appliance intent), keeping wall count, naming (A/B/C…), and relative order. All real dimensions come from Round 2 field measurement.
- Cabinet standards are one shared config (`src/features/round2/model/cabinet-standards.ts`, phase 6): a frozen `CABINET_STANDARDS` constant with a same-shape Zod schema covering base/upper widths and heights, the door rule (single ≤21″ / double ≥24″), filler min/preferred, corner (lazy Susan / blind base) dims, customer appliance widths, and cabinet depths. `autofill.ts`, the `STEP_CABINET_WIDTH` tiers, and `SET_SEGMENT_KIND` all read it — there is no second literal for a cabinet width, door rule, or appliance width anywhere. Decision: no DB table yet (low-churn versioned config belongs in git); the same schema can be lifted to a DB table + admin page when multi-brand/non-dev edits appear.
- Rule-driven autofill (`src/features/round2/model/autofill.ts`, phase 8) solves each wall by partition, not greedy fill. Corners resolve first (`model/corners.ts` derives the shared TL/TR/BR/BL topology): a lazy Susan / blind base / dead corner consumes width on **both** walls before either run is filled, and the corner cabinet is a first-class segment (`cabinetKind: "corner"`) numbered into the schedule. Then fixed points anchor (sink centers under the measured window, range follows the gas marker, fridge hugs a wall end, dishwasher docks against the sink, doors block the base run); zones between anchors pack the fewest wide cabinets with the filler pushed to the corner side / wall end, and a sub-preferred sliver first tries stepping a neighbor down a width tier before raising a decision. The upper tier is **projected from the base tier** (hood matches the range width, seam alignment, window/door carve-outs; tall units incl. the refrigerator leave a gap above — the fridge is one full-height unit, no separate deep upper) rather than filled independently, and `Round2Model.heightProfile` derives the upper-height tier from the measured ceiling. Sub-threshold fillers still emit decision items (same Confirmation Required philosophy as Round 1). Geometry stays in code; AI does not place cabinets or set dimensions.
- Phase 7 design intent (`src/features/round2/model/design-intent.ts`, 2026-07-06) is collected at the end of Field Measurement, before autofill. Questions and defaults are derived from the same locked topology and measurements: 0/1/2 corner-strategy questions for galley/L/U, ceiling-aware upper termination and flat moulding, tall location, sink-side trash pullout, drawer/door balance, hood form, hardware, plus sink/window alignment only when both fixed points share a wall. `Round2DesignIntent` stores answers and explicitly confirmed keys; defaults never block submission, while every skipped key becomes a deterministic `Confirmation required` decision after autofill. Changing intent after submit marks proposal/drawings stale, and replacing the Round 1 reference resets it.
- Adjustment is constrained, not free drag: `STEP_CABINET_WIDTH` / `NUDGE_GROUP` / `MOVE_FILLER_END` / `SET_SEGMENT_KIND` / `SET_SEGMENT_FRONT` / `SET_HEIGHT_PROFILE` in `round2-state.ts`, with same-wall fillers absorbing any delta so the dimension chain always equals the wall length. The old free-offset `SET_CABINET_OFFSET`/`cabinetOffsets` and the sink-only `SET_SINK_WIDTH` are gone.
- Phase 9 makes the elevation the primary editor (`proposal/wall-elevation.tsx`), with the top view demoted to a read-only depth-true minimap (`proposal/design-plan.tsx`) that only navigates selection. The width chain **is** the input: clicking a chain label opens an inline editor mapping to the existing constrained actions — `STEP_CABINET_WIDTH` now accepts any positive 1/16″ (not just standard tiers) for custom widths, still absorbed by same-wall fillers, so there are **no new geometry actions**. `SET_HEIGHT_PROFILE` edits the global height chain (`Round2Model.heightProfile { counter, backsplash, upperHeight, moulding }`); one change re-renders every elevation and A-sheet vertically (rendering scales from the profile, not hardcoded Y coordinates) and raises a blocking decision when Σ exceeds the measured ceiling. `WallSegment.front` stores only door/drawer/hardware/accessory **exceptions**; `model/front.ts` `resolveSegmentFront` is the single derivation boundary (door rule + autofill's DB/WB/LS tags + design intent give the defaults). Dimension labels stagger onto leader lanes via the shared `model/dimension-lanes.ts` so narrow neighbors never collide.
- Appliance identity rendering (2026-07-07): `model/segment-role.ts` resolves each segment's semantic role (sink / dishwasher / range / fridge / oven / microwave / hood / fridgeUpper) from the Round 1 fixed point it was reserved for (`sourceFixedPointId` → `symbol`), with the `CABINET_STANDARDS` label prefix (SB/DW/RNG/REF, HD/WR uppers) as fallback for segments that lost their fixed point. `appliance-glyphs.tsx` draws shared SVG line-work fronts (fridge split doors + handles, range knobs + oven window, DW control strip, sink faucet + rim over the door face, hood insert strip, and a divided-light window with a mullion grid — column/row counts derived so panes stay ~square — matching the standard elevation) used by **both** the workspace elevation (`proposal/wall-elevation.tsx`) and the A-sheets (`drawings/drawing-sheet.tsx`); both also print a muted role tag (SINK/DW/RANGE/FRIDGE/HOOD/REF UPPER) under the cabinet number, and pure appliance boxes no longer get the generic door-X face (the sink base keeps its doors). Rendering-only — roles never feed geometry. Tall units (fridge, oven/pantry towers) also carry their own overall height dimension (counter + backsplash + upper, drawn inside the column) since they have no counter/upper split — `data-elevation-layer="tall-height"` in the workspace, `data-drawing-layer="tall-height"` on the A-sheet; both drawn after the cabinet boxes so they're not painted over.
- Drawings (`drawings/drawing-sheet.tsx`, `cabinet-schedule.tsx`) are projections of the same model: A1 plan, one elevation sheet per participating wall (so a galley yields 2, not a fixed A2–A4), and an S1 schedule including filler rows plus a FRONT column from `resolveSegmentFront`. Elevation sheets render vertically from the same `heightProfile` and stagger dimension labels through the same `dimension-lanes.ts`, so the drawings match the proposal elevation exactly. `LOCK_REFERENCE`/`REPLACE_REFERENCE` carry the full `Round1ReferenceSource` and derive at lock time.

Status: `todo.md` first-round stages 0–5 and second-round stages 6–9 are complete. Phase 9 verification on 2026-07-06: `npm test` 561 passing / 1 skipped, `npx tsc --noEmit` clean, and `npm run build` succeeds. Stage 10 is mostly done: a live browser QA on 2026-07-06 against the seeded U-shape project (`test7.1`, already locked + submitted) exercised the Phase 8/9 surfaces on a running dev server — elevation-primary editing, the read-only top-view projection with per-wall totals, the global height chain (stepping uppers to 42″ pushed Σ to 99″/96″, raised the blocking "exceeds the ceiling" decision, and grew the elevation upper band from y=58.5 to y=42), Phase 8 corners/anchors/hood/window-carve, front editing (3 drawers rendering drawer lines in both the proposal elevation and the S1 FRONT column and matching the A2 sheet), all console- and server-error-free. Remaining: the from-scratch lock → measure → intent → submit walk and the galley / L layouts still need their own seeded projects, so those stay user-side acceptance steps (the U-shape output/editing is verified).

Round 2 stays out of the Round 1 product boundary: Round 1 remains coarse and `salesEstimateOnly`; precise dimensions, fillers, and cabinet-by-cabinet layout exist only in Round 2.

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

- Platform UI controls should follow the current black/white/neutral theme. Shared `Button` primary, focus rings, and `uiverse-fill-button` are intentionally black/white now. Keep buttons visually consistent across pages unless a scoped feature has a clear reason to differ.
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

These same three checks run automatically in CI (`.github/workflows/ci.yml`) on every push to `main` and every PR, so the verification loop is enforced, not just convention. `GET /api/health` is an unauthenticated liveness probe for the deploy platform (process-up only; it does not check the DB — see the route comment for the readiness upgrade).

For layout/UI changes, also do browser QA at:

```text
http://127.0.0.1:3000/
```

For auth/account changes, browser QA should include `/login` while signed out and verify the account field accepts a non-email identifier.

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
