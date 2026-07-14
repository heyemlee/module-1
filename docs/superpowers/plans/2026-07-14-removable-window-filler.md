# Removable Window Filler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let designers convert a filler beside a window into intentional open space without moving or resizing adjacent cabinets, with one-click restoration.

**Architecture:** Keep the existing segment model and proposal reducer. Add pure model adjustments that preserve segment order and width while toggling a reversible marker between `filler` and `gap`; expose those adjustments through prototype actions and the existing segment editor card. Preserve intentional gaps during autofill regeneration.

**Tech Stack:** TypeScript, React, Next.js, Vitest, Testing Library, existing Tailwind utility classes.

## Global Constraints

- Removing a filler preserves its measured width, index, tier, wall, and adjacent cabinet geometry.
- The action is reversible through `Restore filler`.
- Intentional gaps must survive autofill regeneration.
- Use existing UI patterns and no new dependencies.

---

### Task 1: Add reversible segment adjustments

**Files:**
- Modify: `src/features/round2/model/adjustments.ts`
- Test: `src/features/round2/model/adjustments.test.ts`

**Interfaces:**
- Produce `removeFiller(model: Round2Model, segmentId: string): Round2Model` and `restoreFiller(model: Round2Model, segmentId: string): Round2Model`.
- Preserve all segment fields except `kind` and a reversible marker; no-op for unsupported segments.

- [ ] **Step 1: Write failing tests** for filler-to-gap conversion, restoration, width/order preservation, and no-op behavior.
- [ ] **Step 2: Run** `npm test -- --run src/features/round2/model/adjustments.test.ts` and confirm the new tests fail.
- [ ] **Step 3: Implement** the pure helpers using the existing `findSegmentContext`, `replaceWallSegments`, and `updateModelDecisions` utilities.
- [ ] **Step 4: Update autofill** so a gap carrying the intentional-restoration marker remains a gap and is not reinterpreted as unresolved filler space.
- [ ] **Step 5: Run** the focused test file and confirm PASS.
- [ ] **Step 6: Commit** with `git add src/features/round2/model/adjustments.ts src/features/round2/model/adjustments.test.ts src/features/round2/model/autofill.ts && git commit -m "feat: preserve removable filler gaps"`.

### Task 2: Thread actions through proposal state

**Files:**
- Modify: `src/features/round2/round2-types.ts`
- Modify: `src/features/round2/round2-state.ts`
- Test: `src/features/round2/round2-state.test.ts`

**Interfaces:**
- Add `REMOVE_FILLER` and `RESTORE_FILLER` prototype actions with `objectId: string`.
- Reducer dispatches each through `applyProposalAdjustment` and keeps selection on the same object.

- [ ] **Step 1: Add failing reducer tests** that dispatch both actions and assert the selected segment keeps its id and width while toggling kind.
- [ ] **Step 2: Run** `npm test -- --run src/features/round2/round2-state.test.ts` and confirm failure from missing action cases.
- [ ] **Step 3: Add the action union members and reducer cases** importing the two model helpers.
- [ ] **Step 4: Run** the focused state tests and confirm PASS.
- [ ] **Step 5: Commit** with `git add src/features/round2/round2-types.ts src/features/round2/round2-state.ts src/features/round2/round2-state.test.ts && git commit -m "feat: add filler removal proposal actions"`.

### Task 3: Add editor controls and visual state

**Files:**
- Modify: `src/features/round2/proposal/wall-elevation.tsx`
- Test: `src/features/round2/proposal/wall-elevation.test.tsx`

**Interfaces:**
- Filler editor shows `Remove filler` and explanatory copy.
- Intentional gap editor shows `Restore filler` and `OPEN GAP` status.

- [ ] **Step 1: Add failing component tests** selecting a filler, asserting remove copy/button, clicking it, then asserting restore copy/button.
- [ ] **Step 2: Run** `npm test -- --run src/features/round2/proposal/wall-elevation.test.tsx` and confirm failure.
- [ ] **Step 3: Add the buttons** in `SegmentEditorCard`, dispatching the new actions and retaining the existing placement controls for ordinary fillers.
- [ ] **Step 4: Add an intentional-gap visual treatment** in the segment SVG branch: preserve the segment width and dimension label, but use open white space with a dashed neutral boundary and `OPEN GAP` metadata.
- [ ] **Step 5: Run focused component tests and confirm PASS.**
- [ ] **Step 6: Commit** with `git add src/features/round2/proposal/wall-elevation.tsx src/features/round2/proposal/wall-elevation.test.tsx && git commit -m "feat: let designers remove window fillers"`.

### Task 4: Full verification and browser QA

**Files:**
- No committed files unless a test needs a small correction.

- [ ] **Step 1: Run** `npm test -- --run src/features/round2` and confirm all Round 2 tests pass.
- [ ] **Step 2: Run** the project typecheck/build command from `package.json` and confirm no TypeScript or build errors.
- [ ] **Step 3: Validate** `http://localhost:3000/projects/dc9a2015-9344-4061-b782-57ee4a7a88fe/round2` in the available browser path: page identity, meaningful DOM, no framework overlay, console health, screenshot, select filler, remove it, verify unchanged open-space width, restore it.
- [ ] **Step 4: Record** any remaining limitation in the final QA response.
