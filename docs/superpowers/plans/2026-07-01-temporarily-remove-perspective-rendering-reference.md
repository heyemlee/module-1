# Temporarily Remove Perspective Rendering Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop sending the Round 1 perspective structure image to concept rendering while retaining the perspective preview in the UI.

**Architecture:** Narrow the client request payload to the top-down plan plus the optional material swatch. Align API validation and deterministic reference ordering with that payload; the generic rasterizer and perspective preview remain unchanged.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Vitest

---

### Task 1: Accept top-down-only rendering requests

**Files:**
- Modify: `src/app/api/projects/[projectId]/round1/renderings/route.test.ts`
- Modify: `src/app/api/projects/[projectId]/round1/renderings/route.ts`

- [ ] **Step 1: Write the failing route tests**

Change the `request()` fixture payload to:

```ts
referenceImages: [
  { role: "TOP_DOWN_PLAN", imageBase64: "plan" }
]
```

Change the concept-generation assertion to:

```ts
expect(mocks.generateRound1Rendering).toHaveBeenCalledWith(
  expect.objectContaining({
    referenceImagesBase64: ["plan"],
    renderingPreferences: {
      cabinetStyle: "EUROPEAN_FRAMELESS",
      color: europeanOak
    }
  })
);
```

Add a focused validation test:

```ts
test("rejects a request without the required top-down plan", async () => {
  const response = await POST(
    new Request("http://localhost/api/projects/project-1/round1/renderings", {
      method: "POST",
      body: JSON.stringify({
        referenceImages: [
          { role: "PERSPECTIVE_STRUCTURE", imageBase64: "persp" }
        ]
      })
    }),
    { params: Promise.resolve({ projectId: "project-1" }) }
  );
  const json = await response.json();

  expect(response.status).toBe(400);
  expect(json.error).toBe("Missing required spatial reference (top-down plan)");
  expect(mocks.generateRound1Rendering).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run:

```bash
npx vitest run 'src/app/api/projects/[projectId]/round1/renderings/route.test.ts'
```

Expected: FAIL because the route still requires `PERSPECTIVE_STRUCTURE` and still uses the old validation message.

- [ ] **Step 3: Implement minimal API validation and ordering**

Replace the spatial-reference validation with:

```ts
const roles = new Set(input.referenceImages.map((r) => r.role));
if (!roles.has("TOP_DOWN_PLAN")) {
  return NextResponse.json(
    { error: "Missing required spatial reference (top-down plan)" },
    { status: 400 }
  );
}
```

Keep duplicate-role validation unchanged and change the ordering list to:

```ts
const roleOrder = [
  "TOP_DOWN_PLAN",
  "MATERIAL_SWATCH"
] as const;
```

- [ ] **Step 4: Run the route tests**

Run:

```bash
npx vitest run 'src/app/api/projects/[projectId]/round1/renderings/route.test.ts'
```

Expected: all tests in the file PASS.

- [ ] **Step 5: Commit the API change**

```bash
git add 'src/app/api/projects/[projectId]/round1/renderings/route.ts' \
  'src/app/api/projects/[projectId]/round1/renderings/route.test.ts'
git commit -m "fix(round1): stop requiring perspective render reference"
```

### Task 2: Stop rasterizing and sending the perspective reference

**Files:**
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Test: `src/features/round1/rendering-references.test.ts`

- [ ] **Step 1: Confirm the existing top-down-only rasterization contract**

Run:

```bash
npx vitest run src/features/round1/rendering-references.test.ts
```

Expected: PASS, including `rasterizes the top-down reference when it is the only available SVG`.

- [ ] **Step 2: Narrow the client reference list**

Replace the spatial-reference block in `handleGenerateRendering` with:

```ts
// Elevations and the perspective structure remain human-facing previews only.
// Temporarily send just the deterministic top-down plan to the image model so
// the perspective projection cannot pull the generated render off-plan.
const referenceImagesBase64 = await rasterizeRenderingReferences([
  { role: "TOP_DOWN_PLAN", svg: referenceTopDownSvg }
]);
```

The perspective preview remains connected until Task 3 removes the complete
frontend path.

- [ ] **Step 3: Run focused rendering tests**

Run:

```bash
npx vitest run \
  src/features/round1/rendering-references.test.ts \
  'src/app/api/projects/[projectId]/round1/renderings/route.test.ts' \
  src/server/round1/rendering-service.test.ts \
  src/infrastructure/image/openai-rest-image-client.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 4: Run the full test suite and type/build check**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and the production build completes without TypeScript errors.

