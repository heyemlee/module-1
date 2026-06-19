# Internal Project Platform Design

Date: 2026-06-19

## Purpose

Prepare Module 1 Round 1 for internal company production use before opening it as a future multi-company SaaS product.

The current Round 1 intake, deterministic layout generation, rough elevations, snapshot, rendering, and optional conversational agent remain the core workflow. This design adds the platform layer needed for real sales/design use:

- login and roles
- customers and projects
- durable Postgres storage
- project-scoped Round 1 data and renderings
- company-level AI configuration through server environment variables
- a path to future Round 2 detailed measured design

## Scope

This is a single-company internal app for the first production rollout. It should be built so a future SaaS version can introduce multiple companies without rewriting the core data model.

In scope:

- One internal company tenant.
- Fixed email/password user accounts.
- Roles: Admin, Sales, Designer.
- Customers and projects.
- Project-owned Round 1 state, snapshots, floor plans, rough elevations, and rendering history.
- Railway Postgres as the durable datastore.
- Railway Variables for AI provider and API keys.
- A project dashboard and project detail shell around the existing Round 1 workflow.

Out of scope for this phase:

- Public company signup.
- Billing.
- Multi-company self-service SaaS.
- Per-salesperson AI keys.
- Web-editable API keys in Admin Settings.
- Full CRM, pipeline, reminders, or n8n workflows.
- Round 2 production implementation.
- Pricing/quote functionality.
- Production-ready cabinet scheduling or manufacturing data.

## Confirmed Approach

Use the internal formal platform approach:

- Single tenant in product behavior, with `companyId` present in the data model.
- Fixed account/password login.
- Basic role-based authorization.
- Railway Postgres before launch.
- Company-level AI keys from Railway Variables.
- Admin Settings as a future enhancement, not a launch blocker.

This balances near-term launch speed with a clean path toward future SaaS.

## Data Model

The system should organize data as:

```text
Company
  -> Users
  -> Customers
    -> Projects
      -> Round1
        -> showroomForm
        -> normalizedData
        -> snapshot
        -> floorPlan
        -> renderings
      -> Round2 later
        -> detailedMeasurements
        -> productionDesign
        -> finalCabinetSchedule
```

Recommended first Postgres tables:

- `companies`
- `users`
- `customers`
- `projects`
- `round1_states`
- `round1_snapshots`
- `renderings`
- `sessions`

Future tables can include:

- `round2_measurements`
- `round2_designs`
- `cabinet_schedules`
- `audit_events`
- `company_ai_settings`

### Company

The first release should create one internal company record. All user, customer, and project rows should include `companyId` so future SaaS tenancy can be enforced without changing every table later.

### User

Users belong to one company in the first release.

Fields should include:

- `id`
- `companyId`
- `email`
- `name`
- `passwordHash`
- `role`
- `createdAt`
- `updatedAt`
- `disabledAt`

Roles:

- `ADMIN`
- `SALES`
- `DESIGNER`

### Customer

Customers represent the client or household.

Fields should include:

- `id`
- `companyId`
- `name`
- `phone`
- `email`
- `address`
- `notes`
- `createdByUserId`
- `createdAt`
- `updatedAt`

Customer contact fields can be optional, but customer name should be required.

### Project

A project represents one job or kitchen opportunity for a customer.

Fields should include:

- `id`
- `companyId`
- `customerId`
- `name`
- `status`
- `createdByUserId`
- `assignedDesignerId`
- `createdAt`
- `updatedAt`

Initial statuses:

- `DRAFT`
- `ROUND1_SNAPSHOT_READY`
- `ROUND1_RENDERING_READY`
- `NEEDS_CONFIRMATION`
- `ROUND2_READY`
- `ARCHIVED`

`ROUND2_READY` is reserved for later workflow and should not imply production readiness from Round 1 data.

### Round 1 State

`round1_states` stores the editable working state for the current Round 1 intake.

It should include:

