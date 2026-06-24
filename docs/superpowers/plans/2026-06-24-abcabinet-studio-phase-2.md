# ABCabinet Studio Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining project-facing surfaces into the Studio design system established in Phase 1 while preserving all routes, API contracts, authorization rules, project statuses, and Round 1 behavior.

**Architecture:** Keep the authenticated route-group layout and persistent `StudioRail` created in Phase 1. Add a small set of server-compatible page primitives and pure presentation helpers, then redesign the dashboard, project creation, project overview, rendering gallery, login, and route-level states. Reuse the existing Round 1 state, snapshot, and rendering repositories for real project progress rather than introducing fake data or a new schema.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3, Radix UI icons and primitives, existing Studio tokens, Vitest, server-rendered markup tests

---

## Phase 1 Audit

### Verified implementation

The branch `codex/abcabinet-studio-phase-1` currently contains:

- 17 Phase 1 implementation commits after the approved plan
- 55 changed files relative to `main`
- Persistent authenticated `StudioRail`
- `(app)` route group for authenticated pages
- Shared Studio tokens, buttons, inputs, checkboxes, and feedback
- Round 1 Guided and Canvas focus modes
- Responsive Round 1 workspace shell
- Studio step navigation and inspector
- Canvas drag-state feedback
- Rendering preference and generation states
- Reduced-motion handling

The supplied Phase 1 screenshot confirms the intended visual direction:

- Dark forest Studio shell
- Sage action accent
- Persistent left navigation
- Clear Round 1 progress
- Light functional work surface
- Real material imagery and real plan output
- Workspace mode control in the project bar

### Baseline defects discovered during Phase 2 planning

Running `npm test` on commit `a6521cc` reports:

```text
Test Files  2 failed | 47 passed (49)
Tests       2 failed | 309 passed (311)
```

The failures are stale contracts created by Phase 1 structural changes:

1. `project-dashboard.test.tsx` still expects `Projects` and the account menu inside `ProjectDashboard`, although both now belong to the authenticated route layout and `StudioRail`.
2. `showroom-intake.test.ts` still expects the first combined step to hide openings, although Phase 1 intentionally merged Room and Openings into one visible step.

Phase 2 must repair these tests before adding new work.

## Phase 2 Scope

### Included

- Phase 1 baseline test repair
- Shared Studio page primitives
- Project status presentation helpers
- Project dashboard
- New project form
- Project overview
- Rendering history gallery
- Download action
- Login
- Error and not-found pages
- Route skeletons for dashboard, form, detail, and gallery
- Desktop and iPad responsive verification
- Keyboard, focus, contrast, empty, loading, error, and destructive states

### Excluded

- Admin users
- User logs and quota controls
- Cabinet-color administration
- Database schema changes
- New project statuses
- Round 2 product functionality
- Changes to Round 1 workflow behavior
- Changes to authentication or project authorization

Admin surfaces remain Phase 3.

## File Map

### Create

- `src/features/platform/studio-page.tsx`  
  Server-compatible page frame, header, stat item, section, and empty-state primitives.

- `src/features/platform/studio-page.test.tsx`  
  Static accessibility and styling contracts for shared page primitives.

- `src/features/platform/project-presentation.ts`  
  Pure status labels, tones, dashboard counts, and project next-action selection.

- `src/features/platform/project-presentation.test.ts`  
  Unit tests for real-data summary and next-action logic.

- `src/features/platform/project-detail.test.tsx`  
  Project overview markup contracts.

- `src/features/platform/renderings-view.test.tsx`  
  Rendering gallery, latest marker, metadata, download, and empty-state contracts.

- `src/features/platform/download-button.test.tsx`  
  Accessible download action contract.

- `src/features/platform/platform-states.test.tsx`  
  Login, error, and not-found visual-system contracts.

### Modify

- `src/features/platform/project-dashboard.tsx`
- `src/features/platform/project-dashboard.test.tsx`
- `src/features/platform/new-project-form.tsx`
- `src/features/platform/new-project-form.test.tsx`
- `src/features/platform/project-detail.tsx`
- `src/features/platform/renderings-view.tsx`
- `src/features/platform/download-button.tsx`
- `src/features/platform/download-button.css`
- `src/features/platform/login-form.tsx`
- `src/features/platform/login-form.test.tsx`
- `src/components/ui/sign-in-form.tsx`
- `src/features/platform/route-skeleton.tsx`
- `src/app/(app)/projects/[projectId]/page.tsx`
- `src/app/(app)/projects/loading.tsx`
- `src/app/(app)/projects/new/page.tsx`
- `src/app/(app)/projects/[projectId]/loading.tsx`
- `src/app/(app)/projects/[projectId]/renderings/loading.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/features/round1/showroom-intake.test.ts`

## Task 0: Restore a Green Phase 1 Baseline

**Files:**

- Modify: `src/features/platform/project-dashboard.test.tsx`
- Modify: `src/features/round1/showroom-intake.test.ts`

- [ ] **Step 1: Confirm the current failures**

Run:

```bash
npx vitest run \
  src/features/platform/project-dashboard.test.tsx \
  src/features/round1/showroom-intake.test.ts
```

Expected:

- Dashboard test fails on missing shell-owned `Projects`.
- Intake test fails because opening symbols are now visible in the combined first step.

- [ ] **Step 2: Update the dashboard component boundary contract**

Replace the first dashboard test with:

```tsx
test("renders project search, table, and creation controls", () => {
  const html = renderToStaticMarkup(
    <ProjectDashboard
      user={salesUser}
      projects={[projectFixture]}
    />
  );

  expect(html).toContain("Search customer, address, or project");
  expect(html).toContain("New project");
  expect(html).toContain("Chen Family");
  expect(html).toContain("<table");
  expect(html).toContain("Customer");
  expect(html).toContain("Project");
  expect(html).toContain("Status");
  expect(html).toContain("Updated");

  // Navigation and account actions belong to the authenticated layout.
  expect(html).not.toContain('aria-label="Primary navigation"');
});
```

