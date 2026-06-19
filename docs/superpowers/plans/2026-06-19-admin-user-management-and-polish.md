# Admin User Management + Light Real-Use Polish — Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run the listed test/tsc/build after each task and commit per task.

**Context:** Module 1 is deployed on Railway and the core flow works (login → create project → Round 1 intake → snapshot persisted → reload restores). The chosen next direction is **real-use validation + light polish** (see `ai_ctx.md` "Active Work"). This plan delivers the single biggest blocker to real use — self-service account creation for admins — plus a few low-risk polish items that any first-time user benefits from.

**Goal:** Let an ADMIN create and view company users from the web UI (no more editing the Railway pre-deploy command to add a salesperson), and apply small copy/responsiveness/empty-state polish.

**Guardrails (do NOT cross):**
- No pricing/quote features.
- No production-style cabinet editing, cabinet codes, or dimension strings in the Round 1 UI.
- No Module 2 work.
- No broad UI redesign — keep polish limited to copy clarity, responsiveness, empty states, and auth error codes.
- Reuse existing platform primitives (`hashPassword`, `requireUser`, `requireRole`, `query`); do not invent a new auth mechanism.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind, Zod, Vitest, PostgreSQL via the existing `@/server/db/client`.

---

## Scope Check

In scope: an ADMIN-only `/admin/users` page (list + create), the backing API + repository, a dashboard link visible only to admins, and four small polish items. Out of scope: editing/disabling/deleting users (view + create only for this pass), password reset flows, email invitations, per-user audit, and self-service signup. Those can come later if real use demands them.

## Pre-flight

- [ ] **Step 0: Branch from up-to-date main**

```bash
git checkout main
git pull
git checkout -b feat/admin-user-management
```

Confirm baseline is green before changing anything:

```bash
npm test
npx tsc --noEmit
```

## File Structure

Create:
- `src/server/platform/user-admin-repository.ts` — list/create company users.
- `src/server/platform/user-admin-repository.test.ts` — pure mapper/validation tests.
- `src/app/api/admin/users/route.ts` — `GET` list + `POST` create (ADMIN only).
- `src/app/admin/users/page.tsx` — admin users page (server component, ADMIN gate).
- `src/features/platform/admin-users-view.tsx` — user list (server-renderable).
- `src/features/platform/create-user-form.tsx` — client create form.
- `src/features/platform/create-user-form.test.tsx` — markup test.

Modify:
- `src/features/platform/project-dashboard.tsx` — add an "Admin" / "Users" link shown only when `user.role === "ADMIN"`.
- `src/features/platform/login-form.tsx` — brand from `NEXT_PUBLIC_COMPANY_NAME` with fallback.
- `ai_ctx.md` — add a concise Done entry after verification.

---

## Task 1: User Admin Repository

**Files:**
- Create: `src/server/platform/user-admin-repository.ts`
- Create: `src/server/platform/user-admin-repository.test.ts`

- [ ] **Step 1: Write the mapper/validation test (expect fail)**

Create `src/server/platform/user-admin-repository.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mapCompanyUserRow, isAssignableRole } from "./user-admin-repository";

describe("user admin helpers", () => {
  test("maps a user row to a safe summary (no password hash)", () => {
    const user = mapCompanyUserRow({
      id: "u1",
      email: "sales@example.com",
      name: "Sales One",
      role: "SALES",
      disabled_at: null,
      created_at: new Date("2026-06-19T00:00:00.000Z")
    });
    expect(user).toEqual({
      id: "u1",
      email: "sales@example.com",
      name: "Sales One",
      role: "SALES",
      disabledAt: null,
      createdAt: "2026-06-19T00:00:00.000Z"
    });
    expect("passwordHash" in user).toBe(false);
  });

  test("only allows the three known roles", () => {
    expect(isAssignableRole("ADMIN")).toBe(true);
    expect(isAssignableRole("SALES")).toBe(true);
    expect(isAssignableRole("DESIGNER")).toBe(true);
    expect(isAssignableRole("OWNER")).toBe(false);
  });
});
```

Run: `npm test -- src/server/platform/user-admin-repository.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement the repository**

Create `src/server/platform/user-admin-repository.ts`:

```ts
import { query } from "@/server/db/client";
import { hashPassword } from "./passwords";
import type { UserRole } from "./types";

export type CompanyUserSummary = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabledAt: string | null;
  createdAt: string;
};

type CompanyUserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabled_at: Date | null;
  created_at: Date;
};

const ASSIGNABLE_ROLES: UserRole[] = ["ADMIN", "SALES", "DESIGNER"];

export function isAssignableRole(role: string): role is UserRole {
  return (ASSIGNABLE_ROLES as string[]).includes(role);
}

export function mapCompanyUserRow(row: CompanyUserRow): CompanyUserSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    disabledAt: row.disabled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  };
}

export async function listCompanyUsers(companyId: string) {
  const result = await query<CompanyUserRow>(
    `SELECT id, email, name, role, disabled_at, created_at
     FROM users
     WHERE company_id = $1
     ORDER BY created_at ASC`,
    [companyId]
  );
  return result.rows.map(mapCompanyUserRow);
}

