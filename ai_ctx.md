# AI Context: Module 1 Platform (Round 1 + Round 2)

Date: 2026-07-24  
Scope: Internal cabinet platform — Round 1 concept intake + concept renderings; Round 2 technical design (measure → proposal → drawings).  
Status: Round 1 MVP and Round 2 model-driven workspace are in active use. Cleanup branch `chore/code-cleanup-phase1` removed dead demos/assets/orphaned UI. Follow-ups live in `docs/follow-up-todo.md`.

This is the **hot context** for normal AI sessions.  
Deep history / JSON examples / superseded approaches → `docs/round1-context-archive.md` (only when needed).  
Round 2 feature tracker → root `todo.md`.  
Post-cleanup backlog → `docs/follow-up-todo.md`.

---

## Source Of Truth

- This file = current working context for product boundaries, architecture, and guardrails.
- Do not revive removed planning files or deleted demos (`public/*.html`, old perspective preview, file-backed `ROUND1_DATA_FILE` store).
- Persistence for projects / Round 1 / design basis is **Postgres** (`DATABASE_URL`). There is no live file-backed Round 1 repository.

Module framing:

- **Round 1 (Concept):** showroom intake, rough confirmation, preliminary estimate, non-authoritative concept renderings.
- **Round 2 (Technical Design):** field measurement, deterministic autofill, elevations/drawings from one model.
- Later shopfloor / manufacturing modules stay out of this repo context until separately scoped.

---

## Product Boundary

Round 1 is a **sales-estimate / customer-confirmation** artifact.

It must stay coarse. Do not use Round 1 for production dimensions, exact fillers, or final cabinet-by-cabinet design.

Every Round 1 generated output must preserve:

- `salesEstimateOnly: true`
- `notForProduction: true`
- `dimensionConfidence: "ROUGH"` unless exact measured values are explicitly provided
- `Confirmation Required` for missing / approximate / overridden info

Unknown values must not block Round 1 generation; they become confirmation items.

Round 2 owns precise dimensions, fillers, and cabinet-by-cabinet layout. It starts from a **server-locked design basis** (rendering + snapshot + style/color), not “whatever is latest in memory.”

---

## Tech Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind, Zod, Vitest
- PostgreSQL via `pg`; S3-compatible object storage (`@aws-sdk/client-s3`)
- Optional OpenAI image/vision clients (`sharp` for normalization)
- Pluggable LLM layer for Round 1 agent: `src/server/llm/` + `LLM_PROVIDER=openai|deepseek|anthropic`
- Deploy: Railway-oriented standalone Next build; CI = `tsc` + `vitest` + `next build`

Do not use n8n as the core Round 1/2 workflow engine.

Secrets stay in `.env.local` / Railway Variables — never in chat, commits, or this file.

---

## Architecture

### Round 1 authoritative path

1. Sales fills the showroom form (6 steps: Room → Openings → Layout → Appliances → Adjust Positions → Rendering Preferences).
2. Form → normalize → preliminary cabinets + confirmation items.
3. `buildFloorPlan(...)` builds deterministic SVG geometry.
4. `Generate Cabinet Fill` freezes `buildRound1Snapshot` and persists via Postgres.
5. Concept rendering (optional) uses structured layout references + material swatch; never owns cabinet truth.

### Round 1 → Round 2 handoff

1. Customer-facing lock happens on **Proposal & Confirm** (`/projects/[id]/renderings`).
2. Lock creates append-only **design basis** (`design_basis` + `design-basis-repository.ts`).
3. Round 2 (`/projects/[id]/round2`) adopts that basis (`ADOPT_BASIS`), derives walls from Round 1 **topology only** (never treat floorPlan canvas px as inches).
4. Measurement → design intent → autofill → elevation-primary editing → drawings as projections of one `Round2Model`.

### AI boundary

AI may organize intake, explain confirmations, and generate **non-authoritative** concept images.

AI must not own cabinet dimensions/codes/counts/geometry, mark data production-ready, bypass readiness / `salesEstimateOnly` / `notForProduction`, or silently clear confirmation items.

Deterministic code owns schemas, normalize, cabinet split, readiness, production gate, floor plan / Round 2 geometry, and autofill.

---

## Key Files

### Platform

- `src/server/platform/auth-service.ts` / `auth-repository.ts` / `passwords.ts` — account/password sessions
- `src/server/platform/project-repository.ts` / `types.ts` — projects + status
- `src/server/platform/round1-postgres-repository.ts` — Round 1 state / snapshot / renderings
- `src/server/platform/design-basis-repository.ts` — locked Concept→Technical Design package
- `src/server/platform/cabinet-color-repository.ts` — admin color libraries
- `src/server/platform/rate-limit.ts` / `api-errors.ts` — rate limits + shared API errors
- `src/server/db/schema.sql` + `scripts/migrate.mjs` — schema / migrations
- `src/server/storage/bucket.ts` — object storage adapter

### Round 1