Extract the repeated user and project values into file-level `salesUser` and `projectFixture` constants.

- [ ] **Step 3: Update the combined first-step preview contract**

Change the failing intake test to:

```tsx
test("opens the combined room and openings step without later-stage objects", () => {
  const html = renderToStaticMarkup(<ShowroomIntakeApp />);

  expect(html).toContain('data-opening-symbol="window"');
  expect(html).toContain('data-opening-symbol="door"');
  expect(html).not.toContain('data-appliance-symbol="');
  expect(html).not.toContain('data-dishwasher-panel="true"');
});
```

- [ ] **Step 4: Verify the full baseline**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected:

- 49 test files pass.
- 311 tests pass.
- TypeScript passes.
- Production build passes.

- [ ] **Step 5: Commit the baseline repair**

```bash
git add \
  src/features/platform/project-dashboard.test.tsx \
  src/features/round1/showroom-intake.test.ts
git commit -m "test: align contracts with Studio shell"
```

## Task 1: Add Shared Studio Page Primitives

**Files:**

- Create: `src/features/platform/studio-page.tsx`
- Create: `src/features/platform/studio-page.test.tsx`
- Create: `src/features/platform/project-presentation.ts`
- Create: `src/features/platform/project-presentation.test.ts`

- [ ] **Step 1: Write failing page primitive tests**

Create `src/features/platform/studio-page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioStat
} from "./studio-page";

describe("Studio page primitives", () => {
  test("renders a labelled page with one primary action region", () => {
    const html = renderToStaticMarkup(
      <StudioPage>
        <StudioPageHeader
          title="Projects"
          description="Continue active work."
          action={<a href="/projects/new">New project</a>}
        />
      </StudioPage>
    );

    expect(html).toContain("<main");
    expect(html).toContain("<h1");
    expect(html).toContain("Projects");
    expect(html).toContain("Continue active work.");
    expect(html).toContain('data-page-action="true"');
  });

  test("renders stat and empty-state semantics", () => {
    const html = renderToStaticMarkup(
      <>
        <StudioStat label="Active" value="7" />
        <StudioEmptyState
          title="No projects yet"
          description="Create the first project."
          action={<a href="/projects/new">New project</a>}
        />
      </>
    );

    expect(html).toContain("Active");
    expect(html).toContain("7");
    expect(html).toContain('data-empty-state="true"');
  });
});
```

- [ ] **Step 2: Write failing project presentation tests**

Create `src/features/platform/project-presentation.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  projectDashboardCounts,
  projectNextAction,
  projectStatusPresentation
} from "./project-presentation";

describe("project presentation", () => {
  test("derives dashboard counts from real statuses", () => {
    const counts = projectDashboardCounts([
      { status: "INTAKE" },
      { status: "RENDERING_READY" },
      { status: "ROUND2_MEASURING" },
      { status: "ARCHIVED" }
    ]);

    expect(counts).toEqual({
      active: 3,
      intake: 1,
      renderingReady: 1
    });
  });

  test("maps every project status to one Studio tone", () => {
    expect(projectStatusPresentation("INTAKE")).toEqual({
      label: "Intake",
      tone: "muted"
    });
    expect(projectStatusPresentation("RENDERING_READY").tone).toBe("success");
    expect(projectStatusPresentation("ROUND2_MEASURING").tone).toBe("action");
    expect(projectStatusPresentation("ARCHIVED").tone).toBe("muted");
  });

  test("selects the next action from persisted project progress", () => {
    expect(
      projectNextAction({
        hasRound1State: false,
        hasSnapshot: false,
        hasRendering: false
      })
    ).toEqual({ label: "Start Round 1", destination: "round1" });

    expect(
      projectNextAction({
        hasRound1State: true,
        hasSnapshot: true,
        hasRendering: false
      })
    ).toEqual({ label: "Generate rendering", destination: "round1" });

    expect(
      projectNextAction({
        hasRound1State: true,
        hasSnapshot: true,
        hasRendering: true
      })
    ).toEqual({ label: "Review renderings", destination: "renderings" });
  });
});
```

- [ ] **Step 3: Verify both tests fail**

Run:

```bash
npx vitest run \
  src/features/platform/studio-page.test.tsx \
  src/features/platform/project-presentation.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement server-compatible page primitives**

Create `src/features/platform/studio-page.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StudioPage({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] bg-studio-void px-4 py-6 text-studio-ink sm:px-6 lg:px-8 lg:py-8",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1320px]">{children}</div>
    </main>
  );
}

export function StudioPageHeader({
  title,
  description,
  action,
  meta
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-studio-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {meta && <div className="mb-3">{meta}</div>}
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-studio-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-5 text-studio-muted">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div data-page-action="true" className="shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}

export function StudioSection({
  children,
  className,
  "aria-label": ariaLabel
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "rounded-studio-panel border border-studio-line bg-studio-shell",
        className
      )}
    >
      {children}
    </section>
  );
}

