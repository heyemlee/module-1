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

Do not remove `referencePerspectiveSvg` from the preview-generation path or UI.

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