export class EmailAlreadyExistsError extends Error {}

export async function createCompanyUser(input: {
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const result = await query<CompanyUserRow>(
    `INSERT INTO users (company_id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, name, role, disabled_at, created_at`,
    [input.companyId, input.email, input.name, passwordHash, input.role]
  );
  const row = result.rows[0];
  if (!row) throw new EmailAlreadyExistsError("Email already in use");
  return mapCompanyUserRow(row);
}
```

- [ ] **Step 3: Run test → PASS**, then `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add src/server/platform/user-admin-repository.ts src/server/platform/user-admin-repository.test.ts
git commit -m "feat(platform): add company user admin repository"
```

## Task 2: Admin Users API (ADMIN-only, correct status codes)

**Files:**
- Create: `src/app/api/admin/users/route.ts`

This route also fixes the auth-status-code rough edge for itself: unauthenticated → 401, wrong role → 403 (not 500).

- [ ] **Step 1: Implement the route**

Create `src/app/api/admin/users/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ForbiddenError,
  requireRole,
  requireUser,
  UnauthorizedError
} from "@/server/platform/auth-service";
import {
  createCompanyUser,
  EmailAlreadyExistsError,
  isAssignableRole,
  listCompanyUsers
} from "@/server/platform/user-admin-repository";

const createSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  role: z.string().refine(isAssignableRole, "Unknown role"),
  password: z.string().min(8)
});

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    return NextResponse.json({ users: await listCompanyUsers(user.companyId) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Unable to list users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = createSchema.parse(await request.json());
    const created = await createCompanyUser({
      companyId: user.companyId,
      email: input.email,
      name: input.name,
      role: input.role,
      password: input.password
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid user request", issues: error.issues }, { status: 400 });
    }
    if (error instanceof EmailAlreadyExistsError) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create user" }, { status: 500 });
  }
}
```

- [ ] **Step 2: `npx tsc --noEmit`** → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts
git commit -m "feat(platform): add admin users API"
```

## Task 3: Admin Users Page + Create Form

**Files:**
- Create: `src/features/platform/admin-users-view.tsx`
- Create: `src/features/platform/create-user-form.tsx`
- Create: `src/features/platform/create-user-form.test.tsx`
- Create: `src/app/admin/users/page.tsx`
- Modify: `src/features/platform/project-dashboard.tsx`

- [ ] **Step 1: Markup test for the create form (expect fail)**

Create `src/features/platform/create-user-form.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CreateUserForm } from "./create-user-form";

describe("CreateUserForm", () => {
  test("renders email, name, role, password fields", () => {
    const html = renderToStaticMarkup(<CreateUserForm />);
    expect(html).toContain("Email");
    expect(html).toContain("Name");
    expect(html).toContain("Role");
    expect(html).toContain("Temporary password");
    expect(html).toContain("SALES");
    expect(html).toContain("DESIGNER");
    expect(html).toContain("Create user");
  });
});
```

- [ ] **Step 2: Create the client form**

Create `src/features/platform/create-user-form.tsx` — a `"use client"` form with controlled inputs for `email`, `name`, a `role` `<select>` (`SALES` / `DESIGNER` / `ADMIN`, default `SALES`), and a `password` (min 8) field. On submit `POST /api/admin/users`; on success `window.location.reload()` (so the server-rendered list refreshes); on 409 show "Email already in use"; on other errors show a generic message. Disable submit while busy or when required fields are empty. Match the visual style of `login-form.tsx` / `new-project-form.tsx` (stone palette, rounded borders).

- [ ] **Step 3: Create the list view**

Create `src/features/platform/admin-users-view.tsx` (plain server-renderable component):

```tsx
import Link from "next/link";
import type { CompanyUserSummary } from "@/server/platform/user-admin-repository";
import { CreateUserForm } from "./create-user-form";

export function AdminUsersView({ users }: { users: CompanyUserSummary[] }) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-4xl">
        <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
        <h1 className="mt-4 text-2xl font-semibold">Users</h1>
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded border border-stone-300 bg-white">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-3 gap-4 border-b border-stone-200 px-4 py-3 text-sm last:border-b-0">
                <span className="font-medium">{u.name}</span>
                <span className="truncate text-stone-600">{u.email}</span>
                <span className="text-right">{u.role}</span>
              </div>
            ))}
            {users.length === 0 && <p className="px-4 py-8 text-sm text-stone-600">No users yet.</p>}
          </div>
          <CreateUserForm />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create the page (ADMIN gate)**

Create `src/app/admin/users/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AdminUsersView } from "@/features/platform/admin-users-view";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listCompanyUsers } from "@/server/platform/user-admin-repository";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/projects");
  const users = await listCompanyUsers(user.companyId);
  return <AdminUsersView users={users} />;
}
```

- [ ] **Step 5: Link from the dashboard (admins only)**

In `src/features/platform/project-dashboard.tsx`, inside the header action group, render a `Users` link only when `user.role === "ADMIN"`:

```tsx
{user.role === "ADMIN" && (
  <Link href="/admin/users" className="rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
    Users
  </Link>
)}
```

- [ ] **Step 6: Tests + tsc**

```bash
npm test -- src/features/platform/create-user-form.test.tsx
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/features/platform/admin-users-view.tsx src/features/platform/create-user-form.tsx src/features/platform/create-user-form.test.tsx src/app/admin/users/page.tsx src/features/platform/project-dashboard.tsx
git commit -m "feat(platform): add admin user management page"
```

## Task 4: Light Real-Use Polish

**Files:**
- Modify: `src/features/platform/login-form.tsx`
- Modify: `src/features/platform/project-dashboard.tsx`

- [ ] **Step 1: Brand the login title from env**

In `login-form.tsx`, replace the hardcoded `"ABC Cabinet Login"` with a value from `process.env.NEXT_PUBLIC_COMPANY_NAME` (fallback `"Showroom"`), e.g. heading text `` `${process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Showroom"} Login` ``. Note: `NEXT_PUBLIC_*` is inlined at build time, so document that this var must be set in Railway before build if a custom brand is wanted.

- [ ] **Step 2: Dashboard empty-state CTA**

In `project-dashboard.tsx`, when `projects.length === 0`, replace the plain "No projects yet." with a short message plus a primary `Link` to `/projects/new` ("Create your first project").

- [ ] **Step 3: Responsive pass (dashboard + project shell only)**

Keep it minimal and limited to the platform shell (do NOT touch the Round 1 SVG intake screen in this pass):
- Dashboard project rows: make the 4-column grid stack/condense on narrow screens (e.g. `grid-cols-2 sm:grid-cols-4`, hide the date column on the smallest width).
- Header action group: allow wrapping (`flex-wrap gap-3`) so buttons don't overflow on small screens.
- Verify the login and new-project forms already work on mobile width (they use `max-w-sm` / `max-w-xl` and should be fine — just confirm in browser QA).

- [ ] **Step 4: tsc + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/features/platform/login-form.tsx src/features/platform/project-dashboard.tsx
git commit -m "feat(platform): real-use polish for login brand, empty state, responsiveness"
```

## Task 5: Verification + Docs

**Files:**
- Modify: `ai_ctx.md`

- [ ] **Step 1: Full unit suite + types + build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all green; new routes `/admin/users` (page) and `/api/admin/users` registered.

- [ ] **Step 2: Browser QA against the local Docker Postgres**

Bring up the local DB if not running (see `docs/deployment/railway-internal-platform.md` "Local one-off scripts" and the Docker steps), seed an admin and a sales user, then verify:

```bash
docker start module1-pg   # or the `docker run ...` from the deployment notes
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/module1
npm run db:migrate
SEED_ADMIN_EMAIL='admin@local' SEED_ADMIN_PASSWORD='localtest1' npm run db:seed-admin
npm run dev
```

QA checklist (use `preview_*` tools):
- Logged out: `/admin/users` redirects to `/login`.
- As ADMIN: dashboard shows the `Users` link; `/admin/users` lists the admin; create a SALES user via the form → list refreshes and shows them.
- Duplicate email → form shows "Email already in use" (HTTP 409), no crash.
- Sign out, log in as that SALES user → no `Users` link; visiting `/admin/users` redirects to `/projects`; `GET /api/admin/users` returns 403.
- Empty-state CTA shows for a fresh sales user; "Create your first project" works.
- Narrow viewport (`preview_resize` mobile): dashboard + login + new-project + users pages are usable (no horizontal overflow).

- [ ] **Step 3: `ai_ctx.md` Done entry**

Add a concise entry under "Active Work", e.g.:

```md
Done (YYYY-MM-DD): admin self-service user management implemented — ADMIN-only `/admin/users` page + `GET/POST /api/admin/users` (requireRole ADMIN, 401/403/409 handled), backed by `user-admin-repository.ts` (list + create, password hashed via existing helper). Dashboard shows a Users link for admins. Light real-use polish: login brand from `NEXT_PUBLIC_COMPANY_NAME`, dashboard empty-state CTA, responsive dashboard/header. Salespeople can now be added from the UI instead of editing the Railway pre-deploy command.
```

- [ ] **Step 4: Commit + push + PR**

```bash
git add ai_ctx.md
git commit -m "docs: record admin user management + polish"
git push -u origin feat/admin-user-management
```

Open a PR into `main` (the repo requires PRs). After merge, Railway auto-deploys; if a custom login brand is wanted, set `NEXT_PUBLIC_COMPANY_NAME` in Railway before the build.

## Final Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

All green, plus the browser QA checklist in Task 5 passing.

## Notes / Follow-ups (out of scope here)

- Edit / disable / delete users, and password reset, are intentionally deferred — add only if real use needs them.
- The existing non-admin API routes (`/api/projects`, `/api/projects/[projectId]/...`) still surface `UnauthorizedError` as a 500. If session-expiry 500s show up in real use, retrofit the same `authError()` pattern there (separate small task).
- Deeper Round 1 intake UI polish should wait for actual salesperson feedback, per `ai_ctx.md`.