- `projectId`
- `showroomFormJson`
- `positionOverridesJson`
- `fixedPositionsConfirmed`
- `cabinetFillGenerated`
- `updatedByUserId`
- `updatedAt`

This replaces localStorage as the main source of project identity and restore behavior.

### Round 1 Snapshot

`round1_snapshots` stores frozen generated Round 1 outputs after `Generate Cabinet Fill`.

It should preserve the existing safety invariants:

- `salesEstimateOnly: true`
- `notForProduction: true`
- `dimensionConfidence: "ROUGH"`

It should include:

- `id`
- `projectId`
- `snapshotJson`
- `generatedAt`
- `generatedByUserId`
- `createdAt`

Snapshots are authoritative for Round 1 sales confirmation, but never for production.

### Renderings

Renderings should be versioned history, not only a single latest row.

Fields should include:

- `id`
- `projectId`
- `round1SnapshotId`
- `model`
- `imageBase64` or future object-storage reference
- `prompt`
- `size`
- `basedOnSnapshotGeneratedAt`
- `salesEstimateOnly`
- `notForProduction`
- `dimensionConfidence`
- `createdByUserId`
- `createdAt`

The UI can still show the latest rendering by default, while preserving older renderings for comparison and audit.

## Permissions

### Admin

Admin can:

- create and disable users
- view all customers and projects
- edit all customers and projects
- assign designers
- access future Admin Settings

Admin should not be able to mark Round 1 as production-ready because Round 1 is never production data.

### Sales

Sales can:

- create customers
- create projects
- view and edit projects they created
- run the Round 1 intake
- generate Round 1 snapshots
- generate concept renderings

Sales cannot:

- manage users
- edit AI keys
- view all company projects by default

### Designer

Designer can:

- view all projects
- edit design-related project data
- review Round 1 outputs
- later enter Round 2 detailed measured design

Designer cannot:

- manage users
- edit AI keys

### Project Visibility

Initial rule:

- Sales sees projects where `project.createdByUserId` is their user id.
- Designer and Admin see all company projects.

Manual project member assignment is not part of the first release.

## Authentication

Use fixed email/password login for the first internal release.

Requirements:

- password hashes stored in Postgres
- secure HTTP-only session cookie
- sessions stored in Postgres
- logout endpoint
- disabled users cannot create new sessions

The login system should be simple enough to replace later with Google OAuth or SaaS organization invitations.

## AI Configuration

First production release:

- AI provider and API keys are configured in Railway Variables.
- No web UI should store or edit API keys.
- Sales users should never enter their own API keys.

Expected variables:

```text
OPENAI_API_KEY
OPENAI_IMAGE_MODEL=gpt-image-2
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
DATABASE_URL
```

Optional future provider variables:

```text
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
```

The first release may include a read-only AI status area for Admin users:

- rendering enabled or not configured
- agent assistant enabled or not configured
- selected chat provider
- selected chat model
- selected image model

Future Admin Settings can add encrypted database storage for provider keys, model selection, connection testing, and usage/cost logs.

## Deployment Architecture

Deploy on Railway:

```text
Railway Project
├─ Next.js Web Service
│  ├─ UI
│  ├─ API routes
│  ├─ auth/session
│  ├─ Round 1 deterministic services
│  ├─ agent service
│  └─ rendering service
│
├─ Railway Postgres
│  ├─ users
│  ├─ companies
│  ├─ customers
│  ├─ projects
│  ├─ round1 states/snapshots
│  └─ renderings
│
└─ Railway Variables
   ├─ DATABASE_URL
   ├─ OPENAI_API_KEY
   ├─ OPENAI_IMAGE_MODEL
   ├─ LLM_PROVIDER
   └─ OPENAI_MODEL
```

The existing file-backed repository can remain useful for local development and tests, but production should use Postgres.

The app should avoid relying on `ROUND1_DATA_FILE` in production.

## Repository Boundary

Preserve the repository abstraction pattern.

