# Round 2 Phase 7 Design Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topology-aware design-intent questions to field measurement, preserve defaults without blocking submission, and surface every unconfirmed default as a proposal decision.

**Architecture:** A focused `design-intent.ts` domain module owns intent values, confirmation state, topology-derived questions, and confirmation decision items. Round 2 state initializes and edits that intent, then passes it into autofill; the measurement workspace renders the derived questions after measurement fields.

**Tech Stack:** TypeScript, React 19, Next.js 15, Vitest, server-rendered component tests.

---

### Task 1: Design-intent domain model

**Files:**
- Create: `src/features/round2/model/design-intent.ts`
- Create: `src/features/round2/model/design-intent.test.ts`
- Modify: `src/features/round2/round2-types.ts`

- [ ] **Step 1: Write failing topology and default tests**

Add tests that derive zero corner questions for GALLEY, one for L shape, two for U shape, include sink/window alignment only when a wall has a window, and produce a complete default answer for every derived question.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/features/round2/model/design-intent.test.ts`

Expected: FAIL because `design-intent.ts` does not exist.

- [ ] **Step 3: Implement the minimal domain module**

Define `Round2DesignIntent`, `DesignIntentKey`, `DesignIntentValue`, question/option types, `initializeDesignIntent(model)`, `buildDesignIntentQuestions(model, measurements)`, `setDesignIntentAnswer(intent, key, value)`, and `buildIntentConfirmationDecisions(model, intent, measurements)`.

Corner identity is based on source-wall adjacency (`TOP+LEFT`, `TOP+RIGHT`, `BOTTOM+LEFT`, `BOTTOM+RIGHT`), so GALLEY has no corner, L has one, and U has two. Global defaults are: standard-height uppers, preferred 3-inch flat moulding, automatic tall placement, sink-side trash pullout, balanced drawer/door mix, cabinet-insert hood, and handles.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run src/features/round2/model/design-intent.test.ts`

Expected: all tests pass.

### Task 2: State and autofill integration

**Files:**
- Modify: `src/features/round2/model/autofill.ts`
- Modify: `src/features/round2/round2-state.ts`
- Modify: `src/features/round2/round2-state.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Assert that locking initializes defaults with no confirmed keys, selecting a chip confirms only that key, replacement resets intent, submission remains allowed with skipped questions, and skipped defaults append confirmation decisions that set `proposalStatus` to `NEEDS_DECISION`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run src/features/round2/round2-state.test.ts`

Expected: FAIL because state has no `designIntent` and no `SET_DESIGN_INTENT` action.

- [ ] **Step 3: Implement state and autofill wiring**

Add `designIntent` to prototype state, initialize it on lock/replace, handle `SET_DESIGN_INTENT`, pass it to `autofillRound2Model`, and append intent confirmation decisions after existing geometry decisions. Keep the intent argument optional for lower-level autofill callers that are not exercising the workflow.

- [ ] **Step 4: Run state and autofill tests and verify GREEN**

Run: `npx vitest run src/features/round2/round2-state.test.ts src/features/round2/model/autofill.test.ts`

Expected: all tests pass.

### Task 3: Measurement workspace DESIGN INTENT group

**Files:**
- Create: `src/features/round2/measurement/measurement-workspace.test.tsx`
- Modify: `src/features/round2/measurement/measurement-workspace.tsx`

- [ ] **Step 1: Write a failing render test**

Render a locked U-shaped state and assert that the workspace contains `DESIGN INTENT`, two corner-strategy prompts, ceiling-aware upper wording, chip choices, and a note that defaults do not block submission.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/features/round2/measurement/measurement-workspace.test.tsx`

Expected: FAIL because the workspace has no design-intent UI.

- [ ] **Step 3: Render derived questions after measurement fields**

Build questions with `useMemo`, render accessible chip buttons with `aria-pressed`, dispatch `SET_DESIGN_INTENT` on selection, show `DEFAULT · CONFIRM` versus `CONFIRMED`, and keep progress/submission completeness based only on required measurements.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/features/round2/measurement/measurement-workspace.test.tsx`

Expected: all tests pass.

### Task 4: Regression updates and verification

**Files:**
- Modify: `src/features/round2/proposal/decision-rail.test.tsx`
- Modify: `todo.md`
- Modify: `ai_ctx.md`

- [ ] **Step 1: Update affected assertions**

Change tests that assumed a skipped-intent submit is immediately `READY` or shows “No filler decisions”; assert confirmation-required behavior instead. Preserve geometry decision coverage.

- [ ] **Step 2: Run Round 2 tests**

Run: `npx vitest run src/features/round2`

Expected: all Round 2 tests pass.

- [ ] **Step 3: Update project documentation**

Mark Phase 7 checklist items complete in `todo.md` and record the intent-domain boundary and confirmation semantics in `ai_ctx.md`.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Expected: all tests pass except the existing skipped eval.

Run: `npx tsc --noEmit`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0.
