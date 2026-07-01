# Rendering Task Continuity Design

## Goal

Keep an in-progress concept-rendering request alive while the user navigates
between Round 1 steps, the project page, renderings, or any other authenticated
page in the same browser session.

This change does not promise continuity after a hard refresh, closing the
browser, signing out, restarting the server, or deploying a new version. Those
cases require a durable server-side queue and are outside this scope.

## Root Cause

`ShowroomIntakeApp` currently owns the rendering request and all of its status.
Moving between its internal steps keeps that component mounted, so the request
continues. Navigating back to a project replaces the route subtree and removes
the component that owns the task and its visible state. There is no
application-level task owner or pending-task status outside the Round 1 page.

## Architecture

Add a client-side `RenderingTaskProvider` directly inside the authenticated
`(app)` layout. Next.js preserves that layout across soft navigation between
authenticated routes, so the provider remains mounted when the Round 1 page is
replaced by the project page.

The provider owns one task per project:

- `idle`
- `running`
- `succeeded`
- `failed`

Each task stores its project label, result or error, and the promise performing
the state-save and rendering API requests. A second start request for a project
that is already running returns the existing task instead of generating a
duplicate image.

## Data Flow

1. Round 1 validates the rendering gate and rasterizes the top-down plan and
   optional material swatch.
2. Round 1 passes the saved-state payload and reference images to the global
   provider.
3. The provider marks the project task `running`, saves the latest Round 1
   state, then posts the rendering request.
4. Route navigation can replace `ShowroomIntakeApp`; the provider and its
   request remain mounted in the authenticated layout.
5. On success, the provider stores the rendering response and calls
   `router.refresh()` so the currently visible project or rendering page can
   read the new server record.
6. When Round 1 is mounted, it derives its busy/error state from the provider
   and inserts a successful result into its preview list exactly once.

## User Interface

The provider renders a compact global status notice while a task is running, so
the user can see that rendering continues after leaving Round 1. Success and
failure remain visible until dismissed or a new task for that project starts.

The notice identifies the project and never blocks navigation. On success it
links to that project's renderings page.

## Error Handling

- State-save failure marks the global task failed and skips the paid image call.
- Rendering HTTP errors and the existing 120-second client timeout become the
  task's visible error.
- A completed or failed task can be started again.
- Duplicate starts while `running` do not issue another request.
- Component unmounts do not clear provider task state.

## Components

- `src/features/platform/rendering-task-provider.tsx`
  - Owns task state, request execution, deduplication, global status notice, and
    route refresh after completion.
- `src/app/(app)/layout.tsx`
  - Mounts the provider around authenticated application content.
- `src/features/round1/showroom-intake-app.tsx`
  - Prepares rendering inputs, starts the global task, and consumes task status
    and results instead of owning the long-running request.

The rendering API and database schema remain unchanged.

## Verification

- Provider tests prove that navigation-independent task state remains owned by
  the provider, duplicate starts share one request, success is retained, and
  failures are exposed.
- Round 1 tests prove that rendering busy/error/result presentation comes from
  the project task.
- Layout tests prove the provider wraps authenticated content.
- Existing rendering route, rendering reference, and rendering-service tests
  remain green.
- Browser QA starts rendering, navigates to the project page, observes the
  running notice, and verifies the completed rendering appears without
  returning to the original component first.
