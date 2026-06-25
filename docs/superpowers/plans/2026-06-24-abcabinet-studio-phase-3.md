# ABCabinet Studio Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved Studio redesign by migrating Admin users, usage logs, quotas, and cabinet-color management to the Phase 1–2 design system, then remove obsolete one-off styling and complete final desktop, iPad, keyboard, reduced-motion, and accessibility QA.

**Architecture:** Preserve the existing authenticated `(app)` route group, `StudioRail`, server-side Admin guards, APIs, repositories, and database schema. Reuse the Phase 2 `StudioPage` primitives and Phase 1 shared controls. Add only pure Admin presentation helpers and focused client interaction components. Keep user mutations and cabinet-color batch saves on their existing endpoints; this phase changes presentation and interaction quality, not business behavior.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3, Radix UI primitives and icons, existing Studio tokens, Vitest, server-rendered markup tests

---

## Phase 2 Audit

### Verified branch

Reviewed branch:

```text
codex/abcabinet-studio-phase-2
HEAD 67ae810
```

Phase 2 delivered the planned project-facing migration:

- Shared `StudioPage`, `StudioPageHeader`, `StudioSection`, `StudioStat`, and `StudioEmptyState`
- Real-data project dashboard
- Studio new-project flow
- Project overview
- Rendering history
- Download action cleanup
- Login redesign
- Error and not-found states
- Removal of the previous rendering download/delete Uiverse CSS
- Updated project workflow labels and tests

### Verification result

The Phase 2 branch is healthy:

```text
npm test
Test Files  57 passed (57)
Tests       337 passed (337)

npx tsc --noEmit
passed

npm run build
passed
```

No Phase 2 repair task is required before starting Phase 3.

### Remaining legacy surfaces found during audit

The following in-scope surfaces still use the pre-Studio light UI or one-off controls:

- `src/features/platform/admin-users-view.tsx`
- `src/features/platform/create-user-form.tsx`
- `src/features/platform/user-status-action.tsx`
- `src/features/platform/user-quota-action.tsx`
- `src/features/platform/user-logs-modal.tsx`
- `src/features/platform/cabinet-colors-admin-view.tsx`
- `src/features/platform/cabinet-colors-manager.tsx`
- `src/features/platform/cabinet-color-form.tsx`
- `src/features/platform/route-skeleton.tsx`

The audit also found:

- `userName` is passed into both Admin views but unused.
- The Users page uses a fixed desktop grid that is not suitable for iPad widths.
- User logs use a hand-built overlay instead of the existing Radix dialog.
- User status and file upload styling still depend on copied Uiverse CSS.
- Status is partly communicated by decorative colored dots.
- Cabinet color editing relies on dense cards and unstyled native controls.
- `RouteSkeleton` still uses the old light `#f5f5f7` surface.
- The Studio shimmer class lives inside Round 1 CSS even though it is now a platform-wide concern.
- Active code still mixes Radix and Lucide icons.

## Phase 3 Scope

### Included

- Admin Users page
- User creation
- User status actions
- User quota editing
- Multi-user deletion mode
- User usage-log dialog
- Admin Cabinet Colors page
- Cabinet-color batch editing
- Add-finish form
- Admin route skeleton
- Shared Studio skeleton cleanup
- Removal of obsolete Uiverse CSS
- Active icon-family cleanup
- Desktop and iPad responsive QA
- Keyboard, focus, contrast, reduced-motion, empty, loading, error, success, and destructive-state QA

### Excluded

- Database schema changes
- New user roles
- New authorization rules
- New quota calculation rules
- New usage-log fields
- Bulk API endpoints
- Object storage or image-host migration
- Changes to cabinet-color rendering behavior
- Phone-optimized Admin editing
- Round 2 product functionality
- Rewriting Round 1 business state

## Behavior Contracts That Must Not Change

### Users

- `/admin/users` remains Admin-only.
- The current Admin cannot disable or delete their own account.
- Create user continues to post to `/api/admin/users`.
- Account conflicts continue to surface from HTTP `409`.
- Password remains required with a minimum length of eight.
- Monthly render quota remains a non-negative integer.
- Status changes continue to patch `/api/admin/users/:id/status`.
- Quota changes continue to put `/api/admin/users/:id/quota`.
- User deletion continues to call `DELETE /api/admin/users/:id`.
- Usage logs continue to load from `/api/admin/users/:id/logs`.
- Disabling or deleting a user keeps the existing repository/session behavior.

### Cabinet colors

- `/admin/cabinet-colors` remains Admin-only.
- The page continues to omit hover images from its initial server payload.
- Existing colors continue to save through one `PUT` per dirty color.
- New colors continue to post to `/api/admin/cabinet-colors`.
- Image uploads remain client-side data URLs.
- Uploads remain capped at 4MB before resize.
- Images remain resized to a maximum dimension of 512px and JPEG quality `0.82`.
- Editing without selecting a new image preserves the stored image.
- Blank AI description continues to fall back to the color name.
- New colors remain active by default.
- Inactive colors remain visible to Admin and hidden from Sales.

## File Map

### Create

- `src/features/platform/admin-presentation.ts`
- `src/features/platform/admin-presentation.test.ts`
- `src/features/platform/admin-users-view.test.tsx`
- `src/features/platform/user-quota-action.test.tsx`
- `src/features/platform/user-logs-dialog.test.tsx`
- `src/features/platform/cabinet-colors-admin-view.test.tsx`
- `src/features/platform/cabinet-colors-manager.test.tsx`
- `src/features/platform/route-skeleton.test.tsx`

### Rename

- `src/features/platform/user-logs-modal.tsx` → `src/features/platform/user-logs-dialog.tsx`

### Modify

