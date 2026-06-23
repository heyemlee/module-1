# Admin User Status and Create-User Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent saved-login autofill in the Create user form and let administrators pause or activate every other user in their company without allowing self-lockout.

**Architecture:** Keep `users.disabled_at` as the status source of truth. Add a company-scoped repository update, an ADMIN-only dynamic API route, and a small client-side row action component. Pausing also removes and invalidates the target user's sessions so access ends immediately.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, PostgreSQL, Zod, Vitest

---

### Task 1: Create-user autofill behavior

**Files:**
- Modify: `src/features/platform/create-user-form.test.tsx`
- Modify: `src/features/platform/create-user-form.tsx`

- [ ] **Step 1: Write the failing test**

Extend the existing static-markup test:

```tsx
expect(html).toContain('autocomplete="off"');
expect(html).toContain('autocomplete="new-password"');
expect(html).toMatch(/name="account"[^>]*value=""/);
expect(html).toMatch(/name="password"[^>]*value=""/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/platform/create-user-form.test.tsx`

Expected: FAIL because the form and inputs do not yet expose these attributes.

- [ ] **Step 3: Write minimal implementation**

Set `autoComplete="off"` on the form, use `name="account"` and `autoComplete="off"` on Account, and use `name="password"` and `autoComplete="new-password"` on Password. Keep both controlled values initialized to empty strings.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/platform/create-user-form.test.tsx`

Expected: PASS.

### Task 2: Immediate target-session invalidation

**Files:**
- Modify: `src/server/platform/auth-repository.test.ts`
- Modify: `src/server/platform/auth-repository.ts`

- [ ] **Step 1: Write the failing test**

Add a test that caches two sessions for one user and one session for another user, calls `deleteSessionsForUser("user-1")`, then verifies both matching cache entries query again while the unrelated entry remains cached. Assert the database deletion uses `DELETE FROM sessions WHERE user_id = $1`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/platform/auth-repository.test.ts`

Expected: FAIL because `deleteSessionsForUser` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add:

```ts
export async function deleteSessionsForUser(userId: string) {
  for (const [sessionId, cached] of sessionUserCache) {
    if (cached.user.id === userId) sessionUserCache.delete(sessionId);
  }
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/server/platform/auth-repository.test.ts`

Expected: PASS.

### Task 3: Company-scoped status repository

**Files:**
- Modify: `src/server/platform/user-admin-repository.test.ts`
- Modify: `src/server/platform/user-admin-repository.ts`

- [ ] **Step 1: Write failing repository tests**

Add tests that:

- pause a matching user with `disabled_at = now()` and call `deleteSessionsForUser`;
- activate a matching user with `disabled_at = NULL` and do not delete sessions;
- throw `CompanyUserNotFoundError` when the company-scoped update returns no row.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/server/platform/user-admin-repository.test.ts`

Expected: FAIL because status update behavior does not exist.

- [ ] **Step 3: Write minimal implementation**

Add `CompanyUserNotFoundError` and:

```ts
export async function setCompanyUserDisabled(input: {
  companyId: string;
  userId: string;
  disabled: boolean;
}) {
  const result = await query<CompanyUserRow>(
    `UPDATE users
     SET disabled_at = CASE WHEN $3 THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $1 AND company_id = $2
     RETURNING id, account, email, name, role, disabled_at, created_at`,
    [input.userId, input.companyId, input.disabled]
  );
  const row = result.rows[0];
  if (!row) throw new CompanyUserNotFoundError("User not found");
  if (input.disabled) await deleteSessionsForUser(input.userId);
  return mapCompanyUserRow(row);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/server/platform/user-admin-repository.test.ts`

Expected: PASS.

### Task 4: ADMIN-only status API

**Files:**
- Create: `src/app/api/admin/users/[userId]/status/route.test.ts`
- Create: `src/app/api/admin/users/[userId]/status/route.ts`

- [ ] **Step 1: Write failing API tests**

Mock authentication and repository dependencies. Cover:

- ADMIN pauses another user and receives 200;
- self-update returns 400 without calling the repository;
- malformed body returns 400;
- repository not-found returns 404;
- authentication and role failures map to 401/403.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- 'src/app/api/admin/users/[userId]/status/route.test.ts'`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Write minimal implementation**

Parse `{ disabled: boolean }` with Zod, call `requireUser()` and `requireRole(user, ["ADMIN"])`, reject `user.id === userId`, then call `setCompanyUserDisabled({ companyId: user.companyId, userId, disabled })`. Return consistent 400/401/403/404/500 JSON errors.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- 'src/app/api/admin/users/[userId]/status/route.test.ts'`

Expected: PASS.

### Task 5: Users-page Activate/Pause actions

**Files:**
- Create: `src/features/platform/user-status-action.test.tsx`
- Create: `src/features/platform/user-status-action.tsx`
- Modify: `src/features/platform/admin-users-view.tsx`

- [ ] **Step 1: Write failing component tests**

Render static markup for active and disabled targets. Assert active renders `Pause`, disabled renders `Activate`, and the expected endpoint target is represented by the component contract.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/platform/user-status-action.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Write minimal client component**

Create a controlled request button that sends:

```ts
fetch(`/api/admin/users/${userId}/status`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ disabled: !disabled })
});
```

On success call `router.refresh()`. Disable and relabel while busy, and show a local error on failure.

- [ ] **Step 4: Integrate into the user table**

Add an Action column and render `UserStatusAction` only when `u.id !== currentUserId`. Keep the current user's cell empty so self-status changes are unavailable in the UI.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/features/platform/user-status-action.test.tsx src/features/platform/create-user-form.test.tsx`

Expected: PASS.

### Task 6: Full verification

**Files:**
- Review all changed files

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run type checking**

Run: `npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 4: Inspect changes**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned files are modified or added.