Add a Postgres-backed repository instead of making API routes directly own SQL details. Domain and feature builders should remain deterministic and mostly pure.

Recommended boundaries:

- Auth/session repository
- Customer/project repository
- Round 1 repository
- Rendering repository

Existing Round 1 safety validation should stay in API/service code:

- reject invalid snapshot saves
- preserve sales-only flags
- never trust client-posted snapshot authority for rendering
- load authoritative project/snapshot server-side before rendering

## UI Workflow

First internal release should add a project shell around the current Round 1 intake.

```text
Login
  -> Project Dashboard
    -> New Customer / New Project
    -> Project Detail
      -> Round 1 Intake
      -> Saved Snapshot
      -> Renderings
      -> Future Round 2 reserved area
```

### Dashboard

Dashboard should support:

- search by customer name, address, or project name
- create new customer/project
- status display
- role-filtered project visibility

Sales sees only their projects. Admin and Designer see all company projects.

### Project Detail

Project detail should show:

- customer summary
- project summary
- Round 1 status
- latest snapshot status
- latest rendering
- rendering history
- entry point into Round 1 intake
- future Round 2 reserved area

### Round 1 Intake

The current Round 1 workflow stays intact:

- Room
- Openings
- Layout
- Appliances
- Adjust Positions
- Generate Cabinet Fill
- Generate Rendering

The route should become project-scoped:

```text
/projects/:projectId/round1
```

The project id should come from the route and authenticated authorization, not localStorage. LocalStorage can be removed or left only as a temporary convenience during migration.

## Migration From Current MVP

Current state:

- Project id is stored in localStorage.
- Repository can be file-backed when `ROUND1_DATA_FILE` is set.
- `Round1Project` includes `customerName`, `round1`, `snapshot`, and `latestRendering`.

Target state:

- Project id comes from route.
- Customer and project are explicit database records.
- Round 1 editable state, snapshots, and renderings are project-scoped rows.
- Renderings are history rows with a latest view in the UI.

Existing JSON snapshots can be migrated later if needed. For launch, it is acceptable to start with an empty production Postgres database.

## Error Handling

Authentication:

- invalid credentials return a generic error
- disabled users cannot log in
- unauthorized project access returns 404 or 403

Data:

- missing project returns not found
- invalid snapshot save returns validation details
- stale client state should not overwrite a newer snapshot without explicit regeneration

AI:

- missing API key shows feature not configured
- rendering failure should keep the existing snapshot and existing renderings
- agent failure should not mutate the form

## Testing

Add focused tests for:

- password/session auth
- role-based project access
- Sales cannot access another salesperson's project
- Designer/Admin can access all company projects
- customer/project creation
- Round 1 snapshot save under a project
- rendering history save under a project
- project-scoped Round 1 restore
- AI status when variables are present or missing
- production invariants on snapshots and renderings

Manual QA should cover:

- login/logout
- Sales dashboard visibility
- Admin/Designer visibility
- create customer/project
- complete Round 1 intake
- generate snapshot
- generate rendering
- reload and restore project state

## Rollout Plan

Phase 1:

- Add auth, roles, customers, projects, Postgres repositories, and project-scoped Round 1 routes.
- Configure Railway Postgres and Railway Variables.
- Deploy for internal users only.

Phase 2:

- Polish UI from sales/designer feedback.
- Add Admin user management refinements.
- Add read-only AI status display.

Phase 3:

- Start a separate Module 2 detailed measured design context.
- Attach Round 2 data to the existing project model.

Phase 4:

- Convert single-company assumptions into multi-company SaaS behavior.
- Add organization signup, invitations, billing, and web-editable encrypted AI settings.

## Non-Negotiable Boundaries

- Round 1 remains sales-estimate-only.
- Round 1 data must never become production-ready.
- AI output must never become the authoritative source of cabinet data, dimensions, geometry, or readiness.
- Sales users must not manage API keys.
- API keys must not be committed, logged, or shown to non-admin users.
- Project access must be checked server-side, not only hidden in the UI.
