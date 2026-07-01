# Rendering Viewport Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete Round 1 step-04 rendering visible in the initial canvas viewport, then place layout and wall elevations below it in one scroll flow.

**Architecture:** Add a small `Round1RenderingFlow` composition component in `showroom-intake-app.tsx` so the step-specific ordering has a testable boundary. Add a viewport-fit presentation mode to `Round1InlineRenderPreview`; the existing presentation remains the default, while step 04 opts into a full-height frame and contained image.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Vitest, React server rendering

---

### Task 1: Lock the rendering-flow and image-fit contracts with failing tests

**Files:**
- Modify: `src/features/round1/showroom-intake-app.test.tsx`
- Test: `src/features/round1/showroom-intake-app.test.tsx`

- [ ] **Step 1: Add a failing viewport-fit test**

Import `Round1RenderingFlow` from `./showroom-intake-app`, then add:

```tsx
test("fits the complete rendering inside the available viewport", () => {
  const html = renderToStaticMarkup(
    <Round1InlineRenderPreview
      busy={false}
      error={null}
      renderings={[{ id: "r1", url: "render.png", doorColorId: "gr" }]}
      cabinetColors={[{ id: "gr", name: "Graphite" }]}
      styleLabel="European Frameless"
      fitViewport
    />
  );

  expect(html).toContain('data-rendering-fit="viewport"');
  expect(html).toContain("h-full");
  expect(html).toContain("w-full");
  expect(html).toContain("object-contain");
  expect(html).not.toContain("object-cover");
});
```

- [ ] **Step 2: Add a failing flow-order test**

Add:

```tsx
test("orders the rendering, layout, and elevations in one scroll flow", () => {
  const html = renderToStaticMarkup(
    <Round1RenderingFlow
      rendering={<div>Rendering viewport</div>}
      layout={<div>Layout viewport</div>}
      elevations={<div>Elevation strip</div>}
    />
  );

  expect(html).toContain('data-rendering-flow="scroll"');
  expect(html).toContain("overflow-y-auto");
  expect(html.indexOf("Rendering viewport")).toBeLessThan(
    html.indexOf("Layout viewport")
  );
  expect(html.indexOf("Layout viewport")).toBeLessThan(
    html.indexOf("Elevation strip")
  );
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx
```

Expected: FAIL because `fitViewport` and `Round1RenderingFlow` do not exist.

### Task 2: Implement the viewport-fit preview and step-04 flow

**Files:**
- Modify: `src/features/round1/showroom-intake-panels.tsx`
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Test: `src/features/round1/showroom-intake-app.test.tsx`

- [ ] **Step 1: Add viewport-fit presentation to `Round1InlineRenderPreview`**

Add an optional `fitViewport?: boolean` prop. Use `cn` to apply:

```tsx
className={cn(
  "relative z-[3] shrink-0 overflow-hidden rounded-[16px] shadow-[0_22px_50px_-24px_rgba(20,20,26,0.5),0_1px_0_rgba(255,255,255,0.4)_inset]",
  fitViewport ? "h-full w-full" : "mx-[18px] mt-[14px] aspect-video w-auto"
)}
data-rendering-fit={fitViewport ? "viewport" : undefined}
```

For the generated image, switch only the fit class:

```tsx
className={cn(
  "absolute inset-0 h-full w-full",
  fitViewport ? "object-contain" : "object-cover"
)}
```

- [ ] **Step 2: Add the testable step-04 composition**

In `showroom-intake-app.tsx`, import `ReactNode` and add:

```tsx
export function Round1RenderingFlow({
  rendering,
  layout,
  elevations
}: {
  rendering: ReactNode;
  layout: ReactNode;
  elevations?: ReactNode;
}) {
  return (
    <div
      data-rendering-flow="scroll"
      className="relative z-[1] min-h-0 flex-1 overflow-y-auto"
    >
      <div className="flex h-full min-h-[420px] items-center justify-center p-[14px_18px] md:min-h-0">
        {rendering}
      </div>
      <div className="h-[60vh] min-h-[420px] shrink-0 px-[2px] pb-[18px]">
        {layout}
      </div>
      {elevations}
    </div>
  );
}
```

- [ ] **Step 3: Recompose the canvas without changing steps 01–03**

In the rendering-step branch, render:

```tsx
<Round1RenderingFlow
  rendering={
    <Round1InlineRenderPreview
      busy={renderingBusy}
      error={renderingError}
      renderings={renderings}
      cabinetColors={cabinetColors}
      styleLabel={
        CABINET_STYLE_LABELS[renderingPreferencesForForm(form).cabinetStyle]
      }
      fitViewport
    />
  }
  layout={layoutPreviewEl}
  elevations={
    elevationScenes.length > 0 ? (
      <Round1ElevationStrip
        scenes={elevationScenes}
        onOpen={setElevationOpenIndex}
      />
    ) : undefined
  }
/>
```

Keep the existing plan-plus-pinned-elevation composition in the non-rendering branch.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run regression checks**

Run:

```bash
npm test -- src/features/round1/round1-elevations.test.tsx src/features/round1/round1-workspace-shell.test.tsx
npm test
npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/features/round1/showroom-intake-app.test.tsx \
  src/features/round1/showroom-intake-app.tsx \
  src/features/round1/showroom-intake-panels.tsx
git commit -m "fix: fit round1 rendering to viewport"
```

### Task 3: Verify the rendered behavior in the in-app browser

**Files:**
- No committed files

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected: Next.js reports a local development URL.

- [ ] **Step 2: Verify desktop**

Open the Round 1 flow, reach step 04, and verify at the normal desktop viewport:

- the complete rendering is visible before scrolling;
- the source image is not cropped or stretched;
- scrolling reveals layout and then wall elevations;
- steps 01–03 still pin wall elevations at the bottom.

- [ ] **Step 3: Verify a shorter or narrower viewport**

Repeat step 04 with a shorter or narrower viewport. Confirm that the image
remains contained and complete, and record relevant console warnings or errors.