- `src/app/(app)/admin/users/page.tsx`
- `src/app/(app)/admin/cabinet-colors/page.tsx`
- `src/app/globals.css`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/cabinet-construction-style-picker.tsx`
- `src/components/ui/ai-chat-input.tsx`
- `src/features/platform/admin-users-view.tsx`
- `src/features/platform/create-user-form.tsx`
- `src/features/platform/create-user-form.test.tsx`
- `src/features/platform/user-status-action.tsx`
- `src/features/platform/user-status-action.test.tsx`
- `src/features/platform/user-quota-action.tsx`
- `src/features/platform/cabinet-colors-admin-view.tsx`
- `src/features/platform/cabinet-colors-manager.tsx`
- `src/features/platform/cabinet-color-form.tsx`
- `src/features/platform/cabinet-color-form.test.tsx`
- `src/features/platform/route-skeleton.tsx`
- `src/features/round1/ghost-loader.css`
- `src/features/round1/rendering-preferences-step.tsx`
- `src/features/platform/platform-header.tsx`

---

## Task 0: Lock the Green Phase 2 Baseline

**Files:**

- No source changes

- [ ] **Step 1: Confirm branch and worktree**

Run:

```bash
git branch --show-current
git status --short
```

Expected:

```text
codex/abcabinet-studio-phase-2
```

The status output must be empty except for this Phase 3 plan if implementation starts before the plan commit is merged.

- [ ] **Step 2: Re-run the Phase 2 baseline**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected:

- 57 test files pass.
- 337 tests pass.
- TypeScript passes.
- Production build passes.

- [ ] **Step 3: Stop on unrelated failures**

Do not redesign around a broken baseline. If any command fails, use `superpowers:systematic-debugging`, determine whether the failure is environmental or a regression, and record the result before continuing.

## Task 1: Add Pure Admin Presentation Helpers

**Files:**

- Create: `src/features/platform/admin-presentation.ts`
- Create: `src/features/platform/admin-presentation.test.ts`

- [ ] **Step 1: Write failing summary and formatting tests**

Create `src/features/platform/admin-presentation.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { CompanyUserSummary, RenderingStat } from "@/server/platform/user-admin-repository";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  cabinetColorSummary,
  formatUsageDate,
  totalUsageCalls,
  userSummary
} from "./admin-presentation";

const users: CompanyUserSummary[] = [
  {
    id: "admin-1",
    companyId: "company-1",
    account: "admin",
    name: "Admin",
    role: "ADMIN",
    monthlyRenderQuota: 100,
    disabledAt: null,
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "sales-1",
    companyId: "company-1",
    account: "sales",
    name: "Sales",
    role: "SALES",
    monthlyRenderQuota: 50,
    disabledAt: "2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-02T00:00:00.000Z"
  }
];

const colors = [
  {
    id: "eu-1",
    companyId: "company-1",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Oak",
    colorCode: null,
    swatchImageUrl: null,
    swatchHex: "#b98b61",
    hoverExampleImageUrl: null,
    promptDescription: "oak",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "us-1",
    companyId: "company-1",
    cabinetStyle: "AMERICAN_FRAMED",
    name: "White",
    colorCode: null,
    swatchImageUrl: null,
    swatchHex: "#ffffff",
    hoverExampleImageUrl: null,
    promptDescription: "white paint",
    active: false,
    sortOrder: 2,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  }
] satisfies CabinetColor[];

