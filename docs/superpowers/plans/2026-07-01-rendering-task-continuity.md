# Rendering Task Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a concept-rendering request and its visible status alive across authenticated in-app route navigation.

**Architecture:** Add a testable in-memory task manager and a client provider mounted in the persistent `(app)` layout. Round 1 prepares the image inputs but delegates the state-save and long-running rendering requests to the provider, then consumes the provider's project-scoped task result.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest

---

### Task 1: Build the project-scoped rendering task manager

**Files:**
- Create: `src/features/platform/rendering-task-manager.ts`
- Create: `src/features/platform/rendering-task-manager.test.ts`

- [ ] **Step 1: Write failing manager tests**

Create tests covering:

```ts
test("retains running and successful task state outside the calling component", async () => {
  let finish!: (value: { id: string }) => void;
  const execute = vi.fn(
    () => new Promise<{ id: string }>((resolve) => { finish = resolve; })
  );
  const manager = createRenderingTaskManager(execute);
  const input = {
    projectId: "project-1",
    projectName: "Kitchen",
    stateBody: {},
    renderingBody: {}
  };

  const promise = manager.start(input);
  expect(manager.getTask("project-1")?.status).toBe("running");

  finish({ id: "render-1" });
  await promise;

  expect(manager.getTask("project-1")).toMatchObject({
    status: "succeeded",
    result: { id: "render-1" }
  });
});

test("deduplicates starts while the same project is running", async () => {
  let finish!: (value: { id: string }) => void;
  const execute = vi.fn(
    () => new Promise<{ id: string }>((resolve) => { finish = resolve; })
  );
  const manager = createRenderingTaskManager(execute);
  const input = {
    projectId: "project-1",
    projectName: "Kitchen",
    stateBody: {},
    renderingBody: {}
  };

  const first = manager.start(input);
  const second = manager.start(input);
  expect(first).toBe(second);
  expect(execute).toHaveBeenCalledTimes(1);

  finish({ id: "render-1" });
  await first;
});

test("stores failures and allows a retry", async () => {
  const execute = vi
    .fn()
    .mockRejectedValueOnce(new Error("generation failed"))
    .mockResolvedValueOnce({ id: "render-2" });
  const manager = createRenderingTaskManager(execute);
  const input = {
    projectId: "project-1",
    projectName: "Kitchen",
    stateBody: {},
    renderingBody: {}
  };

  await manager.start(input);
  expect(manager.getTask("project-1")).toMatchObject({
    status: "failed",
    error: "generation failed"
  });

  await manager.start(input);
  expect(execute).toHaveBeenCalledTimes(2);
  expect(manager.getTask("project-1")?.status).toBe("succeeded");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/features/platform/rendering-task-manager.test.ts
```

Expected: FAIL because `createRenderingTaskManager` does not exist.

- [ ] **Step 3: Implement the minimal manager**

Implement these public types and methods:

```ts
export type RenderingTaskInput = {
  projectId: string;
  projectName: string;
  stateBody: unknown;
  renderingBody: unknown;
};

export type RenderingTaskResult = { id: string } & Record<string, unknown>;

export type RenderingTask = {
  projectId: string;
  projectName: string;
  status: "running" | "succeeded" | "failed";
  result?: RenderingTaskResult;
  error?: string;
};

export function createRenderingTaskManager(
  execute: (input: RenderingTaskInput) => Promise<RenderingTaskResult>,
  onSettled?: (task: RenderingTask) => void
) {
  // Keep a Map snapshot, a listener Set, and an in-flight Promise Map.
  // start() reuses an in-flight promise for the same project, catches failures
  // into task state, emits immutable snapshots, and permits retry after settle.
  // Expose start, getTask, getSnapshot, subscribe, and dismiss.
}
```

`start()` must never reject; it records an error task and resolves with that
task. This prevents an unhandled rejection after the originating page unmounts.