export function StudioStat({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "action" | "warning";
}) {
  return (
    <div
      data-stat-tone={tone}
      className="min-w-0 border-l border-studio-line pl-4 first:border-l-0 first:pl-0"
    >
      <p className="text-[11px] font-medium text-studio-quiet">{label}</p>
      <p
        className={cn(
          "mt-1 text-[22px] font-semibold tabular-nums",
          tone === "action" ? "text-studio-action" : "text-studio-ink",
          tone === "warning" && "text-studio-warning"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StudioEmptyState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-empty-state="true"
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <h2 className="text-[18px] font-semibold text-studio-ink">{title}</h2>
      <p className="mt-2 max-w-md text-[13px] leading-5 text-studio-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Implement pure project presentation helpers**

Create `src/features/platform/project-presentation.ts`:

```ts
import type { ProjectStatus } from "@/server/platform/types";

export type ProjectStatusTone = "muted" | "success" | "action";

const STATUS_PRESENTATION: Record<
  ProjectStatus,
  { label: string; tone: ProjectStatusTone }
> = {
  INTAKE: { label: "Intake", tone: "muted" },
  RENDERING_READY: { label: "Rendering ready", tone: "success" },
  ROUND2_MEASURING: { label: "Round 2 measuring", tone: "action" },
  ARCHIVED: { label: "Archived", tone: "muted" }
};

export function projectStatusPresentation(status: ProjectStatus) {
  return STATUS_PRESENTATION[status];
}

export function projectDashboardCounts(
  projects: ReadonlyArray<{ status: ProjectStatus }>
) {
  return {
    active: projects.filter((project) => project.status !== "ARCHIVED").length,
    intake: projects.filter((project) => project.status === "INTAKE").length,
    renderingReady: projects.filter(
      (project) => project.status === "RENDERING_READY"
    ).length
  };
}

export function projectNextAction(input: {
  hasRound1State: boolean;
  hasSnapshot: boolean;
  hasRendering: boolean;
}): {
  label: string;
  destination: "round1" | "renderings";
} {
  if (input.hasRendering) {
    return { label: "Review renderings", destination: "renderings" };
  }
  if (input.hasSnapshot) {
    return { label: "Generate rendering", destination: "round1" };
  }
  if (input.hasRound1State) {
    return { label: "Continue Round 1", destination: "round1" };
  }
  return { label: "Start Round 1", destination: "round1" };
}
```

- [ ] **Step 6: Verify focused tests**

Run:

```bash
npx vitest run \
  src/features/platform/studio-page.test.tsx \
  src/features/platform/project-presentation.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit shared platform foundations**

```bash
git add \
  src/features/platform/studio-page.tsx \
  src/features/platform/studio-page.test.tsx \
  src/features/platform/project-presentation.ts \
  src/features/platform/project-presentation.test.ts
git commit -m "feat: add Studio platform page primitives"
```

## Task 2: Redesign the Project Dashboard

**Files:**

- Modify: `src/features/platform/project-dashboard.tsx`
- Modify: `src/features/platform/project-dashboard.test.tsx`
- Delete: `src/features/platform/uiverse-delete-button.tsx`
- Delete: `src/features/platform/uiverse-delete-button.module.css`

- [ ] **Step 1: Write failing dashboard presentation tests**

Add:

```tsx
test("renders real project counts and Studio status semantics", () => {
  const html = renderToStaticMarkup(
    <ProjectDashboard
      user={adminUser}
      projects={[
        projectFixture,
        {
          ...projectFixture,
          id: "p2",
          projectName: "Lake House",
          status: "RENDERING_READY"
        }
      ]}
    />
  );

  expect(html).toContain("<h1");
  expect(html).toContain("Projects");
  expect(html).toContain("Active");
  expect(html).toContain("Intake");
  expect(html).toContain("Rendering ready");
  expect(html).toContain('data-project-status="INTAKE"');
  expect(html).toContain('data-project-status="RENDERING_READY"');
});

test("uses the shared destructive action instead of the expanding Uiverse control", () => {
  const source = readFileSync(
    "src/features/platform/project-dashboard.tsx",
    "utf8"
  );

  expect(source).not.toContain("UiverseDeleteButton");
  expect(source).toContain('variant="destructive"');
});
```

Import `readFileSync` and add an `adminUser` fixture.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run src/features/platform/project-dashboard.test.tsx
```

Expected: FAIL because the current page has no heading or Studio summaries and still uses `UiverseDeleteButton`.

- [ ] **Step 3: Replace the dashboard composition**

Use:

```tsx
import { TrashIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import {
  StudioEmptyState,
  StudioPage,
  StudioPageHeader,
  StudioSection,
  StudioStat
} from "./studio-page";
import {
  projectDashboardCounts,
  projectStatusPresentation
} from "./project-presentation";
```

The visible structure must be:

```tsx
const counts = projectDashboardCounts(projects);

return (
  <StudioPage>
    <StudioPageHeader
      title="Projects"
      description="Continue active work, review ready concepts, or start a new project."
      action={
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      }
    />

    <div className="mt-6 grid grid-cols-3 gap-5 rounded-studio-panel border border-studio-line bg-studio-shell px-5 py-4">
      <StudioStat label="Active" value={counts.active} />
      <StudioStat label="Intake" value={counts.intake} />
      <StudioStat
        label="Rendering ready"
        value={counts.renderingReady}
        tone="action"
      />
    </div>

    <form
      method="get"
      className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="block min-w-0 flex-1">
        <span className="mb-2 block text-[12px] font-medium text-studio-muted">
          Search projects
        </span>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search customer, address, or project"
        />
      </label>
      {canDeleteProjects && selectedIds.size > 0 && (
        <Button
          type="button"
          variant="destructive"
          disabled={deleting}
          onClick={handleDeleteSelected}
        >
          <TrashIcon aria-hidden />
          {deleting
            ? "Deleting"
            : `Delete ${selectedIds.size} selected`}
        </Button>
      )}
    </form>

    <StudioSection className="mt-4 overflow-hidden">
      {projects.length > 0 ? projectTable : emptyState}
    </StudioSection>
  </StudioPage>
);
```

Table rules:

- Use one flat table surface.
- Remove `border-separate` and row cards.
- Do not scale or lift rows.
- Use `hover:bg-white/[0.035]`.
- Use one bottom divider between rows.
- Use Studio text colors.
- Keep full-row navigation.
- Keep selection behavior for admins.
- Add `data-project-status={project.status}`.
- Render status with:

```tsx
const status = projectStatusPresentation(project.status);

<span
  data-project-status={project.status}
  data-status-tone={status.tone}
  className={cn(
    "inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-semibold",
    status.tone === "success" &&
      "bg-studio-action/10 text-studio-action",
    status.tone === "action" &&
      "bg-studio-action text-studio-action-ink",
    status.tone === "muted" &&
      "bg-white/[0.05] text-studio-muted"
  )}
>
  {status.label}
</span>
```

Use `StudioEmptyState` with one `New project` action.

- [ ] **Step 4: Preserve destructive behavior**

Keep the existing admin authorization, confirmation text, API requests, refresh, error alert, and selected-id handling unchanged.

Delete the two Uiverse delete-button files only after:

```bash
rg -n "UiverseDeleteButton|uiverse-delete-button" src
```

returns no consumers.

- [ ] **Step 5: Verify dashboard tests**

Run:

```bash
npx vitest run src/features/platform/project-dashboard.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit dashboard redesign**

```bash
git add \
  src/features/platform/project-dashboard.tsx \
  src/features/platform/project-dashboard.test.tsx
git rm \
  src/features/platform/uiverse-delete-button.tsx \
  src/features/platform/uiverse-delete-button.module.css
git commit -m "feat: redesign Studio project dashboard"
```

## Task 3: Redesign Project Creation

**Files:**

- Modify: `src/features/platform/new-project-form.tsx`
- Modify: `src/features/platform/new-project-form.test.tsx`

- [ ] **Step 1: Write failing form contracts**

Add:

```tsx
test("uses a focused Studio form without a decorative preview", () => {
  const html = renderToStaticMarkup(<NewProjectForm user={user} />);

  expect(html).toContain("<h1");
  expect(html).toContain("New project");
  expect(html).toContain("Customer name");
  expect(html).toContain("Project name");
  expect(html).not.toContain("Project card preview");
  expect(html).not.toContain(">customer<");
  expect(html).not.toContain(">site<");
});

test("marks required fields and keeps optional fields secondary", () => {
  const html = renderToStaticMarkup(<NewProjectForm user={user} />);

  expect(html).toContain('required=""');
  expect(html).toContain("Contact details");
  expect(html).toContain("Optional");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run src/features/platform/new-project-form.test.tsx
```

Expected: FAIL because the preview remains and the page has no Studio heading.

- [ ] **Step 3: Implement the focused form**

Use `StudioPage`, `StudioPageHeader`, `StudioSection`, `Input`, and `Button`.

Required layout:

```tsx
<StudioPage>
  <StudioPageHeader
    title="New project"
    description="Create the customer record and project workspace. Round 1 starts after creation."
  />

  <StudioSection className="mt-6 max-w-3xl">
    <form onSubmit={submit} className="p-5 sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Customer name" required>
          <Input
            required
            autoComplete="name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
        </Field>
        <Field label="Project name" required>
          <Input
            required
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
        </Field>
      </div>

      <div className="my-7 border-t border-studio-line" />

      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-studio-ink">
            Contact details
          </h2>
          <span className="text-[11px] text-studio-quiet">Optional</span>
        </div>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              autoComplete="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input
              autoComplete="street-address"
              value={customerAddress}
              onChange={(event) => setCustomerAddress(event.target.value)}
            />
          </Field>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-studio-control border border-studio-danger/30 bg-studio-danger/10 px-3 py-2 text-[13px] text-studio-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-7 flex justify-end">
        <Button
          type="submit"
          size="lg"
          aria-busy={busy}
          disabled={busy || !customerName.trim() || !projectName.trim()}
        >
          {busy ? "Creating project" : "Create project"}
        </Button>
      </div>
    </form>
  </StudioSection>
</StudioPage>
```

The `Field` component must:

- Render a visible label above the input.
- Add `"Required"` to screen-reader text for required fields.
- Not use placeholder text as a label.

Preserve the existing request payload and redirect behavior.

- [ ] **Step 4: Verify form tests**

Run:

```bash
npx vitest run src/features/platform/new-project-form.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit project creation**

```bash
git add \
  src/features/platform/new-project-form.tsx \
  src/features/platform/new-project-form.test.tsx
git commit -m "feat: redesign Studio project creation"
```

## Task 4: Build the Real Project Overview

**Files:**

- Modify: `src/app/(app)/projects/[projectId]/page.tsx`
- Modify: `src/features/platform/project-detail.tsx`
- Create: `src/features/platform/project-detail.test.tsx`

- [ ] **Step 1: Write failing project overview tests**

Create `src/features/platform/project-detail.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ProjectDetail } from "./project-detail";

const projectFixture = {
  id: "p1",
  companyId: "c1",
  customerId: "customer-1",
  customerName: "Elena Park",
  projectName: "Elm Street Kitchen",
  status: "INTAKE" as const,
  createdByUserId: "u1",
  assignedDesignerId: null,
  updatedAt: "2026-06-24T12:00:00.000Z"
};

describe("ProjectDetail", () => {
  test("renders real workflow progress and a recommended action", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={projectFixture}
        progress={{
          hasRound1State: true,
          hasSnapshot: true,
          latestRendering: null
        }}
      />
    );

    expect(html).toContain("Elm Street Kitchen");
    expect(html).toContain("Elena Park");
    expect(html).toContain("Round 1 snapshot");
    expect(html).toContain("Generate rendering");
    expect(html).toContain('href="/projects/p1/round1"');
  });

  test("does not retain the decorative plan glyph or retired serif", () => {
    const source = readFileSync(
      "src/features/platform/project-detail.tsx",
      "utf8"
    );

    expect(source).not.toContain("function PlanGlyph");
    expect(source).not.toContain("font-playfair");
  });

  test("uses the latest real rendering when available", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        project={projectFixture}
        progress={{
          hasRound1State: true,
          hasSnapshot: true,
          latestRendering: {
            id: "r1",
            createdAt: "2026-06-24T12:00:00.000Z"
          }
        }}
      />
    );

    expect(html).toContain(
      "/api/projects/p1/round1/renderings/r1/image"
    );
    expect(html).toContain("Review renderings");
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run src/features/platform/project-detail.test.tsx
```

Expected: FAIL because the component does not accept progress.

- [ ] **Step 3: Fetch existing progress data in the server page**

In `src/app/(app)/projects/[projectId]/page.tsx`, import:

```tsx
import {
  getLatestRound1Snapshot,
  getRound1State,
  listRenderings
} from "@/server/platform/round1-postgres-repository";
```

After authorization:

```tsx
const [round1State, snapshot, renderings] = await Promise.all([
  getRound1State(projectId),
  getLatestRound1Snapshot(projectId),
  listRenderings(projectId)
]);

return (
  <ProjectDetail
    project={project}
    progress={{
      hasRound1State: Boolean(round1State),
      hasSnapshot: Boolean(snapshot),
      latestRendering: renderings[0]
        ? {
            id: renderings[0].id,
            createdAt: renderings[0].createdAt
          }
        : null
    }}
  />
);
```

Do not fetch `image_base64`.

- [ ] **Step 4: Replace equal cards and the fake plan glyph**

`ProjectDetail` props become:

```ts
{
  project: ProjectSummary;
  progress: {
    hasRound1State: boolean;
    hasSnapshot: boolean;
    latestRendering: {
      id: string;
      createdAt: string;
    } | null;
  };
}
```

Remove `user`, `isAdmin`, `CARD_BASE`, `PlanGlyph`, and all serif font references.

Use:

```tsx
const status = projectStatusPresentation(project.status);
const nextAction = projectNextAction({
  hasRound1State: progress.hasRound1State,
  hasSnapshot: progress.hasSnapshot,
  hasRendering: Boolean(progress.latestRendering)
});
const nextHref =
  nextAction.destination === "renderings"
    ? `/projects/${project.id}/renderings`
    : `/projects/${project.id}/round1`;
```

Required structure:

1. `StudioPageHeader`
   - Title: `project.projectName`
   - Description: `project.customerName`
   - Status pill in `meta`
   - One primary next-action button
2. Two-column overview at desktop:
   - Workflow section
   - Latest rendering section
3. Workflow section uses three rows, not three equal cards:
   - Project created
   - Round 1 draft/state
   - Round 1 snapshot
4. Latest rendering section:
   - Real image route if available
   - `StudioEmptyState` if unavailable
   - Link to rendering history if available
5. Round 2 appears as a plain informational row, not a disabled feature card.

Use one divider between rows. Do not add fake precise metrics.

- [ ] **Step 5: Verify overview tests and repository tests**

Run:

```bash
npx vitest run \
  src/features/platform/project-detail.test.tsx \
  src/server/platform/round1-postgres-repository.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit project overview**

```bash
git add \
  src/app/'(app)'/projects/'[projectId]'/page.tsx \
  src/features/platform/project-detail.tsx \
  src/features/platform/project-detail.test.tsx
git commit -m "feat: add real Studio project overview"
```

## Task 5: Redesign the Rendering History

**Files:**

- Modify: `src/features/platform/renderings-view.tsx`
- Create: `src/features/platform/renderings-view.test.tsx`
- Modify: `src/features/platform/download-button.tsx`
- Create: `src/features/platform/download-button.test.tsx`
- Delete: `src/features/platform/download-button.css`

- [ ] **Step 1: Write failing rendering gallery tests**

Create `src/features/platform/renderings-view.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RenderingsView } from "./renderings-view";

const projectFixture = {
  id: "p1",
  customerName: "Elena Park",
  projectName: "Elm Street Kitchen"
};

const renderingFixture = {
  id: "r1",
  size: "1536x1024",
  createdAt: "2026-06-24T12:00:00.000Z",
  basedOnRenderingPreferences: {
    cabinetStyle: "EUROPEAN_FRAMELESS",
    doorColorId: "oak"
  }
};

describe("RenderingsView", () => {
  test("renders real images, latest state, and separate metadata lines", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[renderingFixture]}
        colors={[{ id: "oak", name: "Natural Oak" }]}
      />
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Renderings");
    expect(html).toContain("Latest");
    expect(html).toContain("Natural Oak");
    expect(html).toContain("European Frameless");
    expect(html).not.toContain(" · ");
    expect(html).not.toContain("—");
  });

  test("renders one functional empty-state action", () => {
    const html = renderToStaticMarkup(
      <RenderingsView
        project={projectFixture}
        renderings={[]}
        colors={[]}
      />
    );

    expect(html).toContain("No renderings yet");
    expect(html).toContain("Open Round 1");
    expect(html).toContain('href="/projects/p1/round1"');
  });
});
```

- [ ] **Step 2: Write failing download action test**

Create `src/features/platform/download-button.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { DownloadButton } from "./download-button";

describe("DownloadButton", () => {
  test("renders an accessible Studio icon action", () => {
    const html = renderToStaticMarkup(
      <DownloadButton href="/image" fileName="rendering.png" />
    );

    expect(html).toContain('aria-label="Download rendering"');
    expect(html).toContain("Download");
    expect(html).not.toContain("dl-Btn");

    const source = readFileSync(
      "src/features/platform/download-button.tsx",
      "utf8"
    );
    expect(source).toContain("DownloadIcon");
    expect(source).not.toContain("<svg");
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npx vitest run \
  src/features/platform/renderings-view.test.tsx \
  src/features/platform/download-button.test.tsx
```

Expected: FAIL on the old gallery and hand-authored SVG button.

- [ ] **Step 4: Replace the download button**

Use `DownloadIcon` from `@radix-ui/react-icons` and the shared `Button`:

```tsx
"use client";

import { DownloadIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export function DownloadButton({
  href,
  fileName
}: {
  href: string;
  fileName: string;
}) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      aria-label="Download rendering"
      title="Download rendering"
    >
      <DownloadIcon aria-hidden />
      <span>Download</span>
    </Button>
  );
}
```

Delete `download-button.css`.

- [ ] **Step 5: Redesign the gallery**

Remove the unused `user` prop.

Use `StudioPage`, `StudioPageHeader`, `StudioSection`, and `StudioEmptyState`.

Header:

```tsx
<StudioPageHeader
  title="Renderings"
  description={`${project.customerName}. ${project.projectName}`}
  action={
    <Button asChild variant="secondary">
      <Link href={`/projects/${project.id}/round1`}>
        Open Round 1
      </Link>
    </Button>
  }
/>
```

Gallery rules:

- Use two columns at `lg`, three only at `2xl`.
- Keep the image at `4 / 3`.
- Use real image routes.
- Use a subtle image scale no greater than `1.01`.
- Use `"Latest"` only on the newest item.
- Put color name, style, and date on separate lines.
- Do not use middle-dot separators.
- Do not use em-dash fallbacks; use `"Finish not recorded"`.
- Use `time` with `dateTime`.
- Keep download inside the figcaption.

Empty state:

```tsx
<StudioSection className="mt-6">
  <StudioEmptyState
    title="No renderings yet"
    description="Complete Round 1 preferences and generate the first concept rendering."
    action={
      <Button asChild>
        <Link href={`/projects/${project.id}/round1`}>
          Open Round 1
        </Link>
      </Button>
    }
  />
</StudioSection>
```

- [ ] **Step 6: Update the server page**

Remove `user={user}` from `RenderingsView`; authorization remains in the page before rendering.

- [ ] **Step 7: Verify rendering tests**

Run:

```bash
npx vitest run \
  src/features/platform/renderings-view.test.tsx \
  src/features/platform/download-button.test.tsx \
  src/server/platform/round1-postgres-repository.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit rendering history**

```bash
git add \
  src/app/'(app)'/projects/'[projectId]'/renderings/page.tsx \
  src/features/platform/renderings-view.tsx \
  src/features/platform/renderings-view.test.tsx \
  src/features/platform/download-button.tsx \
  src/features/platform/download-button.test.tsx
git rm src/features/platform/download-button.css
git commit -m "feat: redesign Studio rendering history"
```

## Task 6: Redesign Login and Global Error States

**Files:**

- Modify: `src/features/platform/login-form.tsx`
- Modify: `src/components/ui/sign-in-form.tsx`
- Modify: `src/features/platform/login-form.test.tsx`
- Create: `src/features/platform/platform-states.test.tsx`
- Modify: `src/app/error.tsx`
- Modify: `src/app/not-found.tsx`

- [ ] **Step 1: Write failing login contracts**

Add to `login-form.test.tsx`:

```tsx
test("uses the Studio theme without retired serif variables", () => {
  const html = renderToStaticMarkup(<LoginForm />);

  expect(html).toContain("ABCabinet Studio");
  expect(html).toContain("Make the quote ready");
  expect(html).toContain("bg-studio-void");
  expect(html).not.toContain("--font-playfair");
  expect(html).not.toContain("--font-instrument-serif");
  expect(html).not.toContain("Secure");
});
```

- [ ] **Step 2: Write failing error-state source contracts**

Create `src/features/platform/platform-states.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("global platform states", () => {
  test("error and not-found pages use Studio tokens and shared buttons", () => {
    const errorSource = readFileSync("src/app/error.tsx", "utf8");
    const notFoundSource = readFileSync("src/app/not-found.tsx", "utf8");

    for (const source of [errorSource, notFoundSource]) {
      expect(source).toContain("bg-studio-void");
      expect(source).toContain("@/components/ui/button");
      expect(source).not.toContain("font-playfair");
      expect(source).not.toContain("rounded-full bg-[#1d1d1f]");
    }
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npx vitest run \
  src/features/platform/login-form.test.tsx \
  src/features/platform/platform-states.test.tsx
```

Expected: FAIL on the current light serif presentation.

- [ ] **Step 4: Implement the Studio login composition**

`LoginForm` uses one dark theme:

```tsx
<main className="min-h-[100dvh] bg-studio-void text-studio-ink">
  <div className="mx-auto grid min-h-[100dvh] max-w-[1180px] items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_420px] lg:px-10">
    <section className="hidden lg:block">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-[10px] bg-studio-action" />
        <span className="text-[14px] font-semibold">ABCabinet Studio</span>
      </div>
      <h1 className="mt-12 max-w-[560px] text-[54px] font-semibold leading-[1.02] tracking-[-0.055em]">
        Make the quote ready.
      </h1>
      <p className="mt-5 max-w-[48ch] text-[15px] leading-6 text-studio-muted">
        Capture the room, confirm the layout, and produce a concept rendering in one project workspace.
      </p>
    </section>

    <section className="w-full">
      <SignInForm
        account={account}
        password={password}
        remember={remember}
        busy={busy}
        error={
          error ? (
            <p
              role="alert"
              className="rounded-studio-control border border-studio-danger/30 bg-studio-danger/10 px-3 py-2 text-[13px] text-studio-danger"
            >
              {error}
            </p>
          ) : null
        }
        onAccountChange={setAccount}
        onPasswordChange={setPassword}
        onRememberChange={setRemember}
        onSubmit={submit}
      />
    </section>
  </div>
</main>
```

No decorative weather, version, status dot, fake screenshot, gradient, or serif emphasis.

- [ ] **Step 5: Restyle the sign-in form**

`SignInForm` requirements:

- Dark `StudioSection`-equivalent card.
- Heading `"Sign in"` in system sans.
- No `"Secure"` pill.
- Shared `Input`, `Checkbox`, and `Button`.
- Labels above inputs.
- Error remains `role="alert"` from the parent.
- Button keeps width while busy.
- Remember-me uses the shared checkbox, not a text pill.

Use:

```tsx
<form onSubmit={onSubmit}>
  <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6 shadow-[var(--studio-shadow-raised)] sm:p-8">
    <h2 className="text-[26px] font-semibold tracking-[-0.035em]">
      Sign in
    </h2>
    <p className="mt-2 text-[13px] text-studio-muted">
      Use your ABCabinet account.
    </p>
    <div className="mt-6 grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="account" className="text-[12px] font-medium text-studio-muted">
          Account
        </Label>
        <Input
          id="account"
          type="text"
          autoComplete="username"
          placeholder="Enter your account"
          value={account}
          onChange={(event) => onAccountChange(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="text-[12px] font-medium text-studio-muted">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </div>
    </div>
    <div className="mt-5">
      {error}
    </div>
    <label className="flex items-center gap-3">
      <Checkbox
        checked={remember}
        onCheckedChange={(value) => onRememberChange(value === true)}
      />
      <span className="text-[13px] text-studio-muted">Remember me</span>
    </label>
    <Button
      type="submit"
      size="lg"
      className="w-full"
      aria-busy={busy}
      disabled={busy}
    >
      {busy ? "Signing in" : "Sign in"}
    </Button>
  </div>
</form>
```

- [ ] **Step 6: Migrate error and not-found pages**

Use:

- `bg-studio-void`
- `text-studio-ink`
- System sans
- Shared `Button`
- One short title
- One functional paragraph
- Maximum two actions

Keep existing reset and navigation behavior.

- [ ] **Step 7: Verify platform state tests**

Run:

```bash
npx vitest run \
  src/features/platform/login-form.test.tsx \
  src/features/platform/platform-states.test.tsx
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit login and global states**

```bash
git add \
  src/features/platform/login-form.tsx \
  src/components/ui/sign-in-form.tsx \
  src/features/platform/login-form.test.tsx \
  src/features/platform/platform-states.test.tsx \
  src/app/error.tsx \
  src/app/not-found.tsx
git commit -m "feat: redesign Studio login and global states"
```

## Task 7: Align Route Skeletons With Real Page Layouts

**Files:**

- Modify: `src/features/platform/route-skeleton.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/features/round1/ghost-loader.css`
- Modify: `src/app/(app)/projects/loading.tsx`
- Create: `src/app/(app)/projects/new/loading.tsx`
- Modify: `src/app/(app)/projects/[projectId]/loading.tsx`
- Modify: `src/app/(app)/projects/[projectId]/renderings/loading.tsx`
- Modify: `src/app/loading.tsx`

- [ ] **Step 1: Add a skeleton source contract**

Add to `studio-page.test.tsx`:

```tsx
test("route skeletons use Studio surfaces and page-specific variants", () => {
  const source = readFileSync(
    "src/features/platform/route-skeleton.tsx",
    "utf8"
  );

  expect(source).toContain('"form"');
  expect(source).toContain('"gallery"');
  expect(source).toContain("bg-studio-void");
  expect(source).toContain("studio-skeleton");
  expect(source).not.toContain("bg-[#f5f5f7]");
  expect(source).not.toContain("rounded-[18px]");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run src/features/platform/studio-page.test.tsx
```

Expected: FAIL on the legacy skeleton.

- [ ] **Step 3: Implement page-specific skeleton variants**

Move the shared `.studio-skeleton`, keyframes, and reduced-motion override from
`src/features/round1/ghost-loader.css` into `src/app/globals.css`. Keep only
Round 1-specific loader selectors in `ghost-loader.css`. This makes the skeleton
available to route loading components without relying on a Round 1 component
import.

Use:

```ts
type SkeletonVariant =
  | "dashboard"
  | "form"
  | "detail"
  | "gallery"
  | "plain"
  | "round1";
```

All non-Round 1 skeletons must:

- Render inside `bg-studio-void`.
- Match `StudioPage` max width and padding.
- Use `studio-skeleton`.
- Reserve title and description space.
- Avoid card counts that do not match the final page.

Variant shapes:

- `dashboard`: header, three stat columns, search field, five table rows.
- `form`: header, one 3-column-width form surface, five fields.
- `detail`: header, workflow rows, one rendering media region.
- `gallery`: header, four `4 / 3` media cells.
- `plain`: header and one large section.
- `round1`: preserve the Phase 1 implementation.

- [ ] **Step 4: Map loading routes**

Use:

```tsx
// projects/loading.tsx
<RouteSkeleton variant="dashboard" />

// projects/new/loading.tsx
<RouteSkeleton variant="form" />

// projects/[projectId]/loading.tsx
<RouteSkeleton variant="detail" />

// projects/[projectId]/renderings/loading.tsx
<RouteSkeleton variant="gallery" />
```

The root loading fallback uses `plain`.

- [ ] **Step 5: Verify skeleton contract and build**

Run:

```bash
npx vitest run src/features/platform/studio-page.test.tsx
npx tsc --noEmit
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit skeleton migration**

```bash
git add \
  src/features/platform/route-skeleton.tsx \
  src/features/platform/studio-page.test.tsx \
  src/app/globals.css \
  src/features/round1/ghost-loader.css \
  src/app/'(app)'/projects/loading.tsx \
  src/app/'(app)'/projects/new/loading.tsx \
  src/app/'(app)'/projects/'[projectId]'/loading.tsx \
  src/app/'(app)'/projects/'[projectId]'/renderings/loading.tsx \
  src/app/loading.tsx
git commit -m "feat: align Studio route skeletons"
```

## Task 8: Remove Project-Surface Legacy Styling

**Files:**

- Modify only files still reported by the audit commands below

- [ ] **Step 1: Audit Phase 2 surfaces**

Run:

```bash
rg -n \
  "font-playfair|font-instrument-serif|bg-\\[#f5f5f7\\]|text-\\[#1d1d1f\\]|rounded-\\[18px\\]|Uiverse|dl-Btn|transition-transform.*scale| · |—" \
  src/features/platform \
  src/components/ui/sign-in-form.tsx \
  src/app/error.tsx \
  src/app/not-found.tsx
```

Expected allowed matches:

- Admin files scheduled for Phase 3.
- No project dashboard, project creation, project detail, rendering history, login, error, or not-found matches.

- [ ] **Step 2: Audit hand-authored SVG and icon families**

Run:

```bash
rg -n "<svg|lucide-react" \
  src/features/platform/project-dashboard.tsx \
  src/features/platform/new-project-form.tsx \
  src/features/platform/project-detail.tsx \
  src/features/platform/renderings-view.tsx \
  src/features/platform/download-button.tsx \
  src/features/platform/login-form.tsx \
  src/components/ui/sign-in-form.tsx
```

Expected: no matches.

- [ ] **Step 3: Audit CTA labels**

Confirm:

- Project creation intent uses `"New project"` in navigation and dashboard.
- Submission uses `"Create project"`.
- Round 1 navigation uses `"Open Round 1"`, `"Start Round 1"`, or `"Continue Round 1"` based on context.
- Rendering review uses `"Review renderings"`.
- No duplicate differently worded CTA exists for the same intent on one page.

- [ ] **Step 4: Run all platform tests**

Run:

```bash
npx vitest run src/features/platform
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit cleanup if required**

If files changed:

```bash
git diff --name-only -z | xargs -0 git add
git commit -m "refactor: remove legacy project surface styling"
```

Skip the commit if no code changes are required.

## Task 9: Browser Verification and Visual QA

**Files:**

- Modify only files required by verified findings
- Reference: `docs/superpowers/specs/2026-06-24-abcabinet-studio-frontend-redesign.md`
- Reference: supplied Phase 1 screenshot

- [ ] **Step 1: Start from a green automated baseline**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass before browser QA.

- [ ] **Step 2: Verify the project dashboard**

Desktop `1440x900`:

- Persistent Studio sidebar remains fixed.
- Page heading and primary action are visible without scrolling.
- Summary values come from the rendered project list.
- Table rows do not lift or scale.
- Search, status, and selected rows pass contrast.
- Admin delete action appears only after selection.
- Empty state has one action.

iPad landscape `1180x820`:

- Table remains usable.
- Search and action do not overlap.
- No body-level horizontal scroll.

Capture:

```text
artifacts/qa/phase2-project-dashboard-desktop.png
artifacts/qa/phase2-project-dashboard-ipad.png
```

- [ ] **Step 3: Verify project creation**

Check:

- Required fields appear first.
- Optional fields are grouped.
- Labels remain above fields.
- Submit stays one line.
- Loading does not change button width.
- Validation and network errors are announced.
- iPad portrait becomes one column.

Capture:

```text
artifacts/qa/phase2-new-project-ipad-portrait.png
```

- [ ] **Step 4: Verify project overview**

Check projects in these states:

- No Round 1 state
- Draft Round 1 state
- Frozen snapshot without rendering
- Rendering available

Confirm the next action and workflow progress match real repository data.

Capture:

```text
artifacts/qa/phase2-project-overview.png
```

- [ ] **Step 5: Verify rendering history**

Check:

- Empty state
- One rendering
- Multiple renderings
- Latest marker only on the first item
- Image lazy loading
- Download action
- Long finish names
- Missing preference metadata

Capture:

```text
artifacts/qa/phase2-rendering-history.png
```

- [ ] **Step 6: Verify login and global states**

Check:

- Desktop and narrow layout
- Invalid credentials
- Network error
- Busy state
- Keyboard focus order
- Error reset action
- Not-found return action

Capture:

```text
artifacts/qa/phase2-login.png
artifacts/qa/phase2-error-state.png
```

- [ ] **Step 7: Inspect console and accessibility**

Confirm:

- No hydration errors
- No React key warnings
- No failed image requests
- No focus traps outside dialogs
- Visible focus on every interactive element
- Body text and controls meet WCAG AA
- `prefers-reduced-motion` removes nonessential movement

- [ ] **Step 8: Commit verified QA fixes**

If code changed:

```bash
git diff --name-only -z | xargs -0 git add
git commit -m "fix: polish Studio project surfaces"
```

## Task 10: Phase 2 Completion Review

**Files:**

- Review all Phase 2 commits
- Review `docs/superpowers/specs/2026-06-24-abcabinet-studio-frontend-redesign.md`

- [ ] **Step 1: Verify scope coverage**

Confirm:

- Baseline tests are green.
- Project dashboard uses Studio styling and real counts.
- New project uses a focused form and no fake preview.
- Project overview uses real Round 1 progress and rendering data.
- Rendering history uses real images and shared controls.
- Login, error, and not-found use the Studio system.
- Route skeletons match final layouts.
- Global sidebar behavior remains unchanged.
- Admin screens were not redesigned.

- [ ] **Step 2: Verify preservation rules**

Confirm no changes to:

- Route URLs
- Project status values
- Form payload field names
- Project authorization
- Authentication API
- Database schema
- Round 1 workflow logic

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 4: Review the branch diff**

Run:

```bash
git diff --stat a6521cc...HEAD
git diff --name-only a6521cc...HEAD
```

Expected:

- Project-facing surfaces and shared page primitives changed.
- Round 1 implementation changed only for the two stale test corrections.
- Admin implementation files remain untouched.

- [ ] **Step 5: Prepare Phase 3 inputs**

Record reusable foundations for Phase 3:

- `StudioPage`
- `StudioPageHeader`
- `StudioSection`
- `StudioStat`
- `StudioEmptyState`
- `projectStatusPresentation`
- Updated route skeleton patterns
- Shared destructive and download actions

Do not begin Phase 3 until the user approves Phase 2 visual QA.