describe("admin presentation", () => {
  test("summarizes users from repository data", () => {
    expect(userSummary(users)).toEqual({
      total: 2,
      active: 1,
      disabled: 1,
      admins: 1
    });
  });

  test("summarizes cabinet colors by style and status", () => {
    expect(cabinetColorSummary(colors)).toEqual({
      total: 2,
      active: 1,
      european: 1,
      american: 1
    });
  });

  test("totals usage calls", () => {
    const stats: RenderingStat[] = [
      { date: "2026-06-24T10:00:00.000Z", calls: 3 },
      { date: "2026-06-23T10:00:00.000Z", calls: 2 }
    ];
    expect(totalUsageCalls(stats)).toBe(5);
  });

  test("formats usage dates with a fixed locale and timezone", () => {
    expect(formatUsageDate("2026-06-24T17:30:00.000Z")).toBe(
      "Jun 24, 2026, 10:30 AM"
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/admin-presentation.test.ts
```

Expected: fail because `admin-presentation.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/features/platform/admin-presentation.ts` with:

```ts
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import type {
  CompanyUserSummary,
  RenderingStat
} from "@/server/platform/user-admin-repository";

export function userSummary(users: CompanyUserSummary[]) {
  return {
    total: users.length,
    active: users.filter((user) => user.disabledAt === null).length,
    disabled: users.filter((user) => user.disabledAt !== null).length,
    admins: users.filter((user) => user.role === "ADMIN").length
  };
}

export function cabinetColorSummary(colors: CabinetColor[]) {
  return {
    total: colors.length,
    active: colors.filter((color) => color.active).length,
    european: colors.filter(
      (color) => color.cabinetStyle === "EUROPEAN_FRAMELESS"
    ).length,
    american: colors.filter(
      (color) => color.cabinetStyle === "AMERICAN_FRAMED"
    ).length
  };
}

export function totalUsageCalls(stats: RenderingStat[]) {
  return stats.reduce((sum, stat) => sum + stat.calls, 0);
}

export function formatUsageDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
}
```

The fixed timezone makes server tests deterministic and matches the product's current operating timezone. If the product later supports company timezones, that is a separate domain change.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npx vitest run src/features/platform/admin-presentation.test.ts
git add src/features/platform/admin-presentation.ts src/features/platform/admin-presentation.test.ts
git commit -m "test: add Admin presentation contracts"
```

## Task 2: Redesign the Admin Users Page Frame

**Files:**

- Create: `src/features/platform/admin-users-view.test.tsx`
- Modify: `src/features/platform/admin-users-view.tsx`
- Modify: `src/app/(app)/admin/users/page.tsx`

- [ ] **Step 1: Replace the helper-only test with a page contract**

Rename the current `admin-users-view.test.ts` to `admin-users-view.test.tsx` and test:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { AdminUsersView, canManageUserStatus } from "./admin-users-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

const users: CompanyUserSummary[] = [
  {
    id: "admin-1",
    companyId: "company-1",
    account: "admin",
    name: "Admin",
    role: "ADMIN",
    monthlyRenderQuota: 100,
    disabledAt: null,
    createdAt: "2026-06-01T00:00:00.000Z"
  },
  {
    id: "sales-1",
    companyId: "company-1",
    account: "sales",
    name: "Sales",
    role: "SALES",
    monthlyRenderQuota: 50,
    disabledAt: "2026-06-20T00:00:00.000Z",
    createdAt: "2026-06-02T00:00:00.000Z"
  }
];

describe("AdminUsersView", () => {
  test("renders Studio page structure and real summary counts", () => {
    const html = renderToStaticMarkup(
      <AdminUsersView users={users} currentUserId="admin-1" />
    );

    expect(html).toContain(">Users<");
    expect(html).toContain("Manage access, roles, quotas, and usage.");
    expect(html).toContain(">2<");
    expect(html).toContain(">1<");
    expect(html).toContain("Active");
    expect(html).toContain("Disabled");
    expect(html).toContain("Admins");
    expect(html).toContain("Create user");
    expect(html).toContain("You");
    expect(html).toContain("View usage");
    expect(html).not.toContain("#f5f5f7");
    expect(html).not.toContain("rounded-[18px]");
  });

  test("keeps self-management protection", () => {
    expect(canManageUserStatus("admin-1", "sales-1")).toBe(true);
    expect(canManageUserStatus("admin-1", "admin-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing contract**

Run:

```bash
npx vitest run src/features/platform/admin-users-view.test.tsx
```

Expected: fail on the new Studio structure and removed `userName` prop.

- [ ] **Step 3: Build the page hierarchy**

Refactor `AdminUsersView` to:

- Wrap content in `StudioPage`.
- Use `StudioPageHeader` with:
  - title: `Users`
  - description: `Manage access, roles, quotas, and usage.`
- Render three `StudioStat` values: Active, Disabled, Admins.
- Use `userSummary(users)` for all counts.
- Render the user list inside `StudioSection`.
- Render `CreateUserForm` inside a 360–380px desktop side column.
- Stack the form under the list below `lg`.
- Remove the unused `userName` prop.

Use this outer layout:

```tsx
<StudioPage>
  <StudioPageHeader
    title="Users"
    description="Manage access, roles, quotas, and usage."
    meta={
      <div className="grid max-w-md grid-cols-3 gap-4">
        <StudioStat label="Active" value={summary.active} />
        <StudioStat label="Disabled" value={summary.disabled} tone="warning" />
        <StudioStat label="Admins" value={summary.admins} />
      </div>
    }
  />
  <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
    <StudioSection aria-label="Company users">{userList}</StudioSection>
    <CreateUserForm />
  </div>
</StudioPage>
```

- [ ] **Step 4: Make the user list responsive**

Do not retain the fixed eight-column CSS grid.

Use:

- A semantic `<table>` for `min-width: 1024px`.
- A compact stacked row/card representation for widths below `1024px`.
- One source `users.map(...)` may render both representations, but action logic must remain shared through the existing child components.
- A horizontal scroll fallback is acceptable only for the desktop table, not as the primary iPad experience.

Every user representation must include:

- Name
- `You` label when applicable
- Account
- Role
- Numeric quota
- Text status (`Active` or `Disabled`)
- `View usage` action
- Status control when the target is not the current user

Do not communicate status only with a dot or color.

- [ ] **Step 5: Preserve deletion behavior with clearer interaction**

Keep deletion mode, but:

- Use shared `Checkbox`.
- Use shared `Button` variants.
- Label the entry action `Select users`.
- Show `Cancel` and `Delete selected (N)` only in selection mode.
- Keep the current user unselectable.
- Add `aria-live="polite"` for selection count and deletion errors.
- Collect failed IDs and show one visible error message instead of only calling `console.error`.
- Refresh after all requests settle.
- Do not add a new bulk endpoint.

Use `Promise.allSettled` so one failed delete does not prevent remaining selected deletions:

```ts
const results = await Promise.allSettled(
  Array.from(selectedIds, (id) =>
    fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE"
    })
  )
);

const failed = results.filter(
  (result) => result.status === "rejected" || !result.value.ok
).length;
```

- [ ] **Step 6: Update the route page**

In `src/app/(app)/admin/users/page.tsx`, render:

```tsx
return <AdminUsersView users={users} currentUserId={user.id} />;
```

Do not alter the login or Admin-role redirects.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/admin-users-view.test.tsx \
  src/server/platform/user-admin-repository.test.ts \
  src/app/api/admin/users/route.test.ts
npx tsc --noEmit
git add \
  'src/app/(app)/admin/users/page.tsx' \
  src/features/platform/admin-users-view.tsx \
  src/features/platform/admin-users-view.test.tsx
git commit -m "feat: redesign Studio user administration"
```

## Task 3: Redesign User Creation, Status, and Quota Controls

**Files:**

- Modify: `src/features/platform/create-user-form.tsx`
- Modify: `src/features/platform/create-user-form.test.tsx`
- Modify: `src/features/platform/user-status-action.tsx`
- Modify: `src/features/platform/user-status-action.test.tsx`
- Modify: `src/features/platform/user-quota-action.tsx`
- Create: `src/features/platform/user-quota-action.test.tsx`

- [ ] **Step 1: Expand control tests before implementation**

Update `create-user-form.test.tsx` to additionally require:

```tsx
expect(html).toContain('aria-describedby="create-user-password-hint"');
expect(html).toContain('id="create-user-password-hint"');
expect(html).toContain("At least 8 characters");
expect(html).toContain("Monthly quota");
expect(html).toContain("studio");
expect(html).not.toContain("#1d1d1f");
```

Update `user-status-action.test.tsx`:

```tsx
expect(html).toContain('role="switch"');
expect(html).toContain('aria-checked="true"');
expect(html).toContain('aria-label="Pause Sales"');
```

Pass `userName="Sales"` to the active-user fixture. For a disabled user, require `aria-checked="false"` and `aria-label="Activate Sales"`.

Create `user-quota-action.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { UserQuotaAction, userQuotaEndpoint } from "./user-quota-action";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} })
}));

describe("UserQuotaAction", () => {
  test("renders a labelled quota value and edit action", () => {
    const html = renderToStaticMarkup(
      <UserQuotaAction userId="user-2" userName="Sales" initialQuota={50} />
    );
    expect(html).toContain("50");
    expect(html).toContain('aria-label="Edit Sales monthly quota"');
  });

  test("targets the selected user quota endpoint", () => {
    expect(userQuotaEndpoint("user 2")).toBe(
      "/api/admin/users/user%202/quota"
    );
  });
});
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
npx vitest run \
  src/features/platform/create-user-form.test.tsx \
  src/features/platform/user-status-action.test.tsx \
  src/features/platform/user-quota-action.test.tsx
```

Expected: fail on the new shared-control and accessibility contracts.

- [ ] **Step 3: Refactor `CreateUserForm`**

Use:

- `StudioSection`
- shared `Input`
- shared `Button`
- visible labels above every field
- a styled native `<select>` using Studio token classes
- `aria-busy={busy}` on the form
- `role="alert"` for submission errors
- password helper text linked with `aria-describedby`
- exact field names and API payload already in use

The form title remains `Create user`. Add one concise description:

```text
Create a company account and set its first monthly render allowance.
```

Do not add email, personal name, invitation, or temporary-password behavior.

- [ ] **Step 4: Replace the Uiverse status switch**

Implement `UserStatusAction` as a 44px minimum target button with:

```tsx
<button
  type="button"
  role="switch"
  aria-checked={!disabled}
  aria-label={`${disabled ? "Activate" : "Pause"} ${userName}`}
  disabled={busy}
  onClick={updateStatus}
>
  <span aria-hidden />
</button>
```

Style with Studio tokens and data attributes:

- `data-state="active"` or `data-state="disabled"`
- no hidden native input
- no global CSS selector
- transform/opacity transitions only
- no movement under reduced motion
- visible focus ring

Keep `userStatusEndpoint` and the existing request body.

- [ ] **Step 5: Refactor quota editing**

Add:

```ts
export function userQuotaEndpoint(userId: string) {
  return `/api/admin/users/${encodeURIComponent(userId)}/quota`;
}
```

Add `userName` to the component props for accessible labels.

In read mode:

- Render the quota with tabular numerals.
- Use a ghost icon/text button labelled `Edit {userName} monthly quota`.

In edit mode:

- Use shared `Input` with `type="number"`, `min={0}`, and an accessible label.
- Use shared `Button` for Save and Cancel.
- Preserve the current validation and endpoint.
- Connect errors with `aria-describedby` and render them with `role="alert"`.
- Keep Cancel restoring `initialQuota`.

- [ ] **Step 6: Pass user names from the Users page**

Update calls:

```tsx
<UserQuotaAction
  userId={user.id}
  userName={user.name}
  initialQuota={user.monthlyRenderQuota}
/>

<UserStatusAction
  userId={user.id}
  userName={user.name}
  disabled={user.disabledAt !== null}
/>
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/admin-users-view.test.tsx \
  src/features/platform/create-user-form.test.tsx \
  src/features/platform/user-status-action.test.tsx \
  src/features/platform/user-quota-action.test.tsx
npx tsc --noEmit
git add \
  src/features/platform/admin-users-view.tsx \
  src/features/platform/create-user-form.tsx \
  src/features/platform/create-user-form.test.tsx \
  src/features/platform/user-status-action.tsx \
  src/features/platform/user-status-action.test.tsx \
  src/features/platform/user-quota-action.tsx \
  src/features/platform/user-quota-action.test.tsx
git commit -m "feat: refine Admin user controls"
```

## Task 4: Replace the Usage Modal with an Accessible Dialog

**Files:**

- Rename: `src/features/platform/user-logs-modal.tsx` → `src/features/platform/user-logs-dialog.tsx`
- Create: `src/features/platform/user-logs-dialog.test.tsx`
- Modify: `src/features/platform/admin-users-view.tsx`

- [ ] **Step 1: Write the dialog contract**

Create `user-logs-dialog.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { UsageLogContent } from "./user-logs-dialog";

describe("UserLogsDialog", () => {
  test("renders accessible loading content", () => {
    const html = renderToStaticMarkup(
      <UsageLogContent
        userName="Sales"
        stats={null}
        error={null}
      />
    );

    expect(html).toContain("Usage for Sales");
    expect(html).toContain("Rendering API calls by date.");
    expect(html).toContain("Loading usage");
    expect(html).not.toContain("<svg xmlns=");
    expect(html).not.toContain("animate-spin");
  });

  test("uses the shared Radix dialog primitives", () => {
    const source = readFileSync(
      new URL("./user-logs-dialog.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("<Dialog ");
    expect(source).toContain("<DialogContent");
    expect(source).toContain("<DialogTitle");
    expect(source).toContain("<DialogDescription");
    expect(source).toContain("<DialogClose");
    expect(source).toContain('aria-label="Close usage dialog"');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/user-logs-dialog.test.tsx
```

Expected: fail because the renamed dialog component does not exist.

- [ ] **Step 3: Implement with existing Radix primitives**

Use:

- `Dialog`
- `DialogContent`
- `DialogTitle`
- `DialogDescription`
- `DialogClose`
- Radix `Cross2Icon`
- `totalUsageCalls`
- `formatUsageDate`

Export a presentational `UsageLogContent` component with:

```ts
{
  userName: string;
  stats: RenderingStat[] | null;
  error: string | null;
}
```

This keeps loading, error, empty, and success markup testable without relying on
portal rendering in a server-markup test. `UserLogsDialog` owns the Radix root,
open state, close control, and data fetching.

The component API must be:

```ts
{
  open: boolean;
  userId: string;
  userName: string;
  onOpenChange: (open: boolean) => void;
}
```

Render these states:

- Loading: three non-pulsing or reduced-motion-safe skeleton rows plus `Loading usage`.
- Error: visible `role="alert"` message.
- Empty: `No rendering usage yet`.
- Success: total calls plus a semantic table with Date and Calls columns.

Use a maximum width around 640px, a max viewport height, and internal scrolling. Let Radix handle Escape, focus trap, outside click, and focus return.

Do not keep the custom fixed overlay or hand-written SVG.

- [ ] **Step 4: Avoid stale requests**

Inside `useEffect`, use `AbortController` and reset state when the dialog opens for a different user:

```ts
useEffect(() => {
  if (!open) return;
  const controller = new AbortController();
  setStats(null);
  setError(null);

  fetch(`/api/admin/users/${encodeURIComponent(userId)}/logs`, {
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Unable to load usage.");
      return response.json() as Promise<RenderingStat[]>;
    })
    .then(setStats)
    .catch((cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to load usage.");
    });

  return () => controller.abort();
}, [open, userId]);
```

- [ ] **Step 5: Wire the Users page**

Replace conditional modal mounting with:

```tsx
{viewingLogsUser && (
  <UserLogsDialog
    open
    userId={viewingLogsUser.id}
    userName={viewingLogsUser.name}
    onOpenChange={(open) => {
      if (!open) setViewingLogsUser(null);
    }}
  />
)}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/admin-presentation.test.ts \
  src/features/platform/user-logs-dialog.test.tsx \
  src/features/platform/admin-users-view.test.tsx
npx tsc --noEmit
git add \
  src/features/platform/admin-users-view.tsx \
  src/features/platform/user-logs-dialog.tsx \
  src/features/platform/user-logs-dialog.test.tsx
git rm src/features/platform/user-logs-modal.tsx
git commit -m "feat: add accessible user usage dialog"
```

## Task 5: Redesign the Cabinet Colors Page Frame

**Files:**

- Create: `src/features/platform/cabinet-colors-admin-view.test.tsx`
- Modify: `src/features/platform/cabinet-colors-admin-view.tsx`
- Modify: `src/app/(app)/admin/cabinet-colors/page.tsx`

- [ ] **Step 1: Write the page contract**

Create `cabinet-colors-admin-view.test.tsx` with one European active fixture and one American inactive fixture. Require:

```tsx
expect(html).toContain(">Cabinet colors<");
expect(html).toContain("Manage the finish library used by Rendering Preferences.");
expect(html).toContain("Active");
expect(html).toContain("European");
expect(html).toContain("American");
expect(html).toContain("Add finish");
expect(html).toContain("Oak");
expect(html).toContain("White");
expect(html).not.toContain("#f5f5f7");
expect(html).not.toContain("rounded-[18px]");
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/cabinet-colors-admin-view.test.tsx
```

- [ ] **Step 3: Build the Studio page hierarchy**

Refactor `CabinetColorsAdminView` to:

- Remove `userName`.
- Use `StudioPage`.
- Use `StudioPageHeader`.
- Use `cabinetColorSummary(colors)`.
- Show Active, European, and American stats.
- Keep the manager plus add form desktop split.
- Stack the add form below the manager on iPad portrait.

Use:

```tsx
<StudioPage>
  <StudioPageHeader
    title="Cabinet colors"
    description="Manage the finish library used by Rendering Preferences."
    meta={
      <div className="grid max-w-lg grid-cols-3 gap-4">
        <StudioStat label="Active" value={summary.active} tone="action" />
        <StudioStat label="European" value={summary.european} />
        <StudioStat label="American" value={summary.american} />
      </div>
    }
  />
  <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <CabinetColorsManager colors={colors} />
    <CabinetColorForm />
  </div>
</StudioPage>
```

- [ ] **Step 4: Update the route page**

Render:

```tsx
return <CabinetColorsAdminView colors={colors} />;
```

Keep:

```ts
includeHoverExampleImages: false
```

This payload optimization is intentional and must not be removed during the visual refactor.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/cabinet-colors-admin-view.test.tsx \
  src/features/platform/admin-presentation.test.ts
npx tsc --noEmit
git add \
  'src/app/(app)/admin/cabinet-colors/page.tsx' \
  src/features/platform/cabinet-colors-admin-view.tsx \
  src/features/platform/cabinet-colors-admin-view.test.tsx
git commit -m "feat: redesign Studio cabinet color administration"
```

## Task 6: Refactor Cabinet Color Batch Editing

**Files:**

- Create: `src/features/platform/cabinet-colors-manager.test.tsx`
- Modify: `src/features/platform/cabinet-colors-manager.tsx`

- [ ] **Step 1: Expose and test draft logic**

Export `toDraft`, `buildDrafts`, and `isDirty`.

Create `cabinet-colors-manager.test.tsx` covering:

- A fresh draft is not dirty.
- Changing name is dirty.
- Changing style is dirty.
- Changing active is dirty.
- Selecting either image is dirty.
- Existing server previews do not count as newly selected images.
- Markup contains `No unsaved changes`.
- Markup contains the full text status `Active` or `Inactive`.
- Image `alt` includes the color name.
- Markup contains no legacy hardcoded hex classes.

Use the same `CabinetColor` fixture shape already used in `cabinet-color-form.test.tsx`.

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/cabinet-colors-manager.test.tsx
```

- [ ] **Step 3: Refactor the manager structure**

Use:

- `StudioSection` for each style group.
- A sticky save bar styled with Studio tokens.
- shared `Input`, `Checkbox`, and `Button`.
- styled native `<select>` and `<textarea>` with the same token contract as `Input`.
- shared file-input styling through `Input type="file"`.

Each finish card must show:

- Swatch preview or fallback color
- Finish name
- Full `Active` or `Inactive` text badge
- `Unsaved` badge when dirty
- Cabinet style
- Swatch upload
- Optional hover-example upload
- AI description

Remove decorative status dots. Use a text badge plus icon only if the icon is redundant.

- [ ] **Step 4: Improve empty and save states**

For each empty style group, use `StudioEmptyState` with:

```text
No European finishes
Add the first European finish with the form.
```

or:

```text
No American finishes
Add the first American finish with the form.
```

The save bar must:

- Show `No unsaved changes` when clean.
- Show `{N} unsaved change(s)` when dirty.
- Disable Save while clean or busy.
- Preserve button width while showing `Saving…`.
- Show request errors with `role="alert"`.
- Show `Changes saved` briefly through an `aria-live="polite"` status after success.

Keep one request per dirty color and the current payload builder.

- [ ] **Step 5: Guard image size in both editor paths**

The manager currently calls `resizeImageToDataUrl` without checking the 4MB cap used by the add form.

Export:

```ts
export const MAX_CABINET_IMAGE_BYTES = 4 * 1024 * 1024;
```

from `cabinet-color-form.tsx`, import it in the manager, and reject oversized manager uploads with the same message:

```text
Image is too large. Please choose an image under 4MB.
```

This is a consistency fix, not a new product rule.

- [ ] **Step 6: Make previews accessible**

For real previews, use:

```tsx
alt={`${draft.name || color.name} swatch`}
```

For hover previews:

```tsx
alt={`${draft.name || color.name} kitchen example`}
```

Do not use empty alt text for content the Admin is explicitly editing.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/cabinet-colors-manager.test.tsx \
  src/features/platform/cabinet-color-form.test.tsx \
  src/server/platform/cabinet-color-repository.test.ts
npx tsc --noEmit
git add \
  src/features/platform/cabinet-colors-manager.tsx \
  src/features/platform/cabinet-colors-manager.test.tsx \
  src/features/platform/cabinet-color-form.tsx
git commit -m "feat: refine cabinet color batch editing"
```

## Task 7: Refactor the Add Finish Form

**Files:**

- Modify: `src/features/platform/cabinet-color-form.tsx`
- Modify: `src/features/platform/cabinet-color-form.test.tsx`

- [ ] **Step 1: Expand form contracts**

Add assertions:

```tsx
expect(html).toContain("Add finish");
expect(html).toContain("Images are resized before upload");
expect(html).toContain('accept="image/*"');
expect(html).toContain('aria-describedby="swatch-upload-hint"');
expect(html).toContain('id="swatch-upload-hint"');
expect(html).not.toContain("uiverse-file-input");
expect(html).not.toContain("#1d1d1f");
```

Keep all existing payload tests unchanged.

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/cabinet-color-form.test.tsx
```

- [ ] **Step 3: Use shared Studio controls**

Refactor the form to use:

- `StudioSection`
- shared `Input`
- shared `Checkbox` when editing
- shared `Button`
- tokenized native `<select>` and `<textarea>`
- `role="alert"` for errors
- `aria-busy={busy}`

Add this helper text below the swatch field:

```text
Images are resized before upload. Maximum source size: 4MB.
```

Link it to both file inputs through `aria-describedby`.

- [ ] **Step 4: Preserve image behavior**

Do not change:

- `buildCabinetColorPayload`
- client-side resize dimensions
- JPEG quality
- create versus edit omission semantics
- post-save reset behavior

Reset the native file inputs after a successful create by assigning a form ref and calling `form.reset()` only after the controlled state has been reset. Verify the controlled role/style value remains correct.

- [ ] **Step 5: Improve preview fallbacks**

When no image exists, show a labelled neutral preview:

```text
No swatch
```

and:

```text
No example
```

Do not leave an unexplained blank rectangle.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npx vitest run \
  src/features/platform/cabinet-color-form.test.tsx \
  src/features/platform/cabinet-colors-manager.test.tsx
npx tsc --noEmit
git add \
  src/features/platform/cabinet-color-form.tsx \
  src/features/platform/cabinet-color-form.test.tsx
git commit -m "feat: redesign Studio finish form"
```

## Task 8: Finish Shared Skeleton and Loading States

**Files:**

- Create: `src/features/platform/route-skeleton.test.tsx`
- Modify: `src/features/platform/route-skeleton.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/features/round1/ghost-loader.css`

- [ ] **Step 1: Write the route skeleton contract**

Create `route-skeleton.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { RouteSkeleton } from "./route-skeleton";

describe("RouteSkeleton", () => {
  test.each(["dashboard", "detail", "table", "plain", "round1"] as const)(
    "renders the %s variant in the Studio system",
    (variant) => {
      const html = renderToStaticMarkup(<RouteSkeleton variant={variant} />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("bg-studio-void");
      expect(html).toContain("studio-skeleton");
      expect(html).not.toContain("#f5f5f7");
      expect(html).not.toContain("#d2d2d7");
    }
  );
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/features/platform/route-skeleton.test.tsx
```

- [ ] **Step 3: Move shared shimmer CSS**

Move `.studio-skeleton`, its keyframes, and reduced-motion rule from:

```text
src/features/round1/ghost-loader.css
```

to:

```text
src/app/globals.css
```

Keep only Round 1-specific loader styling in `ghost-loader.css`.

- [ ] **Step 4: Refactor all skeleton variants**

`RouteSkeleton` must:

- Use `StudioPage` or equivalent Studio-token page structure.
- Use `bg-studio-void`, `bg-studio-shell`, `border-studio-line`, and tokenized radii.
- Use `.studio-skeleton`, not `animate-pulse`.
- Honor reduced motion through the shared CSS.
- Implement the currently declared `round1` variant instead of silently rendering no body.
- Provide an Admin table skeleton that resembles the Phase 3 Users page.
- Keep `aria-busy`.
- Add visually hidden loading text appropriate to the variant.

- [ ] **Step 5: Verify all loading route consumers**

Run:

```bash
rg -n 'RouteSkeleton variant=' src/app
npx vitest run src/features/platform/route-skeleton.test.tsx
npx tsc --noEmit
git add \
  src/app/globals.css \
  src/features/platform/route-skeleton.tsx \
  src/features/platform/route-skeleton.test.tsx \
  src/features/round1/ghost-loader.css
git commit -m "refactor: unify Studio route skeletons"
```

## Task 9: Remove Obsolete One-Off Styling and Unify Active Icons

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/components/ui/cabinet-construction-style-picker.tsx`
- Modify: `src/components/ui/ai-chat-input.tsx`
- Modify: `src/features/round1/rendering-preferences-step.tsx`
- Modify: `src/features/platform/platform-header.tsx`

- [ ] **Step 1: Confirm legacy selectors have no consumers**

Run:

```bash
rg -n "user-status-switch|user-status-slider|uiverse-file-input" src
```

Expected after Tasks 3 and 7: only definitions in `globals.css`.

- [ ] **Step 2: Delete obsolete Uiverse CSS**

Remove the complete blocks beginning with:

```css
/* From Uiverse.io by WhiteNervosa */
```

and:

```css
/* From Uiverse.io by SpatexDEV */
```

No replacement global selectors should be added.

- [ ] **Step 3: Replace active Lucide imports with Radix icons**

Replace:

- Dropdown `Check`, `ChevronRight`, and `Circle`
- Construction picker `Check` and `LockKeyhole`
- AI chat `Lightbulb`, `Globe`, `Paperclip`, and `Send`
- Rendering preferences `Info` and image icon
- Platform header `User`

with the closest icons from `@radix-ui/react-icons`.

For microphone, if Radix has no semantically suitable icon in the installed package, use a compact local CSS/HTML microphone glyph only if it remains accessible and visually consistent; otherwise retain that single Lucide icon and document it in the final audit. Do not introduce another icon package.

Keep visible button labels and `aria-label` values unchanged.

- [ ] **Step 4: Preserve the active Round 1 header**

`platform-header.tsx` is still used by `showroom-intake-app.tsx`; do not delete it. Only migrate its icon and remove any style that conflicts with the Studio project bar.

- [ ] **Step 5: Add source-level cleanup assertions**

Run:

```bash
if rg -n "user-status-switch|user-status-slider|uiverse-file-input" src; then
  exit 1
fi

rg -n "from ['\"]lucide-react['\"]" src
```

Expected:

- No Uiverse selectors remain.
- No Lucide imports remain, or only the explicitly documented microphone exception remains.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
npx tsc --noEmit
git add \
  src/app/globals.css \
  src/components/ui/dropdown-menu.tsx \
  src/components/ui/cabinet-construction-style-picker.tsx \
  src/components/ui/ai-chat-input.tsx \
  src/features/round1/rendering-preferences-step.tsx \
  src/features/platform/platform-header.tsx
git commit -m "refactor: remove obsolete UI styling"
```

## Task 10: Desktop and iPad Browser QA

**Files:**

- Modify only files required by defects found during QA

- [ ] **Step 1: Start the application**

Run:

```bash
npm run dev
```

Use `browser:control-in-app-browser` for local browser verification.

- [ ] **Step 2: Verify Admin Users on desktop**

At approximately `1440 × 900`, verify:

- Studio rail remains persistent.
- Users title and operational counts are visible without scrolling.
- User list and Create user form have a clear hierarchy.
- Long accounts do not overlap actions.
- Current user is clearly marked.
- Current user cannot be selected, disabled, or deleted.
- Status uses both text and control state.
- Quota edit does not shift the whole row.
- View usage opens a focused dialog.
- Escape closes the dialog and returns focus.
- Delete selection count updates.
- Failed deletion has visible feedback.

- [ ] **Step 3: Verify Admin Users on iPad**

At:

```text
1024 × 768 landscape
820 × 1180 portrait
```

Verify:

- No horizontal page overflow.
- Touch targets are at least 44px.
- User data remains readable without a compressed eight-column grid.
- The create form stacks in portrait.
- Dialog content stays inside the viewport.
- Quota and status actions are reachable by touch and keyboard.

- [ ] **Step 4: Verify Cabinet Colors on desktop**

Verify:

- Counts match real loaded colors.
- Save bar stays visible without covering content.
- Dirty state is visible in text.
- Editing two colors produces a count of two.
- Successful save clears dirty state.
- Failed save preserves unsaved edits and shows an error.
- European and American sections are easy to scan.
- Active and inactive states do not depend only on color.
- Swatch and hover uploads show meaningful previews.
- Add finish resets after success.
- Oversized files are rejected before resize in both add and edit paths.

- [ ] **Step 5: Verify Cabinet Colors on iPad**

At `1024 × 768` and `820 × 1180`, verify:

- Cards do not become unusably narrow.
- The add form stacks below the manager where needed.
- File inputs remain tappable.
- Sticky save controls do not collide with the rail or viewport edge.
- Textareas and selects retain usable widths.
- No hover-only information is required.

- [ ] **Step 6: Verify motion and reduced motion**

With normal motion:

- Button press feedback is brief and restrained.
- Dialog transition is 150–200ms.
- Status-switch motion confirms state without overshoot.

With `prefers-reduced-motion: reduce`:

- Skeleton shimmer is disabled.
- Switch movement is immediate.
- Dialog remains usable without scale animation.
- No perpetual spinner remains in the Admin flow.

- [ ] **Step 7: Verify keyboard and focus**

Keyboard-only:

- Reach every Admin navigation item.
- Reach every field and action in logical order.
- Open and close usage dialog.
- Edit and cancel quota.
- Toggle status.
- Enter and exit selection mode.
- Select users with Space.
- Save cabinet-color changes.
- Add a finish.

Every interactive element must have a visible focus indicator.

- [ ] **Step 8: Capture QA evidence**

Save screenshots under:

```text
docs/qa/phase-3/
```

Required files:

```text
users-desktop.png
users-ipad-landscape.png
users-ipad-portrait.png
user-usage-dialog.png
cabinet-colors-desktop.png
cabinet-colors-ipad-portrait.png
```

Do not commit screenshots containing real passwords, private customer data, or production credentials.

- [ ] **Step 9: Commit QA fixes**

After each defect fix, rerun its focused test. Then:

```bash
git add -u src/app src/components src/features
git commit -m "fix: polish Phase 3 responsive states"
```

Skip this commit if QA requires no source changes.

## Task 11: Final Accessibility and Regression Verification

**Files:**

- Modify only files required by discovered defects

- [ ] **Step 1: Run focused Admin tests**

Run:

```bash
npx vitest run \
  src/features/platform/admin-presentation.test.ts \
  src/features/platform/admin-users-view.test.tsx \
  src/features/platform/create-user-form.test.tsx \
  src/features/platform/user-status-action.test.tsx \
  src/features/platform/user-quota-action.test.tsx \
  src/features/platform/user-logs-dialog.test.tsx \
  src/features/platform/cabinet-colors-admin-view.test.tsx \
  src/features/platform/cabinet-colors-manager.test.tsx \
  src/features/platform/cabinet-color-form.test.tsx \
  src/features/platform/route-skeleton.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run API and repository regressions**

Run:

```bash
npx vitest run \
  src/server/platform/user-admin-repository.test.ts \
  src/server/platform/cabinet-color-repository.test.ts \
  src/app/api/admin/users/route.test.ts
```

Also run every status, quota, logs, delete, and cabinet-color API test discovered by:

```bash
rg --files src/app/api/admin | rg '\\.test\\.(ts|tsx)$'
```

- [ ] **Step 3: Run the complete suite**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected:

- All tests pass.
- TypeScript passes.
- Production build passes.
- Admin routes appear in the generated route list.

- [ ] **Step 4: Run cleanup audits**

Run:

```bash
if rg -n "user-status-switch|user-status-slider|uiverse-file-input" src; then
  exit 1
fi

if rg -n '#f5f5f7|#d2d2d7|#0066cc|rounded-\\[18px\\]' \
  src/features/platform/admin-users-view.tsx \
  src/features/platform/create-user-form.tsx \
  src/features/platform/user-status-action.tsx \
  src/features/platform/user-quota-action.tsx \
  src/features/platform/user-logs-dialog.tsx \
  src/features/platform/cabinet-colors-admin-view.tsx \
  src/features/platform/cabinet-colors-manager.tsx \
  src/features/platform/cabinet-color-form.tsx \
  src/features/platform/route-skeleton.tsx; then
  exit 1
fi

rg -n "from ['\"]lucide-react['\"]" src
```

Expected:

- No obsolete Uiverse selectors.
- No old hardcoded platform surface colors in Phase 3 files.
- No arbitrary old panel radius in Phase 3 files.
- No unexplained mixed icon-family imports.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -12
```

Review for:

- No API contract changes.
- No authorization changes.
- No schema changes.
- No accidental removal of image resize logic.
- No loss of current-user protections.
- No uncommitted generated artifacts.

- [ ] **Step 6: Request code review**

Use `superpowers:requesting-code-review`.

The review must specifically check:

- Self-disable and self-delete protection
- Partial delete failure behavior
- Dialog focus management and aborted fetches
- Quota validation
- Dirty-state correctness
- Image-size validation in both upload paths
- iPad layout
- reduced-motion behavior
- absence of obsolete global styling

- [ ] **Step 7: Commit final fixes**

If review or verification finds defects:

```bash
git add -u src/app src/components src/features
git commit -m "fix: complete Studio Phase 3 review"
```

Then rerun:

```bash
npm test
npx tsc --noEmit
npm run build
```

## Acceptance Checklist

Phase 3 is complete only when:

- [ ] Users uses the Studio page system.
- [ ] User list is readable on desktop and iPad.
- [ ] User creation uses shared controls and accessible errors.
- [ ] Current Admin cannot disable or delete themselves.
- [ ] Status control has visible text, focus, and switch semantics.
- [ ] Quota editing preserves its existing endpoint and validation.
- [ ] Usage logs use an accessible Radix dialog.
- [ ] Usage dialog supports loading, error, empty, and success states.
- [ ] Cabinet Colors uses the Studio page system.
- [ ] Batch editing preserves all existing dirty and save behavior.
- [ ] Both color upload paths enforce the existing 4MB rule.
- [ ] Add Finish preserves resize and payload behavior.
- [ ] Route skeletons use Studio tokens and reduced-motion-safe shimmer.
- [ ] Obsolete Uiverse CSS is removed.
- [ ] Active product code uses one approved icon family, with any exception documented.
- [ ] Desktop and iPad screenshots are reviewed.
- [ ] Keyboard navigation and focus return are verified.
- [ ] Contrast and touch targets meet the approved design spec.
- [ ] All tests, TypeScript, and production build pass.
- [ ] No route, API, schema, role, quota rule, or rendering behavior changed.

## Recommended Execution Order

```text
Task 0  Baseline
Task 1  Pure presentation helpers
Task 2  Users page
Task 3  User controls
Task 4  Usage dialog
Task 5  Cabinet Colors page
Task 6  Batch editor
Task 7  Add Finish form
Task 8  Skeletons
Task 9  CSS and icon cleanup
Task 10 Browser QA
Task 11 Final verification and review
```

Tasks 2–4 share the Users page and should be executed sequentially. Tasks 5–7 share cabinet-color state and should also be sequential. Task 8 can run independently after Task 1. Task 9 must wait until the control migrations are complete so obsolete selectors have no consumers.