- [ ] **Step 4: Run manager tests**

Run:

```bash
npx vitest run src/features/platform/rendering-task-manager.test.ts
```

Expected: all manager tests PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/platform/rendering-task-manager.ts \
  src/features/platform/rendering-task-manager.test.ts
git commit -m "feat(rendering): add persistent task manager"
```

### Task 2: Add the authenticated-layout provider and global status notice

**Files:**
- Create: `src/features/platform/rendering-task-provider.tsx`
- Create: `src/features/platform/rendering-task-provider.test.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/layout.test.ts`

- [ ] **Step 1: Write failing request and notice tests**

Test the exported `executeRenderingTask` with a mocked fetch function:

```ts
test("saves state before starting the rendering request", async () => {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    calls.push(url);
    return new Response(
      url.endsWith("/state")
        ? null
        : JSON.stringify({ id: "render-1", imageBase64: "png" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  const result = await executeRenderingTask(
    {
      projectId: "project-1",
      projectName: "Kitchen",
      stateBody: { showroomForm: {} },
      renderingBody: { referenceImages: [] }
    },
    fetchImpl
  );

  expect(calls).toEqual([
    "/api/projects/project-1/round1/state",
    "/api/projects/project-1/round1/renderings"
  ]);
  expect(result.id).toBe("render-1");
});
```

Also render `RenderingTaskNotice` to static markup and assert:

```ts
expect(runningHtml).toContain("Rendering Kitchen");
expect(successHtml).toContain("/projects/project-1/renderings");
expect(failedHtml).toContain("generation failed");
```

Add `layout.test.ts` as an architectural guard:

```ts
const source = readFileSync("src/app/(app)/layout.tsx", "utf8");
expect(source).toContain("<RenderingTaskProvider>");
expect(source).toContain("</RenderingTaskProvider>");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run \
  src/features/platform/rendering-task-provider.test.tsx \
  'src/app/(app)/layout.test.ts'
```

Expected: FAIL because the provider, request executor, notice, and layout
wrapper do not exist.

- [ ] **Step 3: Implement the provider**

`RenderingTaskProvider` must:

- create one manager for the provider lifetime;
- execute `PUT /state` followed by `POST /renderings`;
- use the existing 120-second timeout on the rendering request;
- expose `startRendering`, `getTask`, and project-scoped subscription through
  `useRenderingTask(projectId)`;
- call `router.refresh()` when a task settles successfully;
- render `RenderingTaskNotice` for running, succeeded, and failed tasks;
- prevent notice clicks from starting or cancelling requests;
- support dismissing settled notices, but not running ones.

Error parsing must preserve the current priority:

```ts
detail?.reason || detail?.error || `Request failed (${response.status})`
```

- [ ] **Step 4: Mount the provider in the persistent layout**

Wrap the authenticated shell in `src/app/(app)/layout.tsx`:

```tsx
return (
  <RenderingTaskProvider>
    <div>{/* existing authenticated shell */}</div>
  </RenderingTaskProvider>
);
```

- [ ] **Step 5: Run provider and layout tests**

Run:

```bash
npx vitest run \
  src/features/platform/rendering-task-manager.test.ts \
  src/features/platform/rendering-task-provider.test.tsx \
  'src/app/(app)/layout.test.ts'
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  src/features/platform/rendering-task-provider.tsx \
  src/features/platform/rendering-task-provider.test.tsx \
  'src/app/(app)/layout.tsx' \
  'src/app/(app)/layout.test.ts'
git commit -m "feat(rendering): keep tasks alive across navigation"
```

### Task 3: Delegate Round 1 rendering to the global task

**Files:**
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-app.test.tsx`

- [ ] **Step 1: Write failing integration-helper tests**

Export and test a pure result mapper:

```ts
test("maps a completed global task result into a concept rendering", () => {
  const snapshot = buildFixtureSnapshot();
  const result = conceptRenderingFromTaskResult(
    {
      id: "render-1",
      imageBase64: "png",
      basedOnSnapshotGeneratedAt: snapshot.generatedAt,
      basedOnRenderingPreferences: null
    },
    snapshot
  );

  expect(result).toMatchObject({
    id: "render-1",
    url: "data:image/png;base64,png",
    basedOnSnapshotFingerprint: snapshotRenderingFingerprint(snapshot)
  });
});
```

Add a source guard proving the long-running request moved out:

```ts
const appSource = readFileSync(
  "src/features/round1/showroom-intake-app.tsx",
  "utf8"
);
expect(appSource).toContain("useRenderingTask(projectId)");
expect(appSource).not.toContain(
  "`/api/projects/${projectId}/round1/renderings`"
);
```

- [ ] **Step 2: Run the Round 1 tests to verify they fail**

Run:

```bash
npx vitest run src/features/round1/showroom-intake-app.test.tsx
```

Expected: FAIL because Round 1 still owns the request and the result mapper does
not exist.

- [ ] **Step 3: Integrate the provider**

In `ShowroomIntakeApp`:

- replace local long-running request ownership with `useRenderingTask(projectId)`;
- retain a short-lived local `preparingRendering` state for reference
  rasterization only;
- pass the current state body and `{ referenceImages }` to
  `startRendering`;
- derive `renderingBusy` from preparation or a `running` global task;
- derive the visible error from local preparation failure or the global failed
  task;
- use an effect to insert a succeeded task result into local renderings exactly
  once;
- leave the existing GET hydration path intact so server history remains the
  source after hard navigation or reload;
- keep the current rendering gate, swatch best-effort behavior, and 120-second
  request limit.

Do not await the task to update component-local state. The provider owns task
settlement after this page unmounts.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx vitest run \
  src/features/platform/rendering-task-manager.test.ts \
  src/features/platform/rendering-task-provider.test.tsx \
  src/features/round1/showroom-intake-app.test.tsx \
  src/features/round1/rendering-references.test.ts \
  'src/app/api/projects/[projectId]/round1/renderings/route.test.ts'
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/round1/showroom-intake-app.tsx \
  src/features/round1/showroom-intake-app.test.tsx
git commit -m "feat(round1): delegate rendering to global task"
```

### Task 4: Verify route continuity and document the result

**Files:**
- Modify: `docs/superpowers/plans/2026-07-01-rendering-task-continuity.md`

- [ ] **Step 1: Run the production build**

Run:

```bash
npm run build
```

Expected: production build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Run browser QA**

Using the authenticated local app:

1. Open a project with a saved Round 1 snapshot.
2. Start concept rendering.
3. Navigate back to the project page before generation completes.
4. Verify the global notice still says the project is rendering.
5. Navigate to another authenticated page and verify the same task remains.
6. Wait for completion and verify the notice links to the saved rendering.
7. Return to Round 1 and verify the completed image is present.
8. Confirm there are no relevant console errors or framework overlays.

- [ ] **Step 4: Record completion and commit the plan**

Append the verified commands and browser result to this plan, then:

```bash
git add docs/superpowers/plans/2026-07-01-rendering-task-continuity.md
git commit -m "docs: record rendering continuity verification"
```

## Verification Result

Completed on 2026-07-01:

- `npm test`: 449 passed, 1 skipped.
- `npm run build`: production build completed successfully.
- Browser QA at `http://localhost:3000` using project `711`:
  - started a new rendering from Round 1;
  - observed the global `Rendering 711` notice;
  - navigated back to the project overview and confirmed the same task remained
    visible and running;
  - navigated to Users and confirmed the task remained visible and running;
  - observed `Rendering complete` with a link to the project's renderings;
  - verified the completed image was saved in rendering history;
  - returned to Round 1 and verified the latest concept image was visible;
  - found no relevant browser console warnings, errors, or framework overlays.