- `src/domain/round1/*` — schemas, normalize, cabinets
- `src/features/round1/snapshot.ts` — authoritative snapshot builder
- `src/features/round1/floorplan/plan-geometry.ts` — deterministic geometry
- `src/features/round1/layout-preview.tsx` (+ `layout-preview-shapes.tsx`) — SVG preview / drag
- `src/features/round1/showroom-intake-app.tsx` — workflow orchestration
- `src/features/round1/showroom-intake-steps.tsx` / `showroom-intake-panels.tsx` / `showroom-intake-controls.tsx` (`Step`, `Panel`, `NumberField`)
- `src/features/round1/rendering-prompt.ts` / `rendering-preferences*.tsx`
- `src/server/round1/rendering-service.ts` / `agent-service.ts`
- `src/server/llm/*` — provider-agnostic agent tools

### Round 2

- `src/features/round2/round2-visual-prototype.tsx` — workspace shell (name is historical)
- `src/features/round2/model/round2-model.ts` — single model
- `src/features/round2/model/derive-walls.ts` — Round 1 topology → walls
- `src/features/round2/model/cabinet-standards.ts` — shared standards (git config, not DB yet)
- `src/features/round2/model/autofill.ts` / `design-intent.ts` / `adjustments.ts` / `front.ts`
- `src/features/round2/proposal/wall-elevation.tsx` — primary editor
- `src/features/round2/drawings/drawing-sheet.tsx` — A/S sheets as projections
- `src/features/round2/handoff/basis-gate.tsx` — empty state when no basis

### Ops scripts

- `scripts/seed-admin.mjs` / `seed-user.mjs` / `promote-owner.mjs`
- `scripts/prepare-cabinet-colors.mjs` / `seed-cabinet-colors.mjs`
- `scripts/migrate-images-to-bucket.mjs` / `report-image-storage.mjs`

---

## Current Guardrails

Round 1 UI:

1. Room → 2. Openings → 3. Layout → 4. Appliances → 5. Adjust Positions → 6. Rendering Preferences  
No separate Cabinets step; no pricing/quote; no per-cabinet production editing in default UI.

Login is **account** + password (`users.account`), not email-format validation.

UI theme stays black/white/neutral unless an explicit design pass changes it.

Round 2:

- One model drives measurement / proposal / drawings.
- Adjustment is constrained (fillers absorb deltas); no free-drag furniture placement.
- Blocking decisions gate Drawings.
- Prototype Round 2 draft is still largely client-side; server persistence is follow-up (see `docs/follow-up-todo.md`).

Security / ops:

- Prefer Postgres + bucket paths already in code; do not reintroduce file-backed Round 1 stores.
- Keep CSP / rate limits / TLS helpers intact when touching infra.
- Never commit secrets.

---

## Cabinet & Form Rules (Round 1)

- Width / depth / height fields only — not `L x W x H`.
- Codes: `W|B|T` + width + depth + height (e.g. `W301236`, `B302435` with `actualHeight: 34.5` / `codeHeight: 35`).
- Auto-split priority: `36, 33, 30, 27, 24, 21, 18, 15, 12, 9`.
- Remainder ≤3″ ≈ filler allowance; above that → Confirmation Required.
- Status-first conditionals: `YES` / `NO` / `UNKNOWN` are distinct.
- Customer-facing placement language stays friendly; internal enums (`BACK_SIDE`, …) stay internal.
- Corner cabinet **type** selection belongs in Round 2 / detailed design; Round 1 may show generic corner masses.

---

## Output Visual Rules (Round 1 plan)

- Clean top-down line art; black/gray on white; approximate positions only.
- No production dimension strings or cabinet codes on the default customer plan.
- Print should produce a clean standalone SVG.
- Renderer constants + tests are the style source of truth.

Concept renderings may be photorealistic **customer previews only** — never authoritative.

---

## Verification

```bash
npx tsc --noEmit
npm test
npm run build
```

CI runs the same three on `main` / PRs (`.github/workflows/ci.yml`).  
`GET /api/health` = process liveness only (not DB readiness).

For UI changes, browser QA at `http://127.0.0.1:3000/` (login, projects, Round 1, renderings lock, Round 2).

Latest automated baseline after cleanup (2026-07-24): `tsc` clean, `npm test` **760 passed / 1 skipped**, `npm run build` OK.

---

## Where To Look Next

| Need | File |
|------|------|
| Cleanup leftovers & optional refactors | `docs/follow-up-todo.md` |
| Round 2 unfinished QA / M3 / deferred features | `todo.md` |
| Deploy / Railway env notes | `docs/deployment/railway-internal-platform.md` |
| Manual launch test plan | `docs/launch-manual-test-plan.md` |
| Agent dialogue scenarios | `docs/test-dialogues.md` |
| Old Round 1 implementation diary | `docs/round1-context-archive.md` |

Do not let archive or historical plan files override this hot context unless the user explicitly says the archive is newer.
