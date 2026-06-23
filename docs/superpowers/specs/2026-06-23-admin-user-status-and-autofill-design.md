# Admin User Status and Create-User Autofill Design

## Goal

Improve the admin Users page in two focused ways:

1. Keep Account and Password empty when the Create user form first appears, including preventing browser/password-manager autofill where standard HTML attributes allow it.
2. Let an ADMIN pause and reactivate any other user in the same company, while preventing the ADMIN from pausing or activating their own account.

## Selected Approach

Use the existing `users.disabled_at` field as the single source of truth. Add a company-scoped status update repository function and an ADMIN-only API endpoint, then expose an Activate/Pause action beside each non-current user. This reuses the authentication behavior that already rejects users whose `disabledAt` value is set.

Alternatives considered:

- Deleting users was rejected because it destroys history and breaks foreign-key relationships.
- Adding a separate status enum was rejected because `disabled_at` already models the required active/paused states.
- Allowing self-pause with a confirmation dialog was rejected because it can lock out the acting administrator.

## Create User Form

- Account state starts as `""`.
- Password state starts as `""`.
- The form uses `autoComplete="off"`.
- The Account input uses an autocomplete value that discourages saved-login autofill without changing the login form.
- The Password input uses `autoComplete="new-password"`.
- Role continues to default to `SALES`.
- Existing submit validation and successful-submit reset behavior remain unchanged.
- A server-render test verifies that Account and Password contain no initial value and that the autofill attributes are present.

## User Status Operations

### Interface

- Each user row continues to show Active or Disabled status.
- Every row except the current administrator's row includes one action:
  - Active user: `Pause`
  - Disabled user: `Activate`
- The current administrator's row continues to show `You` and has no status action.
- While a request is running, that row's action is disabled and displays progress text.
- On success, the page data refreshes.
- On failure, the row displays a concise error and remains in its prior visible state.

### API

- Add an ADMIN-only status endpoint scoped by target user ID.
- Request body contains the desired disabled state as a boolean.
- The endpoint obtains the acting user from `requireUser()` and verifies the ADMIN role.
- It rejects attempts to update the acting user's own ID.
- It updates only a user whose ID and company ID match the acting administrator.
- A missing or cross-company target returns 404 so company membership is not disclosed.
- Invalid request input returns 400.

### Repository

- The repository updates `disabled_at` to `now()` when pausing and to `NULL` when activating.
- The update query includes both target user ID and company ID.
- The updated safe user summary is returned.
- A dedicated not-found error distinguishes a missing target from database failures.

## Authentication and Session Behavior

- New login attempts already reject disabled users and remain unchanged.
- Existing requests already pass through `requireUser()`, which rejects a resolved disabled user.
- To make pausing effective immediately, all sessions belonging to the paused user are deleted as part of the status update transaction/query sequence. This avoids waiting for session expiry.
- Reactivating a user does not recreate sessions; they must sign in again.

## Safety Rules

- Only ADMIN users may call the status endpoint.
- An ADMIN cannot update their own status through either the interface or API.
- An ADMIN may pause or activate another ADMIN.
- Operations are limited to users in the same company.
- Pausing is reversible and does not delete user-owned project history.

## Testing

- Create-user form test: empty initial Account and Password values; expected autocomplete attributes.
- Repository tests: company-scoped pause, company-scoped activation, session deletion on pause, no session deletion on activation, and target-not-found behavior.
- API tests: ADMIN success, non-ADMIN rejection, self-update rejection, invalid input, and missing/cross-company target.
- Users-view test: actions appear only for other users and labels reflect current status.
- Run focused tests first, then the full test suite, TypeScript check, and production build.