- [ ] **Step 5: Commit the client change**

```bash
git add src/features/round1/showroom-intake-app.tsx
git commit -m "fix(round1): omit perspective from rendering inputs"
```

### Task 3: Remove the perspective feature from the active Round 1 frontend

**Files:**
- Create: `src/features/round1/perspective-cleanup.test.ts`
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-panels.tsx`
- Modify: `src/features/round1/round1-elevations.test.tsx`

- [ ] **Step 1: Add a failing architectural cleanup test**

Create `src/features/round1/perspective-cleanup.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appSource = readFileSync(
  new URL("./showroom-intake-app.tsx", import.meta.url),
  "utf8"
);
const panelSource = readFileSync(
  new URL("./showroom-intake-panels.tsx", import.meta.url),
  "utf8"
);

describe("Round 1 perspective frontend cleanup", () => {
  test("does not connect perspective UI or hidden reference generation", () => {
    expect(appSource).not.toMatch(
      /PerspectivePreview|referencePerspectiveRef|referencePerspectiveSvg|perspectiveOpen|perspectiveThumb|perspectiveLightbox/
    );
    expect(panelSource).not.toContain("Round1PerspectiveLightbox");
  });
});
```

- [ ] **Step 2: Run the cleanup test to verify it fails**

Run:

```bash
npx vitest run src/features/round1/perspective-cleanup.test.ts
```

Expected: FAIL because the Round 1 app still imports and renders
`PerspectivePreview`, and the panels module still exports
`Round1PerspectiveLightbox`.

- [ ] **Step 3: Remove perspective wiring from the Round 1 app**

In `src/features/round1/showroom-intake-app.tsx`:

- Remove the `PerspectivePreview` import.
- Remove `Round1PerspectiveLightbox` from the panel imports.
- Remove `perspectiveOpen` state.
- Remove `referencePerspectiveRef`.
- Remove `referencePerspectiveSvg` and its rendering-gate condition from
  `handleGenerateRendering`.
- Remove the `perspectiveThumb` block.
- Stop passing `leading={perspectiveThumb}` to both `Round1ElevationStrip`
  instances.
- Remove the `perspectiveLightbox` block and its render site.
- Remove the hidden `PerspectivePreview`; keep the hidden `LayoutPreview`
  connected to `referenceTopDownRef`.

The rendering gate must become:

```ts
const referenceTopDownSvg = referenceTopDownRef.current;
if (
  !referenceTopDownSvg ||
  !projectId ||
  !snapshot ||
  !canRenderConcept ||
  !form.renderingPreferences ||
  !cabinetColors.length
) {
  return;
}
```

- [ ] **Step 4: Remove the unused perspective lightbox**

Delete the complete `Round1PerspectiveLightbox` export from
`src/features/round1/showroom-intake-panels.tsx`.

In `src/features/round1/round1-elevations.test.tsx`, remove
`Round1PerspectiveLightbox` from the import and delete the
`describe("Round1PerspectiveLightbox", ...)` test block. Keep
`Round1ElevationStrip`'s generic `leading` prop and tests because that API is
not perspective-specific.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run \
  src/features/round1/perspective-cleanup.test.ts \
  src/features/round1/round1-elevations.test.tsx \
  src/features/round1/showroom-intake-app.test.tsx \
  src/features/round1/rendering-references.test.ts \
  'src/app/api/projects/[projectId]/round1/renderings/route.test.ts'
```

Expected: all focused tests PASS.

- [ ] **Step 6: Run production verification**

Run:

```bash
npm run build
npm test
```

Expected: the production build passes. The full suite should match the current
baseline: all tests pass except the previously acknowledged unrelated
`spatial-language.test.ts` appliance-order assertion.

- [ ] **Step 7: Commit the cleanup**

```bash
git add \
  src/features/round1/perspective-cleanup.test.ts \
  src/features/round1/showroom-intake-app.tsx \
  src/features/round1/showroom-intake-panels.tsx \
  src/features/round1/round1-elevations.test.tsx \
  docs/superpowers/plans/2026-07-01-temporarily-remove-perspective-rendering-reference.md
git commit -m "refactor(round1): remove perspective frontend"
```
